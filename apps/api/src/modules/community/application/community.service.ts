import { createHash } from 'node:crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CommunityRepository,
  type HiloResumen,
  type RespuestaEntity,
} from '../domain/community.repository'
import type { Actor } from '../../shared'

/** Un hilo tal como lo consume la interfaz: con alias, nunca con la huella. */
export interface HiloDetalle {
  id: string
  titulo: string
  cuerpo: string
  autor: string
  createdAt: string
  oculto: boolean
  respuestas: {
    id: string
    cuerpo: string
    autor: string
    createdAt: string
    oculto: boolean
  }[]
}

/**
 * API pública del bounded context `community`.
 *
 * Hilos abiertos sin cuentas. Quien escribe manda un identificador aleatorio
 * que su navegador guarda; aquí solo se maneja su huella, y ni siquiera esa
 * sale hacia la interfaz: se traduce a un alias dentro del hilo. Publicarla
 * permitiría cruzar lo que una misma persona escribió en hilos distintos, que
 * es justo lo que el anonimato debe impedir.
 */
@Injectable()
export class CommunityService {
  /** Cuántas publicaciones puede hacer una persona por hora. */
  private static readonly LIMITE_POR_HORA = 15
  private static readonly LIMITE_LISTADO = 50

  constructor(private readonly comunidad: CommunityRepository) {}

  async listarHilos(
    actor: Actor | null,
    input: { busqueda?: string | null; limite?: number },
  ): Promise<HiloResumen[]> {
    return this.comunidad.listarHilos({
      busqueda: input.busqueda?.trim() || null,
      limite: Math.min(input.limite ?? CommunityService.LIMITE_LISTADO, CommunityService.LIMITE_LISTADO),
      incluirOcultos: this.esAdmin(actor),
    })
  }

  async verHilo(actor: Actor | null, id: string): Promise<HiloDetalle> {
    const admin = this.esAdmin(actor)
    const hilo = await this.comunidad.buscarHilo(id, admin)
    if (!hilo) throw new NotFoundException('Ese hilo no existe')

    const respuestas = await this.comunidad.respuestasDe(id, admin)
    const alias = this.aliasDelHilo(hilo.autorHuella, respuestas)

    return {
      id: hilo.id,
      titulo: hilo.titulo,
      cuerpo: hilo.cuerpo,
      autor: alias.get(hilo.autorHuella)!,
      createdAt: hilo.createdAt.toISOString(),
      oculto: hilo.estado === 'OCULTO',
      respuestas: respuestas.map((r) => ({
        id: r.id,
        cuerpo: r.cuerpo,
        autor: alias.get(r.autorHuella)!,
        createdAt: r.createdAt.toISOString(),
        oculto: r.estado === 'OCULTO',
      })),
    }
  }

  async abrirHilo(input: {
    titulo: string
    cuerpo: string
    autorId: string
  }): Promise<{ id: string }> {
    const huella = await this.huellaConLimite(input.autorId)
    const hilo = await this.comunidad.crearHilo({
      titulo: this.exigirTexto(input.titulo, 5, 140, 'El título'),
      cuerpo: this.exigirTexto(input.cuerpo, 10, 5000, 'El mensaje'),
      autorHuella: huella,
    })
    return { id: hilo.id }
  }

  async responder(input: {
    hiloId: string
    cuerpo: string
    autorId: string
  }): Promise<{ id: string }> {
    const hilo = await this.comunidad.buscarHilo(input.hiloId, false)
    if (!hilo) throw new NotFoundException('Ese hilo no existe')

    const huella = await this.huellaConLimite(input.autorId)
    const respuesta = await this.comunidad.responder({
      hiloId: input.hiloId,
      cuerpo: this.exigirTexto(input.cuerpo, 2, 5000, 'La respuesta'),
      autorHuella: huella,
    })
    return { id: respuesta.id }
  }

  // ── Moderación (solo ADMIN) ───────────────────────────────────────────────

  async ocultarHilo(actor: Actor, id: string, oculto: boolean): Promise<void> {
    this.exigirAdmin(actor)
    await this.comunidad.cambiarEstadoDeHilo(id, oculto ? 'OCULTO' : 'VISIBLE')
  }

  async ocultarRespuesta(actor: Actor, id: string, oculta: boolean): Promise<void> {
    this.exigirAdmin(actor)
    await this.comunidad.cambiarEstadoDeRespuesta(id, oculta ? 'OCULTO' : 'VISIBLE')
  }

  async eliminarHilo(actor: Actor, id: string): Promise<void> {
    this.exigirAdmin(actor)
    await this.comunidad.eliminarHilo(id)
  }

  // ── Interioridades ────────────────────────────────────────────────────────

  /**
   * Alias por hilo: «Caminante 1», «Caminante 2»… en orden de aparición.
   *
   * Se calcula al leer y no se guarda, así que la misma persona lleva números
   * distintos en hilos distintos. Es lo que permite seguir una conversación de
   * ida y vuelta sin convertir el anonimato en un seudónimo perseguible.
   */
  private aliasDelHilo(autorDelHilo: string, respuestas: RespuestaEntity[]): Map<string, string> {
    const alias = new Map<string, string>()
    alias.set(autorDelHilo, 'Caminante 1')
    for (const respuesta of respuestas) {
      if (!alias.has(respuesta.autorHuella)) {
        alias.set(respuesta.autorHuella, `Caminante ${alias.size + 1}`)
      }
    }
    return alias
  }

  /**
   * Huella del identificador del autor, tras comprobar su límite.
   *
   * El límite es por persona y por hora, y cuenta hilos y respuestas juntos:
   * quien quiera inundar el foro lo hará igual por un lado que por el otro. No
   * frena a quien decida borrar sus datos del navegador y volver, pero sí el
   * caso normal, que es un guion dejado corriendo.
   */
  private async huellaConLimite(autorId: string): Promise<string> {
    const limpio = autorId.trim()
    if (limpio.length < 16) throw new BadRequestException('Identificador de autor inválido')

    const huella = createHash('sha256').update(limpio).digest('hex')
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000)
    if ((await this.comunidad.publicacionesDesde(huella, haceUnaHora)) >= CommunityService.LIMITE_POR_HORA) {
      throw new ForbiddenException(
        'Has publicado mucho en poco tiempo. Espera un momento antes de volver a escribir.',
      )
    }
    return huella
  }

  private exigirTexto(valor: string, minimo: number, maximo: number, que: string): string {
    const texto = valor.trim()
    if (texto.length < minimo) throw new BadRequestException(`${que} es demasiado corto`)
    if (texto.length > maximo) throw new BadRequestException(`${que} es demasiado largo`)
    return texto
  }

  private esAdmin(actor: Actor | null): boolean {
    return actor?.role === 'ADMIN'
  }

  private exigirAdmin(actor: Actor): void {
    if (!this.esAdmin(actor)) throw new ForbiddenException('Solo un admin modera la comunidad')
  }
}
