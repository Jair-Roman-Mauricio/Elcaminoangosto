import { z } from 'zod'

/**
 * Configuración validada al arrancar. Si falta un secreto, el proceso muere
 * de inmediato en lugar de fallar a medianoche en producción.
 *
 * Nunca hardcodees valores aquí. Ver `.env.example`.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /** Orígenes permitidos por CORS, separados por coma. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim())),

  /** URL del proyecto Supabase, p. ej. https://xxxx.supabase.co */
  SUPABASE_URL: z.string().url(),

  /**
   * JWKS del proyecto: claves ASIMÉTRICAS (ES256/RS256).
   * Nunca el secreto HS256 legacy — ver arquitectura.md §5.
   */
  SUPABASE_JWKS_URL: z.string().url(),

  /** Emisor esperado del JWT: `${SUPABASE_URL}/auth/v1` */
  SUPABASE_JWT_ISSUER: z.string().url(),

  /** Solo para operaciones administrativas controladas. Jamás llega al front. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

export type Env = z.infer<typeof EnvSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  · ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Configuración de entorno inválida:\n${detalle}`)
  }
  return parsed.data
}
