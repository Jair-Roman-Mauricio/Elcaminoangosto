/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

export type EstadoDePublicacion = 'VISIBLE' | 'OCULTO'

/**
 * Un consejero: una persona a la que escribir cuando lo que pasa no puede
 * esperar.
 *
 * Los contactos van sueltos, de «canal» a dato, porque cada uno deja los suyos:
 * uno solo da WhatsApp y otro prefiere el correo. Un botón que no lleva a nadie
 * es peor que no tenerlo, y aquí ese fallo lo paga quien necesitaba ayuda.
 */
export interface ConsejeroEntity {
  id: string
  nombre: string
  presentacion: string | null
  rol: string | null
  fotoAssetId: string | null
  contactos: Record<string, string>
  /** Sube al principio de la lista y destaca su contacto. */
  atiendeUrgencias: boolean
  orden: number
  estado: EstadoDePublicacion
  createdAt: Date
}

/** Los cambios llegan de un cuerpo parcial: admiten `undefined` explícito. */
type Cambios<T> = { [K in keyof T]?: T[K] | undefined }

export abstract class ConsejerosRepository {
  abstract listar(incluirOcultos: boolean): Promise<ConsejeroEntity[]>
  abstract porId(id: string): Promise<ConsejeroEntity | null>
  abstract crear(input: Omit<ConsejeroEntity, 'id' | 'estado' | 'createdAt'>): Promise<ConsejeroEntity>
  abstract editar(
    id: string,
    cambios: Cambios<Omit<ConsejeroEntity, 'id' | 'createdAt'>>,
  ): Promise<void>
  abstract eliminar(id: string): Promise<void>
}
