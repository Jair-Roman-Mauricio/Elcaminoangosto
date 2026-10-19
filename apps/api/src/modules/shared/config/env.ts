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

  /** Secreto con el que el API firma los JWT de sesión (HS256). Mínimo 32 caracteres. */
  JWT_SECRET: z.string().min(32),

  /** Vida del token de acceso, en segundos. */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),

  /** Vida del token de refresco, en días. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** URL pública del web: va en los enlaces de los correos. */
  APP_URL: z.string().url().default('http://localhost:5173'),

  /** URL pública del propio API (con /api): va en las URLs de archivos públicos. */
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000/api'),

  /** Almacenamiento S3-compatible (Railway Bucket). */
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /** Correo saliente (Brevo u otro SMTP). Sin esto, los enlaces solo se registran en el log. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('El Camino Angosto <no-reply@elcaminoangosto.app>'),

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
