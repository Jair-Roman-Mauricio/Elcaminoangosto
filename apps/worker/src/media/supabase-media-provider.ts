import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MediaProvider,
  type DerivadosDeMedio,
  type EntradaDeTranscodificacion,
} from './media-provider'

/**
 * Adaptador sobre Supabase Storage + ffmpeg local (arquitectura.md §6, ADR-006).
 *
 * Supabase Storage NO transcodifica: descargamos el original, lo procesamos con
 * ffmpeg y volvemos a subir los derivados.
 *
 * VIDEO → MP4 normalizado con `-movflags +faststart` (moov al principio → el
 *         navegador arranca sin descargar el archivo entero) + póster JPG.
 * IMAGE → póster = la propia imagen (sin transcodificar).
 * AUDIO → se deja tal cual por ahora (la música llega en S5).
 *
 * HLS se difiere (ADR-006): `hlsPath` queda null.
 */
export class SupabaseMediaProvider extends MediaProvider {
  readonly nombre = 'supabase'

  constructor(private readonly supabase: SupabaseClient) {
    super()
  }

  async transcodificar(entrada: EntradaDeTranscodificacion): Promise<DerivadosDeMedio> {
    const dir = await mkdtemp(join(tmpdir(), 'eca-media-'))
    try {
      const original = join(dir, 'original')
      await this.descargar(entrada.bucket, entrada.path, original)

      if (entrada.kind === 'VIDEO') {
        return await this.procesarVideo(entrada, dir, original)
      }
      if (entrada.kind === 'IMAGE') {
        return await this.procesarImagen(entrada, original)
      }
      // AUDIO: sin derivados por ahora.
      return { hlsPath: null, posterPath: null, durationSeconds: null }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  private async procesarVideo(
    entrada: EntradaDeTranscodificacion,
    dir: string,
    original: string,
  ): Promise<DerivadosDeMedio> {
    const salida = join(dir, 'web.mp4')
    const poster = join(dir, 'poster.jpg')

    // MP4 web: H.264 + AAC, faststart. `-vf scale` limita a 720p de ancho máx.
    await this.ffmpeg([
      '-y', '-i', original,
      '-vf', "scale='min(720,iw)':-2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      salida,
    ])

    // Póster: un fotograma a 1s (o el primero si el clip es más corto).
    await this.ffmpeg(['-y', '-ss', '1', '-i', original, '-vframes', '1', '-q:v', '3', poster])

    const duracion = await this.duracion(original)

    const base = entrada.path.replace(/\/original\.[^.]+$/, '')
    const posterPath = `${base}/poster.jpg`

    // El reproductor lee `media_assets.path`; lo sobrescribimos con el MP4 web
    // (faststart). Así no hace falta un campo nuevo para el derivado.
    await this.subir(entrada.bucket, entrada.path, await readFile(salida), 'video/mp4')
    await this.subir(entrada.bucket, posterPath, await readFile(poster), 'image/jpeg')

    return { hlsPath: null, posterPath, durationSeconds: duracion }
  }

  private async procesarImagen(
    entrada: EntradaDeTranscodificacion,
    original: string,
  ): Promise<DerivadosDeMedio> {
    const base = entrada.path.replace(/\/original\.[^.]+$/, '')
    const posterPath = `${base}/poster.jpg`
    await this.subir(entrada.bucket, posterPath, await readFile(original), 'image/jpeg')
    return { hlsPath: null, posterPath, durationSeconds: null }
  }

  async firmarUrl(bucket: string, path: string, ttlSeconds: number): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds)
    if (error || !data) {
      throw new Error(`No se pudo firmar ${bucket}/${path}: ${error?.message ?? 'sin datos'}`)
    }
    return data.signedUrl
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async descargar(bucket: string, path: string, destino: string): Promise<void> {
    const { data, error } = await this.supabase.storage.from(bucket).download(path)
    if (error || !data) throw new Error(`No se pudo descargar ${bucket}/${path}: ${error?.message}`)
    await writeFile(destino, Buffer.from(await data.arrayBuffer()))
  }

  private async subir(
    bucket: string,
    path: string,
    contenido: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, contenido, { contentType, upsert: true })
    if (error) throw new Error(`No se pudo subir ${bucket}/${path}: ${error.message}`)
  }

  private ffmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let err = ''
      p.stderr.on('data', (d) => (err += String(d)))
      p.on('error', reject)
      p.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg salió con ${code}: ${err.slice(-500)}`)),
      )
    })
  }

  private async duracion(archivo: string): Promise<number | null> {
    await stat(archivo) // asegura que existe
    return new Promise((resolve) => {
      const p = spawn('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', archivo,
      ])
      let out = ''
      p.stdout.on('data', (d) => (out += String(d)))
      p.on('error', () => resolve(null))
      p.on('close', () => {
        const n = Number.parseFloat(out.trim())
        resolve(Number.isFinite(n) ? Math.round(n) : null)
      })
    })
  }
}
