import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Trabajos concurrentes por proceso. La transcodificación satura CPU. */
  MEDIA_CONCURRENCY: z.coerce.number().int().positive().default(2),
})

export type Env = z.infer<typeof EnvSchema>

export function cargarConfig(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración de entorno inválida:\n${detalle}`)
  }
  return parsed.data
}

/** Nombre de la cola de medios. Compartido con el API, que encola. */
export const COLA_MEDIA = 'media'
