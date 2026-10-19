import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Readable } from 'node:stream'
import {
  MediaStoragePort,
  type ObjetoLeido,
  type TransformacionDeImagen,
} from '../domain/media-storage.port'

/**
 * Adaptador sobre un bucket S3-compatible (Railway Buckets). Un solo bucket
 * físico aloja los cinco lógicos del producto como prefijos: la clave de un
 * objeto es `<bucket-lógico>/<ruta>`.
 *
 * Railway Buckets son privados: lo público (avatares, miniaturas) lo sirve el
 * API en `/files/public/...`, y las imágenes redimensionadas en `/files/r/...`
 * con una firma propia. Es el único punto que conoce el SDK de AWS.
 */
@Injectable()
export class S3StorageAdapter extends MediaStoragePort {
  private readonly s3: S3Client
  private readonly bucketFisico: string
  private readonly apiPublica: string
  private readonly secreto: string

  constructor(config: ConfigService) {
    super()
    this.bucketFisico = config.getOrThrow<string>('S3_BUCKET')
    this.apiPublica = config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '')
    this.secreto = config.getOrThrow<string>('JWT_SECRET')
    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    })
  }

  private clave(bucket: string, path: string): string {
    return `${bucket}/${path}`
  }

  async signedUrl(
    bucket: string,
    path: string,
    ttlSeconds: number,
    transformacion?: TransformacionDeImagen,
  ): Promise<string> {
    if (transformacion) {
      const expiraEn = Math.floor(Date.now() / 1000) + ttlSeconds
      return this.firmarRedimension(bucket, path, expiraEn, transformacion.width, transformacion.quality)
    }
    try {
      return await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucketFisico, Key: this.clave(bucket, path) }),
        { expiresIn: ttlSeconds },
      )
    } catch (error) {
      throw new InternalServerErrorException(
        `No se pudo firmar ${bucket}/${path}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return
    try {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketFisico,
          Delete: { Objects: paths.map((p) => ({ Key: this.clave(bucket, p) })), Quiet: true },
        }),
      )
    } catch (error) {
      throw new InternalServerErrorException(
        `No se pudo borrar de ${bucket}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async put(
    bucket: string,
    path: string,
    body: NodeJS.ReadableStream | Buffer,
    contentType: string,
  ): Promise<void> {
    await new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucketFisico,
        Key: this.clave(bucket, path),
        Body: Buffer.isBuffer(body) ? body : (body as Readable),
        ContentType: contentType,
      },
      queueSize: 3,
      partSize: 8 * 1024 * 1024,
    }).done()
  }

  async get(bucket: string, path: string): Promise<ObjetoLeido | null> {
    try {
      const r = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucketFisico, Key: this.clave(bucket, path) }),
      )
      return {
        body: r.Body as Readable,
        contentType: r.ContentType,
        contentLength: r.ContentLength,
      }
    } catch (error) {
      if (error instanceof S3ServiceException && (error.name === 'NoSuchKey' || error.$metadata.httpStatusCode === 404)) {
        return null
      }
      throw error
    }
  }

  urlPublica(bucket: string, path: string): string {
    return `${this.apiPublica}/files/public/${bucket}/${path}`
  }

  firmarRedimension(bucket: string, path: string, expiraEn: number, w: number, q: number): string {
    const firma = this.firma(bucket, path, expiraEn, w, q)
    return `${this.apiPublica}/files/r/${bucket}/${path}?w=${w}&q=${q}&exp=${expiraEn}&sig=${firma}`
  }

  verificarRedimension(
    bucket: string,
    path: string,
    expiraEn: number,
    w: number,
    q: number,
    firma: string,
  ): boolean {
    if (expiraEn < Math.floor(Date.now() / 1000)) return false
    const esperada = Buffer.from(this.firma(bucket, path, expiraEn, w, q))
    const recibida = Buffer.from(firma)
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
  }

  private firma(bucket: string, path: string, expiraEn: number, w: number, q: number): string {
    return createHmac('sha256', this.secreto)
      .update(`${bucket}/${path}|${expiraEn}|${w}|${q}`)
      .digest('base64url')
  }
}
