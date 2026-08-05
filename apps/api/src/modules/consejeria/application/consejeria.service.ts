import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  ConsejerosRepository,
  type ConsejeroEntity,
} from '../domain/consejeros.repository'
import { MediaService } from '../../media'
import type { Actor } from '../../shared'

/** Un consejero como lo consume la interfaz, con la foto ya firmada. */
export interface ConsejeroCard {
  id: string
  nombre: string
  presentacion: string | null
  rol: string | null
  fotoUrl: string | null
  contactos: Record<string, string>
  atiendeUrgencias: boolean
  orden: number
  oculto: boolean
}

/**
 * API pública del bounded context `consejeria`.
 *
 * La lista es abierta y no pide cuenta: quien necesita este teléfono no está
 * para registrarse. Publicar y retirar es solo del ADMIN.
 */
@Injectable()
export class ConsejeriaService {
  constructor(
    private readonly consejeros: ConsejerosRepository,
    private readonly media: MediaService,
  ) {}

  async listar(actor: Actor | null): Promise<ConsejeroCard[]> {
    const filas = await this.consejeros.listar(this.esAdmin(actor))
    return Promise.all(filas.map((fila) => this.aCard(fila)))
  }

  async publicar(
    actor: Actor,
    input: {
      nombre: string
      presentacion: string | null
      rol: string | null
      fotoAssetId: string | null
      contactos: Record<string, string>
      atiendeUrgencias: boolean
      orden: number
    },
  ): Promise<{ id: string }> {
    this.exigirAdmin(actor)
    const fila = await this.consejeros.crear(input)
    return { id: fila.id }
  }

  async editar(
    actor: Actor,
    id: string,
    cambios: {
      nombre?: string | undefined
      presentacion?: string | null | undefined
      rol?: string | null | undefined
      fotoAssetId?: string | null | undefined
      contactos?: Record<string, string> | undefined
      atiendeUrgencias?: boolean | undefined
      orden?: number | undefined
      oculto?: boolean | undefined
    },
  ): Promise<void> {
    this.exigirAdmin(actor)
    const actual = await this.consejeros.porId(id)
    if (!actual) throw new NotFoundException('Ese consejero no existe')
    const { oculto, ...resto } = cambios
    await this.consejeros.editar(id, {
      ...resto,
      ...(oculto === undefined ? {} : { estado: oculto ? 'OCULTO' : 'VISIBLE' }),
    })
  }

  async eliminar(actor: Actor, id: string): Promise<void> {
    this.exigirAdmin(actor)
    await this.consejeros.eliminar(id)
  }

  /**
   * Una foto que no carga no puede dejar fuera a un consejero: lo que importa
   * de esta lista es el teléfono, no el retrato.
   */
  private async aCard(fila: ConsejeroEntity): Promise<ConsejeroCard> {
    return {
      id: fila.id,
      nombre: fila.nombre,
      presentacion: fila.presentacion,
      rol: fila.rol,
      fotoUrl: fila.fotoAssetId
        ? await this.media.urlDeLectura(fila.fotoAssetId, true).catch(() => null)
        : null,
      contactos: fila.contactos,
      atiendeUrgencias: fila.atiendeUrgencias,
      orden: fila.orden,
      oculto: fila.estado === 'OCULTO',
    }
  }

  private esAdmin(actor: Actor | null): boolean {
    return actor?.role === 'ADMIN'
  }

  private exigirAdmin(actor: Actor): void {
    if (!this.esAdmin(actor)) throw new ForbiddenException('Solo un admin administra la consejería')
  }
}
