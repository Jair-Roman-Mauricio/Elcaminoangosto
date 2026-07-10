import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

/**
 * Valida el payload con un esquema Zod compartido con el front
 * (`packages/shared-types`). Un solo contrato, dos consumidores.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const resultado = this.schema.safeParse(value)
    if (!resultado.success) {
      throw new BadRequestException(
        resultado.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`),
      )
    }
    return resultado.data
  }
}
