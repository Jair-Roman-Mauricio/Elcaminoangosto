import {
  GatewayTimeoutException,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { throwError, TimeoutError, type Observable } from 'rxjs'
import { catchError, timeout } from 'rxjs/operators'

/**
 * Techo de duración para cualquier petición.
 *
 * Por encima del límite del cliente (15 s en `api-client.ts`): quien manda en
 * el corte es el navegador, y esto solo evita que una petición que él ya
 * abandonó siga viva en el servidor acumulando trabajo.
 */
const LIMITE_MS = 20_000

/**
 * Una petición que no termina nunca no es un error visible: es una pestaña
 * girando y un servidor que se va llenando de trabajo que ya no le importa a
 * nadie. Mejor un 504 claro, que el front sabe contar.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(LIMITE_MS),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new GatewayTimeoutException('El servidor tardó demasiado en responder.')
            : error,
        ),
      ),
    )
  }
}
