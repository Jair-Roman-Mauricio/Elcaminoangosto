import { describe, it, expect, beforeEach } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { CommunityService } from './community.service'
import {
  CommunityRepository,
  type HiloEntity,
  type HiloResumen,
  type RespuestaEntity,
} from '../domain/community.repository'

/** Comunidad en memoria. Conserva el orden de llegada, que decide los alias. */
class FakeComunidad extends CommunityRepository {
  hilos: HiloEntity[] = []
  respuestas: RespuestaEntity[] = []

  async listarHilos({ busqueda, limite, incluirOcultos }: {
    busqueda: string | null
    limite: number
    incluirOcultos: boolean
  }): Promise<HiloResumen[]> {
    return this.hilos
      .filter((h) => (incluirOcultos ? true : h.estado === 'VISIBLE'))
      .filter((h) => (busqueda ? h.titulo.includes(busqueda) || h.cuerpo.includes(busqueda) : true))
      .slice(0, limite)
  }

  async buscarHilo(id: string, incluirOcultos: boolean) {
    const hilo = this.hilos.find((h) => h.id === id)
    if (!hilo) return null
    return incluirOcultos || hilo.estado === 'VISIBLE' ? hilo : null
  }

  async respuestasDe(hiloId: string, incluirOcultas: boolean) {
    return this.respuestas.filter(
      (r) => r.hiloId === hiloId && (incluirOcultas || r.estado === 'VISIBLE'),
    )
  }

  async crearHilo(input: { titulo: string; cuerpo: string; autorHuella: string }) {
    const hilo: HiloEntity = {
      id: `h${this.hilos.length + 1}`,
      ...input,
      estado: 'VISIBLE',
      respuestas: 0,
      ultimaActividad: new Date(),
      createdAt: new Date(),
    }
    this.hilos.push(hilo)
    return hilo
  }

  async responder(input: { hiloId: string; cuerpo: string; autorHuella: string }) {
    const respuesta: RespuestaEntity = {
      id: `r${this.respuestas.length + 1}`,
      ...input,
      estado: 'VISIBLE',
      createdAt: new Date(),
    }
    this.respuestas.push(respuesta)
    return respuesta
  }

  async publicacionesDesde(autorHuella: string) {
    return (
      this.hilos.filter((h) => h.autorHuella === autorHuella).length +
      this.respuestas.filter((r) => r.autorHuella === autorHuella).length
    )
  }

  async cambiarEstadoDeHilo(id: string, estado: 'VISIBLE' | 'OCULTO') {
    const hilo = this.hilos.find((h) => h.id === id)
    if (hilo) hilo.estado = estado
  }

  async cambiarEstadoDeRespuesta(id: string, estado: 'VISIBLE' | 'OCULTO') {
    const respuesta = this.respuestas.find((r) => r.id === id)
    if (respuesta) respuesta.estado = estado
  }

  async eliminarHilo(id: string) {
    this.hilos = this.hilos.filter((h) => h.id !== id)
    this.respuestas = this.respuestas.filter((r) => r.hiloId !== id)
  }
}

const ANA = 'autor-ana-0123456789'
const BETO = 'autor-beto-0123456789'
const admin = { id: 'a1', role: 'ADMIN' as const }

let repo: FakeComunidad
let svc: CommunityService

beforeEach(() => {
  repo = new FakeComunidad()
  svc = new CommunityService(repo)
})

