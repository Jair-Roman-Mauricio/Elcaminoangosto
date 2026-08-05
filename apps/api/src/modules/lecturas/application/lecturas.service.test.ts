import { describe, it, expect, beforeEach } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { LecturasService } from './lecturas.service'
import {
  LecturasRepository,
  type ComentarioDeLecturaEntity,
  type EstadoDePublicacion,
  type LecturaEntity,
  type OracionEntity,
  type TipoDeLectura,
} from '../domain/lecturas.repository'
import type { Actor } from '../../shared'

/* Repos en memoria: prueban las reglas sin base de datos. */

const ADMIN: Actor = { id: 'a1', role: 'ADMIN' }
const VISITANTE: Actor = { id: 'u1', role: 'STUDENT' }

const nuevaLectura = (over: Partial<LecturaEntity> & { id: string }): LecturaEntity => ({
  tipo: 'ARTICULO',
  titulo: 'Cuando la fe se hereda',
  entradilla: null,
  cuerpo: 'Un párrafo cualquiera.',
  seccion: null,
  autor: 'Rafael Román',
  referencia: null,
  portadaAssetId: null,
  estado: 'VISIBLE',
  publishedAt: new Date(),
  createdAt: new Date(),
  ...over,
})

class FakeLecturasRepo extends LecturasRepository {
  filas = new Map<string, LecturaEntity>()
  comentarios = new Map<string, ComentarioDeLecturaEntity>()
  oracionesGuardadas = new Map<string, OracionEntity>()
  /** Cuántos ha escrito una huella en la última hora; lo fija cada prueba. */
  escritosPorHuella = 0

  seed(l: LecturaEntity) {
    this.filas.set(l.id, l)
    return l
  }

  async lecturas(tipo: TipoDeLectura, incluirOcultas: boolean) {
    return [...this.filas.values()].filter(
      (l) => l.tipo === tipo && (incluirOcultas || l.estado === 'VISIBLE'),
    )
  }
  async lectura(id: string, incluirOcultas: boolean) {
    const l = this.filas.get(id)
    if (!l) return null
    return incluirOcultas || l.estado === 'VISIBLE' ? { ...l } : null
  }
  async crearLectura(input: Omit<LecturaEntity, 'id' | 'estado' | 'createdAt'>) {
    const l = nuevaLectura({ id: `l${this.filas.size + 1}`, ...input })
    this.filas.set(l.id, l)
    return { ...l }
  }
  async editarLectura(id: string, cambios: Record<string, unknown>) {
    Object.assign(this.filas.get(id)!, cambios)
  }
  async eliminarLectura(id: string) {
    this.filas.delete(id)
  }
  async relacionadas(input: {
    excluir: string
    tipo: TipoDeLectura
    seccion: string | null
    limite: number
  }) {
    const otras = [...this.filas.values()].filter(
      (l) => l.tipo === input.tipo && l.estado === 'VISIBLE' && l.id !== input.excluir,
    )
    const misma = otras.filter((l) => input.seccion && l.seccion === input.seccion)
    return [...misma, ...otras.filter((l) => !misma.includes(l))].slice(0, input.limite)
  }

