import {
  Catch,
  Logger,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'

interface RespuestaError {
  statusCode: number
  message: string
  path: string
  timestamp: string
}

/**
 * Filtro global. Traduce cualquier excepción a una respuesta uniforme y
 * **nunca filtra detalles internos al cliente** (AGENTS.md §4).
 *
 * Los 5xx se registran con su stack; los 4xx son esperables y se registran
 * a nivel debug para no ensuciar los logs.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const esHttp = exception instanceof HttpException
    const statusCode = esHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const message = esHttp
      ? extraerMensaje(exception)
      : // Un error no controlado jamás expone su mensaje real.
        'Ha ocurrido un error interno.'

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    } else {
      this.logger.debug(`${request.method} ${request.url} → ${statusCode}: ${message}`)
    }

    const body: RespuestaError = {
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    }

    response.status(statusCode).json(body)
  }
}

function extraerMensaje(exception: HttpException): string {
  const respuesta = exception.getResponse()
  if (typeof respuesta === 'string') return respuesta
  if (typeof respuesta === 'object' && respuesta !== null && 'message' in respuesta) {
    const { message } = respuesta as { message: unknown }
    if (Array.isArray(message)) return message.join('; ')
    if (typeof message === 'string') return message
  }
  return exception.message
}
