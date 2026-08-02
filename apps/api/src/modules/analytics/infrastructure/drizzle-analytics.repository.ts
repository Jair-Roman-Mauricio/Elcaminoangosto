import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, ilike, sql, type SQL } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { albums, contentViews, posts, siteVisits, songs, videos } from '../../shared/database/schema'
import {
  AnalyticsRepository,
  type AlbumMasEscuchado,
  type ContenidoMasVisto,
  type FlujoDeVisitantes,
  type OrdenDeRanking,
  type TipoDeContenido,
} from '../domain/analytics.repository'

@Injectable()
export class DrizzleAnalyticsRepository extends AnalyticsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async registrarVista(input: {
    kind: TipoDeContenido
    contentId: string
    viewerId: string | null
    sessionId: string
  }): Promise<void> {
    await this.db.insert(contentViews).values(input)
  }

  async registrarVisita(input: {
    section: string
    viewerId: string | null
    sessionId: string
  }): Promise<void> {
    await this.db.insert(siteVisits).values(input)
  }

  /**
   * El ranking se calcula sobre `content_views` y se une al contenido solo para
   * darle nombre. Así una pieza borrada no desaparece del histórico: aparece
   * sin título en vez de falsear el total.
   */
  async masVistos(input: {
    kind: TipoDeContenido
    desde: Date
    busqueda: string | null
    orden: OrdenDeRanking
    limite: number
  }): Promise<ContenidoMasVisto[]> {
    const { titulo, contexto, tabla } = this.fuenteDe(input.kind)

    const filtros: SQL[] = [
      eq(contentViews.kind, input.kind),
      gte(contentViews.createdAt, input.desde),
    ]
    if (input.busqueda) filtros.push(ilike(titulo, `%${input.busqueda}%`))

    return this.db
      .select({
        contentId: contentViews.contentId,
        titulo: sql<string>`coalesce(${titulo}, 'Contenido eliminado')`,
        contexto: sql<string | null>`${contexto}`,
        vistas: sql<number>`count(*)`.mapWith(Number),
        visitantes: sql<number>`count(distinct ${contentViews.sessionId})`.mapWith(Number),
        ultimaVista: sql<Date | null>`max(${contentViews.createdAt})`,
      })
      .from(contentViews)
      .leftJoin(tabla, eq(tabla.id, contentViews.contentId))
      .where(and(...filtros))
      .groupBy(contentViews.contentId, titulo, contexto)
      .orderBy(
        desc(
          input.orden === 'visitantes'
            ? sql`count(distinct ${contentViews.sessionId})`
            : sql`count(*)`,
        ),
      )
      .limit(input.limite)
  }

  async albumesMasEscuchados(input: {
    desde: Date
    busqueda: string | null
    limite: number
  }): Promise<AlbumMasEscuchado[]> {
    const filtros: SQL[] = [
      eq(contentViews.kind, 'SONG'),
      gte(contentViews.createdAt, input.desde),
    ]
    if (input.busqueda) filtros.push(ilike(albums.title, `%${input.busqueda}%`))

    return this.db
      .select({
        albumId: albums.id,
        titulo: albums.title,
        numero: albums.number,
        escuchas: sql<number>`count(${contentViews.id})`.mapWith(Number),
        canciones: sql<number>`count(distinct ${songs.id})`.mapWith(Number),
      })
      .from(contentViews)
      .innerJoin(songs, eq(songs.id, contentViews.contentId))
      .innerJoin(albums, eq(albums.id, songs.albumId))
      .where(and(...filtros))
      .groupBy(albums.id, albums.title, albums.number)
      .orderBy(desc(sql`count(${contentViews.id})`))
      .limit(input.limite)
  }

  async flujoDeVisitantes(desde: Date): Promise<FlujoDeVisitantes> {
    // Una sesión cuenta como registrada en cuanto aparece con `viewer_id`; el
    // resto del tiempo es anónima. Por eso se agrupa por sesión primero.
    const porSesion = this.db.$with('por_sesion').as(
      this.db
        .select({
          sessionId: siteVisits.sessionId,
          conCuenta: sql<boolean>`bool_or(${siteVisits.viewerId} is not null)`.as('con_cuenta'),
          sinCuenta: sql<boolean>`bool_or(${siteVisits.viewerId} is null)`.as('sin_cuenta'),
        })
        .from(siteVisits)
        .where(gte(siteVisits.createdAt, desde))
        .groupBy(siteVisits.sessionId),
    )

    const [resumen] = await this.db
      .with(porSesion)
      .select({
        visitantesAnonimos: sql<number>`count(*) filter (where ${porSesion.conCuenta} = false)`.mapWith(Number),
        visitantesRegistrados: sql<number>`count(*) filter (where ${porSesion.conCuenta})`.mapWith(Number),
        sesionesQueSeRegistraron: sql<number>`count(*) filter (where ${porSesion.conCuenta} and ${porSesion.sinCuenta})`.mapWith(Number),
      })
      .from(porSesion)

    const porDia = await this.db
      .select({
        dia: sql<string>`to_char(date_trunc('day', ${siteVisits.createdAt}), 'YYYY-MM-DD')`,
        anonimos: sql<number>`count(distinct ${siteVisits.sessionId}) filter (where ${siteVisits.viewerId} is null)`.mapWith(Number),
        registrados: sql<number>`count(distinct ${siteVisits.sessionId}) filter (where ${siteVisits.viewerId} is not null)`.mapWith(Number),
      })
      .from(siteVisits)
      .where(gte(siteVisits.createdAt, desde))
      .groupBy(sql`date_trunc('day', ${siteVisits.createdAt})`)
      .orderBy(sql`date_trunc('day', ${siteVisits.createdAt})`)

    const porSeccion = await this.db
      .select({
        seccion: siteVisits.section,
        visitas: sql<number>`count(*)`.mapWith(Number),
        anonimos: sql<number>`count(distinct ${siteVisits.sessionId}) filter (where ${siteVisits.viewerId} is null)`.mapWith(Number),
      })
      .from(siteVisits)
      .where(gte(siteVisits.createdAt, desde))
      .groupBy(siteVisits.section)
      .orderBy(desc(sql`count(*)`))

    return {
      visitantesAnonimos: resumen?.visitantesAnonimos ?? 0,
      visitantesRegistrados: resumen?.visitantesRegistrados ?? 0,
      sesionesQueSeRegistraron: resumen?.sesionesQueSeRegistraron ?? 0,
      porDia,
      porSeccion,
    }
  }

  /** De dónde sale el título de cada tipo de contenido. */
  private fuenteDe(kind: TipoDeContenido) {
    if (kind === 'VIDEO') return { titulo: videos.title, contexto: videos.series, tabla: videos }
    if (kind === 'SONG') return { titulo: songs.title, contexto: songs.subtitle, tabla: songs }
    // Una tarjeta puede no tener título: se cae al texto breve.
    return { titulo: sql<string>`coalesce(${posts.title}, ${posts.caption})`, contexto: posts.manifesto, tabla: posts }
  }
}
