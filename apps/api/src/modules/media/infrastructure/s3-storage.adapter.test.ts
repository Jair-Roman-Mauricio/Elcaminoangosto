import { describe, expect, it } from 'vitest'
import type { ConfigService } from '@nestjs/config'
import { S3StorageAdapter } from './s3-storage.adapter'

const valores: Record<string, unknown> = {
  S3_BUCKET: 'bucket-fisico',
  S3_ENDPOINT: 'https://s3.ejemplo.test',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'AK',
  S3_SECRET_ACCESS_KEY: 'SK',
  S3_FORCE_PATH_STYLE: false,
  API_PUBLIC_URL: 'https://api.ejemplo.test/api/',
  JWT_SECRET: 'un-secreto-de-prueba-de-al-menos-32-caracteres',
}
const adaptador = () =>
  new S3StorageAdapter({ getOrThrow: (k: string) => valores[k] } as unknown as ConfigService)

const dentroDeUnaHora = () => Math.floor(Date.now() / 1000) + 3600

describe('S3StorageAdapter', () => {
  it('arma la URL pública bajo /files/public sin barra doble', () => {
    expect(adaptador().urlPublica('thumbnails', 'u/a.png')).toBe(
      'https://api.ejemplo.test/api/files/public/thumbnails/u/a.png',
    )
  })

  it('la URL redimensionada firmada se verifica', () => {
    const a = adaptador()
    const exp = dentroDeUnaHora()
    const url = new URL(a.firmarRedimension('music', 'u/a.jpg', exp, 600, 75))
    expect(url.pathname).toBe('/api/files/r/music/u/a.jpg')
    expect(a.verificarRedimension('music', 'u/a.jpg', exp, 600, 75, url.searchParams.get('sig')!)).toBe(true)
  })

  it('no acepta una firma si se cambia el ancho, la ruta o la caducidad', () => {
    const a = adaptador()
    const exp = dentroDeUnaHora()
    const sig = new URL(a.firmarRedimension('music', 'u/a.jpg', exp, 600, 75)).searchParams.get('sig')!
    expect(a.verificarRedimension('music', 'u/a.jpg', exp, 4000, 75, sig)).toBe(false)
    expect(a.verificarRedimension('music', 'u/otra.jpg', exp, 600, 75, sig)).toBe(false)
    expect(a.verificarRedimension('music', 'u/a.jpg', exp + 1, 600, 75, sig)).toBe(false)
    expect(a.verificarRedimension('music', 'u/a.jpg', exp, 600, 75, 'basura')).toBe(false)
  })

  it('no acepta una firma vencida', () => {
    const a = adaptador()
    const exp = Math.floor(Date.now() / 1000) - 10
    const sig = new URL(a.firmarRedimension('music', 'u/a.jpg', exp, 600, 75)).searchParams.get('sig')!
    expect(a.verificarRedimension('music', 'u/a.jpg', exp, 600, 75, sig)).toBe(false)
  })
})
