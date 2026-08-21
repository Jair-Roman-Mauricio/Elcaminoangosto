import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, ilike, isNull, sql, type SQL } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import {
  albums,
  contentViews,
  lecturas,
  oracionesGuiadas,
  posts,
  siteVisits,
  songs,
  videos,
} from '../../shared/database/schema'
import {
  AnalyticsRepository,
  type AlbumMasEscuchado,
  type ContenidoMasVisto,
  type FlujoDeVisitantes,
  type OrdenDeRanking,
  type TipoDeContenido,
} from '../domain/analytics.repository'

/**
 * Los informes miden al PÚBLICO, no a la casa.
 *
 * `viewer_id` solo se rellena cuando quien mira tiene sesión iniciada, y hoy la
 * única cuenta que existe es la de administración. Esas filas son el admin
 * revisando su propia plataforma: contarlas inflaba cada número sin que se
 * notara. Se descuentan en todos los informes; el registro sigue guardándolas
 * por si algún día vuelve a haber cuentas.
 */
const soloPublico = {
  visitas: isNull(siteVisits.viewerId),
  contenido: isNull(contentViews.viewerId),
}

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
   * El ranking se calcula sobre `content_views` unido a su contenido.
   *
   * La unión es INTERNA a propósito: lo que ya no existe no se cuenta. Antes
   * era externa y las piezas borradas seguían apareciendo como «Contenido
   * eliminado» con sus vistas intactas, así que el ranking mezclaba lo que se
   * puede volver a ver con lo que ya no está. Para decidir qué publicar, una
   * fila que no se puede abrir es ruido.
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
      soloPublico.contenido,
    ]
    if (input.busqueda) filtros.push(ilike(titulo, `%${input.busqueda}%`))

    return this.db
      .select({
        contentId: contentViews.contentId,
        titulo: sql<string>`${titulo}`,
        contexto: sql<string | null>`${contexto}`,
        vistas: sql<number>`count(*)`.mapWith(Number),
        visitantes: sql<number>`count(distinct ${contentViews.sessionId})`.mapWith(Number),
        // `mapWith` no es adorno: sin él, una expresión cruda devuelve lo que
        // el driver quiera —`pg` entrega la marca de tiempo como texto— y este
        // campo dejaría de ser la fecha que promete el tipo. Se reutiliza el
        // mapeo de la propia columna, que sí sabe convertirla.
        ultimaVista: sql<Date | null>`max(${contentViews.createdAt})`.mapWith(
          contentViews.createdAt,
        ),
      })
      .from(contentViews)
      .innerJoin(tabla, eq(tabla.id, contentViews.contentId))
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
      soloPublico.contenido,
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
    const enPeriodo = and(gte(siteVisits.createdAt, desde), soloPublico.visitas)

    const [resumen] = await this.db
      .select({
        visitantes: sql<number>`count(distinct ${siteVisits.sessionId})`.mapWith(Number),
        visitas: sql<number>`count(*)`.mapWith(Number),
      })
      .from(siteVisits)
      .where(enPeriodo)

    // Las vistas de contenido viven en otra tabla: se cuentan aparte y no se
    // suman a las visitas, que miden entrar a una sección, no abrir una pieza.
    //
    // Solo cuentan las de piezas que siguen existiendo, igual que en los
    // rankings: si una fila no se puede abrir, no dice nada de lo que hay hoy.
    const [contenido] = await this.db
      .select({ vistas: sql<number>`count(*)`.mapWith(Number) })
      .from(contentViews)
      .where(
        and(
          gte(contentViews.createdAt, desde),
          soloPublico.contenido,
          sql`(
            exists (select 1 from ${videos} v where v.id = ${contentViews.contentId})
            or exists (select 1 from ${posts} p where p.id = ${contentViews.contentId})
            or exists (select 1 from ${songs} s where s.id = ${contentViews.contentId})
            or exists (select 1 from ${lecturas} l where l.id = ${contentViews.contentId})
            or exists (select 1 from ${oracionesGuiadas} o where o.id = ${contentViews.contentId})
          )`,
        ),
      )

    const porDia = await this.db
      .select({
        dia: sql<string>`to_char(date_trunc('day', ${siteVisits.createdAt}), 'YYYY-MM-DD')`,
        visitantes: sql<number>`count(distinct ${siteVisits.sessionId})`.mapWith(Number),
        visitas: sql<number>`count(*)`.mapWith(Number),
      })
      .from(siteVisits)
      .where(enPeriodo)
      .groupBy(sql`date_trunc('day', ${siteVisits.createdAt})`)
      .orderBy(sql`date_trunc('day', ${siteVisits.createdAt})`)

    const porSeccion = await this.db
      .select({
        seccion: siteVisits.section,
        visitas: sql<number>`count(*)`.mapWith(Number),
        visitantes: sql<number>`count(distinct ${siteVisits.sessionId})`.mapWith(Number),
      })
      .from(siteVisits)
      .where(enPeriodo)
      .groupBy(siteVisits.section)
      .orderBy(desc(sql`count(*)`))

    return {
      visitantes: resumen?.visitantes ?? 0,
      visitas: resumen?.visitas ?? 0,
      vistasDeContenido: contenido?.vistas ?? 0,
      porDia,
      porSeccion,
    }
  }

  /** De dónde sale el título de cada tipo de contenido. */
  private fuenteDe(kind: TipoDeContenido) {
    if (kind === 'VIDEO') return { titulo: videos.title, contexto: videos.series, tabla: videos }
    if (kind === 'SONG') return { titulo: songs.title, contexto: songs.subtitle, tabla: songs }
    // El contexto de una lectura es su tipo: distingue un devocional de un
    // artículo sin necesidad de partir el ranking en dos.
    if (kind === 'LECTURA') {
      return {
        titulo: lecturas.titulo,
        contexto: sql<string>`case when ${lecturas.tipo} = 'ARTICULO' then 'Revista' else 'Devocional' end`,
        tabla: lecturas,
      }
    }
    if (kind === 'ORACION') {
      return {
        titulo: oracionesGuiadas.titulo,
        contexto: oracionesGuiadas.tema,
        tabla: oracionesGuiadas,
      }
    }
    // Una tarjeta puede no tener título: se cae al texto breve.
    return { titulo: sql<string>`coalesce(${posts.title}, ${posts.caption})`, contexto: posts.manifesto, tabla: posts }
  }
}
