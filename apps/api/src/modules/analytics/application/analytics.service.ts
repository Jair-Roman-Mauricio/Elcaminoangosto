import { ForbiddenException, Injectable } from '@nestjs/common'
import {
  AnalyticsRepository,
  type AlbumMasEscuchado,
  type ContenidoMasVisto,
  type FlujoDeVisitantes,
  type OrdenDeRanking,
  type TipoDeContenido,
} from '../domain/analytics.repository'
import type { Actor } from '../../shared'

/** Cuántas piezas devuelve un ranking si no se pide otra cosa. */
const LIMITE_POR_DEFECTO = 20

/**
 * API pública del bounded context `analytics`.
 *
 * Mide qué se ve y quién entra, con una regla: nunca IP ni huella. La unidad
 * es un identificador ALEATORIO de sesión de navegador que el cliente genera y
 * olvida al cerrar (RNF-9). Sirve para no confundir a una persona que vuelve
 * diez veces con diez personas, y para nada más.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly analytics: AnalyticsRepository) {}

  /**
   * Registra una vista. Lo llama cualquiera, con o sin cuenta: es la única
   * forma de medir a quien todavía no se ha registrado.
   */
  async registrarVista(input: {
    kind: TipoDeContenido
    contentId: string
    viewerId: string | null
    sessionId: string
  }): Promise<void> {
    await this.analytics.registrarVista(input)
  }

  async registrarVisita(input: {
    section: string
    viewerId: string | null
    sessionId: string
  }): Promise<void> {
    await this.analytics.registrarVisita(input)
  }

  // ── Informes (solo ADMIN) ─────────────────────────────────────────────────

  async masVistos(
    actor: Actor,
    input: {
      kind: TipoDeContenido
      dias: number
      busqueda?: string | null
      orden?: OrdenDeRanking
      limite?: number
    },
  ): Promise<ContenidoMasVisto[]> {
    this.exigirAdmin(actor)
    return this.analytics.masVistos({
      kind: input.kind,
      desde: this.desde(input.dias),
      busqueda: input.busqueda?.trim() || null,
      orden: input.orden ?? 'vistas',
      limite: input.limite ?? LIMITE_POR_DEFECTO,
    })
  }

  async albumesMasEscuchados(
    actor: Actor,
    input: { dias: number; busqueda?: string | null; limite?: number },
  ): Promise<AlbumMasEscuchado[]> {
    this.exigirAdmin(actor)
    return this.analytics.albumesMasEscuchados({
      desde: this.desde(input.dias),
      busqueda: input.busqueda?.trim() || null,
      limite: input.limite ?? LIMITE_POR_DEFECTO,
    })
  }

  async flujoDeVisitantes(actor: Actor, dias: number): Promise<FlujoDeVisitantes> {
    this.exigirAdmin(actor)
    return this.analytics.flujoDeVisitantes(this.desde(dias))
  }

  /** Comienzo del periodo: hoy menos `dias`, a medianoche. */
  private desde(dias: number): Date {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - dias)
    fecha.setHours(0, 0, 0, 0)
    return fecha
  }

  private exigirAdmin(actor: Actor): void {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un admin consulta las estadísticas')
    }
  }
}