  async comentariosDe(lecturaId: string, incluirOcultos: boolean) {
    return [...this.comentarios.values()]
      .filter((c) => c.lecturaId === lecturaId && (incluirOcultos || c.estado === 'VISIBLE'))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
  async comentar(input: { lecturaId: string; cuerpo: string; autorHuella: string }) {
    const c: ComentarioDeLecturaEntity = {
      id: `c${this.comentarios.size + 1}`,
      estado: 'VISIBLE',
      createdAt: new Date(Date.now() + this.comentarios.size),
      ...input,
    }
    this.comentarios.set(c.id, c)
    return { ...c }
  }
  async comentariosDesde() {
    return this.escritosPorHuella
  }
  async cambiarEstadoDeComentario(id: string, estado: EstadoDePublicacion) {
    this.comentarios.get(id)!.estado = estado
  }

  async oraciones(incluirOcultas: boolean) {
    return [...this.oracionesGuardadas.values()].filter(
      (o) => incluirOcultas || o.estado === 'VISIBLE',
    )
  }
  async oracion(id: string) {
    return this.oracionesGuardadas.get(id) ?? null
  }
  async crearOracion(input: Omit<OracionEntity, 'id' | 'estado' | 'createdAt'>) {
    const o: OracionEntity = {
      id: `o${this.oracionesGuardadas.size + 1}`,
      estado: 'VISIBLE',
      createdAt: new Date(),
      ...input,
    }
    this.oracionesGuardadas.set(o.id, o)
    return { ...o }
  }
  async editarOracion(id: string, cambios: Record<string, unknown>) {
    Object.assign(this.oracionesGuardadas.get(id)!, cambios)
  }
  async eliminarOracion(id: string) {
    this.oracionesGuardadas.delete(id)
  }
}

/** El medio firma cualquier cosa salvo los assets que se declaren rotos. */
class FakeMedia {
  rotos = new Set<string>()
  videos = new Set<string>()
  async urlDeLectura(assetId: string) {
    if (this.rotos.has(assetId)) throw new NotFoundException('El medio aún no está listo')
    return `https://media.test/${assetId}`
  }
  async estado(assetId: string) {
    if (this.rotos.has(assetId)) throw new NotFoundException('Ese medio no existe')
    return { kind: this.videos.has(assetId) ? 'VIDEO' : 'IMAGE' }
  }
}

describe('LecturasService', () => {
  let repo: FakeLecturasRepo
  let media: FakeMedia
  let servicio: LecturasService

  beforeEach(() => {
    repo = new FakeLecturasRepo()
    media = new FakeMedia()
    servicio = new LecturasService(repo, media as never)
  })

  describe('leer', () => {
    it('quien no es admin no ve lo oculto', async () => {
      repo.seed(nuevaLectura({ id: 'l1' }))
      repo.seed(nuevaLectura({ id: 'l2', estado: 'OCULTO' }))

      const visibles = await servicio.listar(null, 'ARTICULO')
      const todas = await servicio.listar(ADMIN, 'ARTICULO')

      expect(visibles.map((l) => l.id)).toEqual(['l1'])
      expect(todas.map((l) => l.id)).toEqual(['l1', 'l2'])
    })

    it('los minutos salen del propio texto y nunca son cero', async () => {
      repo.seed(nuevaLectura({ id: 'corto', cuerpo: 'Dos palabras' }))
      repo.seed(
        nuevaLectura({ id: 'largo', cuerpo: Array.from({ length: 900 }, () => 'palabra').join(' ') }),
      )

      const [corto, largo] = await servicio.listar(ADMIN, 'ARTICULO')

      expect(corto!.minutos).toBe(1)
      expect(largo!.minutos).toBe(5)
    })

    it('los minutos no cuentan las marcas ni las imágenes del Markdown', async () => {
      const texto = Array.from({ length: 180 }, () => 'palabra').join(' ')
      repo.seed(nuevaLectura({ id: 'limpio', cuerpo: texto }))
      repo.seed(
        nuevaLectura({
          id: 'ilustrado',
          cuerpo: `## Un subtítulo\n\n![Un pie de foto](https://cdn.test/a.png)\n\n${texto}`,
        }),
      )

      const [limpio, ilustrado] = await servicio.listar(ADMIN, 'ARTICULO')

      expect(ilustrado!.minutos).toBe(limpio!.minutos)
    })

    it('una portada que aún no está lista no tumba el listado', async () => {
      media.rotos.add('rota')
      repo.seed(nuevaLectura({ id: 'l1', portadaAssetId: 'rota' }))

      const [lectura] = await servicio.listar(null, 'ARTICULO')

      expect(lectura!.portadaUrl).toBeNull()
    })

    it('una lectura que no existe da 404', async () => {
      await expect(servicio.ver(null, 'fantasma')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('para seguir leyendo', () => {
    it('prefiere las de la misma sección y nunca se ofrece a sí misma', async () => {
      repo.seed(nuevaLectura({ id: 'actual', seccion: 'Familia' }))
      repo.seed(nuevaLectura({ id: 'suelta-1', seccion: null }))
      repo.seed(nuevaLectura({ id: 'familia-1', seccion: 'Familia' }))
      repo.seed(nuevaLectura({ id: 'suelta-2', seccion: null }))

      const seguir = await servicio.relacionadas(null, 'actual')

      expect(seguir[0]!.id).toBe('familia-1')
      expect(seguir.map((l) => l.id)).not.toContain('actual')
      expect(seguir).toHaveLength(3)
    })

    it('no se inventa nada cuando es la única', async () => {
      repo.seed(nuevaLectura({ id: 'sola' }))
      await expect(servicio.relacionadas(null, 'sola')).resolves.toEqual([])
    })

    it('lo oculto no se ofrece como siguiente lectura', async () => {
      repo.seed(nuevaLectura({ id: 'actual' }))
      repo.seed(nuevaLectura({ id: 'retirada', estado: 'OCULTO' }))
      await expect(servicio.relacionadas(null, 'actual')).resolves.toEqual([])
    })
  })

  describe('publicar', () => {
    it('solo el admin publica', async () => {
      const input = {
        tipo: 'DEVOCIONAL' as const,
        titulo: 'Lo que el dinero no alcanza',
        entradilla: null,
        cuerpo: 'Una historia.',
        seccion: null,
        autor: 'Rafael Román',
        referencia: null,
        portadaAssetId: null,
      }

      await expect(servicio.publicar(VISITANTE, input)).rejects.toBeInstanceOf(ForbiddenException)
      await expect(servicio.publicar(ADMIN, input)).resolves.toHaveProperty('id')
    })

    it('recorta el cuerpo y rechaza un texto vacío', async () => {
      const base = {
        tipo: 'DEVOCIONAL' as const,
        titulo: 'Título',
        entradilla: null,
        seccion: null,
        autor: 'Rafael Román',
        referencia: null,
        portadaAssetId: null,
      }

      const { id } = await servicio.publicar(ADMIN, {
        ...base,
        cuerpo: '  Uno\n\nDos  ',
      })
      expect(repo.filas.get(id)!.cuerpo).toBe('Uno\n\nDos')

      await expect(servicio.publicar(ADMIN, { ...base, cuerpo: '   \n\n ' })).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })
  })

  describe('comentar', () => {
    const escribir = (lecturaId: string, autorId = 'a'.repeat(20)) =>
      servicio.comentar({ lecturaId, cuerpo: 'Gracias por esto', autorId })

    it('un devocional se lee, no se comenta', async () => {
      repo.seed(nuevaLectura({ id: 'd1', tipo: 'DEVOCIONAL' }))
      await expect(escribir('d1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('un artículo admite comentarios sin cuenta', async () => {
      repo.seed(nuevaLectura({ id: 'l1' }))
      await expect(escribir('l1')).resolves.toMatchObject({ mensaje: 'Gracias por esto' })
    })

    it('frena a quien escribe sin parar', async () => {
      repo.seed(nuevaLectura({ id: 'l1' }))
      repo.escritosPorHuella = 20
      await expect(escribir('l1')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('exige un identificador de autor largo: no vale uno inventado a mano', async () => {
      repo.seed(nuevaLectura({ id: 'l1' }))
      await expect(escribir('l1', 'corto')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('los alias se numeran por orden de llegada y no guardan la huella', async () => {
      repo.seed(nuevaLectura({ id: 'l1' }))
      await escribir('l1', 'a'.repeat(20))
      await escribir('l1', 'b'.repeat(20))
      await escribir('l1', 'a'.repeat(20))

      const hilo = await servicio.comentarios(null, 'l1')

      // Se leen del más nuevo al más viejo; el primero en escribir es el 1.
      expect(hilo.map((c) => c.autor)).toEqual(['Caminante 1', 'Caminante 2', 'Caminante 1'])
      expect(JSON.stringify(hilo)).not.toContain('aaaa')
    })
  })

  describe('oraciones', () => {
    const publicar = (marcas: number[] | null, lineas = ['Una.', 'Dos.']) =>
      servicio.publicarOracion(ADMIN, {
        titulo: 'Antes de dormir',
        tema: null,
        lineas,
        marcas,
        audioAssetId: 'audio-1',
        imagenAssetId: null,
        fondoAssetId: null,
      })

    it('sin marcas se publica: la pantalla sabe repartir por longitud', async () => {
      await expect(publicar(null)).resolves.toHaveProperty('id')
    })

    it('las marcas a medias se rechazan antes de guardarse', async () => {
      await expect(publicar([0])).rejects.toBeInstanceOf(BadRequestException)
    })

    it('unas marcas que van hacia atrás se rechazan', async () => {
      await expect(publicar([10, 4])).rejects.toBeInstanceOf(BadRequestException)
    })

    it('el fondo dice si es video, para no meter un mp4 en un <img>', async () => {
      media.videos.add('fondo-video')
      await servicio.publicarOracion(ADMIN, {
        titulo: 'Con video',
        tema: null,
        lineas: ['Una.'],
        marcas: null,
        audioAssetId: 'audio-1',
        imagenAssetId: null,
        fondoAssetId: 'fondo-video',
      })

      const [oracion] = await servicio.oraciones(null)

      expect(oracion!.fondoEsVideo).toBe(true)
      expect(oracion!.fondoUrl).toContain('fondo-video')
    })

    it('una oración sin su voz se queda fuera, pero no se lleva a las demás', async () => {
      media.rotos.add('audio-roto')
      await publicar(null)
      await servicio.publicarOracion(ADMIN, {
        titulo: 'Sin voz',
        tema: null,
        lineas: ['Una.'],
        marcas: null,
        audioAssetId: 'audio-roto',
        imagenAssetId: null,
        fondoAssetId: null,
      })

      const lista = await servicio.oraciones(null)

      expect(lista.map((o) => o.titulo)).toEqual(['Antes de dormir'])
    })
  })
})
