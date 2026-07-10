import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { Logger as PinoLogger } from 'nestjs-pino'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './modules/shared/filters/http-exception.filter'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(PinoLogger))
  app.useGlobalFilters(new HttpExceptionFilter())
  app.enableShutdownHooks()

  const config = app.get(ConfigService)

  // RNF-4 (OWASP): cabeceras seguras y CORS restringido a orígenes conocidos.
  app.use(helmet())
  app.enableCors({
    origin: config.getOrThrow<string[]>('CORS_ORIGINS'),
    credentials: true,
  })

  app.setGlobalPrefix('api')

  // Contrato vivo para el front. En producción se sirve solo si se pide.
  if (config.get('NODE_ENV') !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('El Camino Angosto — API')
        .setDescription('Alabanza · Tarjetas de Fe · Discipulado · Chat mentor')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    )
    SwaggerModule.setup('api/docs', app, doc)
  }

  const port = config.getOrThrow<number>('PORT')
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
