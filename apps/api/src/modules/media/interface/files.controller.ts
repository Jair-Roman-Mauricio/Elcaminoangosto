import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import sharp from 'sharp'
import { Readable } from 'node:stream'
import { MediaStoragePort } from '../domain/media-storage.port'
import { Public } from '../../shared'

const BUCKETS_PUBLICOS = new Set(['avatars', 'thumbnails'])
const ANCHO_MAX = 2400

/** Sirve archivos que el navegador no puede pedir directo al bucket privado. */
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: MediaStoragePort) {}

  /** Lo público: avatares y miniaturas. Admite `?w=` y `?q=` para redimensionar. */
  @Get('public/:bucket/*path')
  async publico(
    @Param('bucket') bucket: string,
    @Param('path') partes: string[],
    @Query('w') w: string | undefined,
    @Query('q') q: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!BUCKETS_PUBLICOS.has(bucket)) throw new NotFoundException()
    await this.servir(res, bucket, partes.join('/'), numero(w), numero(q))
  }

  /** Imagen redimensionada de un bucket privado, con la firma que emitió el API. */
  @Get('r/:bucket/*path')
  async redimensionada(
    @Param('bucket') bucket: string,
    @Param('path') partes: string[],
    @Query('w') w: string,
    @Query('q') q: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    const path = partes.join('/')
    if (!sig || !this.storage.verificarRedimension(bucket, path, Number(exp), Number(w), Number(q), sig)) {
      throw new NotFoundException()
    }
    await this.servir(res, bucket, path, numero(w), numero(q))
  }

  private async servir(
    res: Response,
    bucket: string,
    path: string,
    ancho: number | undefined,
    calidad: number | undefined,
  ): Promise<void> {
    if (path.includes('..')) throw new BadRequestException()
    const objeto = await this.storage.get(bucket, path)
    if (!objeto) throw new NotFoundException()

    const esImagen = (objeto.contentType ?? '').startsWith('image/')
    if (ancho && esImagen) {
      const salida = sharp({ failOn: 'none' })
        .rotate()
        .resize({ width: Math.min(ancho, ANCHO_MAX), withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: Math.min(Math.max(calidad ?? 75, 40), 95) })
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      ;(objeto.body as Readable).pipe(salida).pipe(res)
      return
    }

    res.set({
      'Content-Type': objeto.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      // El web vive en otro origen: las imágenes se pintan y se leen en canvas.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    })
    if (objeto.contentLength) res.set('Content-Length', String(objeto.contentLength))
    ;(objeto.body as Readable).pipe(res)
  }
}

function numero(v: string | undefined): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}