describe('escribir en la comunidad', () => {
  it('abrir un hilo y responderlo', async () => {
    const { id } = await svc.abrirHilo({
      titulo: '¿Cómo oran ustedes?',
      cuerpo: 'Llevo un tiempo buscando una forma de orar por las mañanas.',
      autorId: ANA,
    })
    await svc.responder({ hiloId: id, cuerpo: 'Yo empiezo leyendo un salmo.', autorId: BETO })

    const hilo = await svc.verHilo(null, id)
    expect(hilo.titulo).toBe('¿Cómo oran ustedes?')
    expect(hilo.respuestas).toHaveLength(1)
  })

  it('un título demasiado corto se rechaza', async () => {
    await expect(
      svc.abrirHilo({ titulo: 'Hey', cuerpo: 'Un cuerpo bastante largo.', autorId: ANA }),
    ).rejects.toThrow(BadRequestException)
  })

  it('no se responde a un hilo que no existe', async () => {
    await expect(
      svc.responder({ hiloId: 'fantasma', cuerpo: 'Hola', autorId: ANA }),
    ).rejects.toThrow(NotFoundException)
  })

  it('un identificador de autor corto no vale', async () => {
    await expect(
      svc.abrirHilo({ titulo: 'Un título válido', cuerpo: 'Un cuerpo válido y largo.', autorId: 'x' }),
    ).rejects.toThrow(BadRequestException)
  })

  it('publicar sin freno se corta al llegar al límite', async () => {
    const { id } = await svc.abrirHilo({
      titulo: 'Un hilo cualquiera',
      cuerpo: 'Con su cuerpo correspondiente.',
      autorId: ANA,
    })
    // Ya lleva 1; el límite son 15 por hora entre hilos y respuestas.
    for (let i = 0; i < 14; i += 1) {
      await svc.responder({ hiloId: id, cuerpo: `Mensaje ${i}`, autorId: ANA })
    }

    await expect(
      svc.responder({ hiloId: id, cuerpo: 'Una más', autorId: ANA }),
    ).rejects.toThrow(ForbiddenException)
  })
})

describe('anonimato con alias', () => {
  it('cada persona recibe un alias por orden de aparición', async () => {
    const { id } = await svc.abrirHilo({
      titulo: 'Una pregunta abierta',
      cuerpo: 'El cuerpo de la pregunta, con longitud suficiente.',
      autorId: ANA,
    })
    await svc.responder({ hiloId: id, cuerpo: 'Respondo yo.', autorId: BETO })
    await svc.responder({ hiloId: id, cuerpo: 'Y vuelvo a hablar.', autorId: ANA })

    const hilo = await svc.verHilo(null, id)
    expect(hilo.autor).toBe('Caminante 1')
    expect(hilo.respuestas.map((r) => r.autor)).toEqual(['Caminante 2', 'Caminante 1'])
  })

  it('la huella del autor nunca sale hacia la interfaz', async () => {
    const { id } = await svc.abrirHilo({
      titulo: 'Otro hilo abierto',
      cuerpo: 'Cuerpo con longitud suficiente para pasar.',
      autorId: ANA,
    })

    const hilo = await svc.verHilo(null, id)
    expect(JSON.stringify(hilo)).not.toContain(ANA)
    expect(Object.keys(hilo)).not.toContain('autorHuella')
  })
})

describe('moderación', () => {
  it('un hilo oculto desaparece para el visitante y sigue para el admin', async () => {
    const { id } = await svc.abrirHilo({
      titulo: 'Un hilo que se ocultará',
      cuerpo: 'Cuerpo con longitud suficiente.',
      autorId: ANA,
    })
    await svc.ocultarHilo(admin, id, true)

    await expect(svc.verHilo(null, id)).rejects.toThrow(NotFoundException)
    await expect(svc.verHilo(admin, id)).resolves.toMatchObject({ oculto: true })
    expect(await svc.listarHilos(null, {})).toHaveLength(0)
    expect(await svc.listarHilos(admin, {})).toHaveLength(1)
  })

  it('quien no es admin no modera', async () => {
    const visitante = { id: 'v1', role: 'ESTUDIANTE' as const }
    await expect(svc.ocultarHilo(visitante, 'h1', true)).rejects.toThrow(ForbiddenException)
    await expect(svc.eliminarHilo(visitante, 'h1')).rejects.toThrow(ForbiddenException)
  })
})
