import { describe, it, expect, beforeEach } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { MusicService } from './music.service'
import {
  ColeccionRepository,
  MusicRepository,
  type AlbumEntity,
  type ArtistEntity,
  type SongEntity,
} from '../domain/music.repository'

/* Repos en memoria: prueban las reglas sin base de datos. */

const nuevaCancion = (over: Partial<SongEntity> & { id: string }): SongEntity => ({
  albumId: 'al1',
  artistId: 'ar1',
  artistName: 'Opus33',
  title: 'Gracia que me encontró',
  subtitle: null,
  trackNumber: 1,
  audioAssetId: `audio-${over.id}`,
  durationSeconds: 180,
  isPublished: false,
  tone: 'vino',
  backgroundUrl: null,
  backgroundAssetId: null,
  backgroundType: null,
  subtitlesSrt: null,
  ...over,
})

class FakeMusicRepo extends MusicRepository {
  artistas = new Map<string, ArtistEntity>([['ar1', { id: 'ar1', name: 'Opus33' }]])
  albumes = new Map<string, AlbumEntity>([
    [
      'al1',
      {
        id: 'al1',
        artistId: 'ar1',
        artistName: 'Opus33',
        title: 'Himnos de gracia',
        number: 'A01',
        description: null,
        coverImageUrl: 'https://portada/a01.webp',
        tone: 'vino',
        discColor: '#111114',
      },
    ],
  ])
  canciones = new Map<string, SongEntity>()
  borradas: string[] = []
  albumesBorrados: string[] = []

  seed(c: SongEntity) {
    this.canciones.set(c.id, c)
    return c
  }
  async findArtists() {
    return [...this.artistas.values()]
  }
  async findOrCreateArtist(name: string) {
    const existente = [...this.artistas.values()].find((a) => a.name === name)
    if (existente) return existente
    const artista = { id: `ar${this.artistas.size + 1}`, name }
    this.artistas.set(artista.id, artista)
    return artista
  }
  async findAlbums() {
    return [...this.albumes.values()]
  }
  async findAlbumById(id: string) {
    return this.albumes.get(id) ?? null
  }
  async createAlbum(input: Parameters<MusicRepository['createAlbum']>[0]) {
    const album: AlbumEntity = {
      id: `al${this.albumes.size + 1}`,
      artistName: this.artistas.get(input.artistId)?.name ?? '',
      ...input,
    }
    this.albumes.set(album.id, album)
    return album
  }
  async updateAlbum(id: string, cambios: Parameters<MusicRepository['updateAlbum']>[1]) {
    const album = this.albumes.get(id)!
    Object.assign(album, cambios)
    return { ...album }
  }
  async removeAlbum(id: string) {
    this.albumesBorrados.push(id)
    this.albumes.delete(id)
  }
  async countSongsInAlbum(albumId: string) {
    return [...this.canciones.values()].filter((c) => c.albumId === albumId).length
  }
  async findPublishedSongs() {
    return [...this.canciones.values()].filter((c) => c.isPublished)
  }
  async findAllSongs() {
    return [...this.canciones.values()]
  }
  async findSongById(id: string) {
    const c = this.canciones.get(id)
    return c ? { ...c } : null
  }
  async createSong(input: Parameters<MusicRepository['createSong']>[0]) {
    const cancion = nuevaCancion({
      id: `s${this.canciones.size + 1}`,
      ...input,
      artistName: this.artistas.get(input.artistId)?.name ?? '',
      isPublished: false,
    })
    this.canciones.set(cancion.id, cancion)
    return { ...cancion }
  }
  async setSongPublished(id: string, isPublished: boolean) {
    const c = this.canciones.get(id)!
    c.isPublished = isPublished
    return { ...c }
  }
  async removeSong(id: string) {
    this.borradas.push(id)
    this.canciones.delete(id)
  }
}

/** Colecciones en memoria, indexadas por la huella del código. */
class FakeColeccionRepo extends ColeccionRepository {
  porHuella = new Map<string, string>()
  favoritas = new Map<string, Set<string>>()
  albumes = new Map<
    string,
    { albumId: string; titulo: string; coverUrl: string | null; songIds: string[]; coleccion: string }
  >()

  async buscarPorHuella(huella: string) {
    return this.porHuella.get(huella) ?? null
  }
  async crear(huella: string) {
    if (this.porHuella.has(huella)) return null
    const id = `c${this.porHuella.size + 1}`
    this.porHuella.set(huella, id)
    return id
  }
  async contenido(coleccionId: string) {
    return {
      cancionesFavoritas: [...(this.favoritas.get(coleccionId) ?? [])],
      albumesPersonales: [...this.albumes.values()]
        .filter((a) => a.coleccion === coleccionId)
        .map(({ coleccion: _c, ...album }) => album),
    }
  }
  async marcarCancion(coleccionId: string, songId: string, favorita: boolean) {
    const set = this.favoritas.get(coleccionId) ?? new Set<string>()
    if (favorita) set.add(songId)
    else set.delete(songId)
    this.favoritas.set(coleccionId, set)
  }
  async crearAlbum(coleccionId: string, titulo: string) {
    const album = {
      albumId: `p${this.albumes.size + 1}`,
      titulo,
      coverUrl: null,
      songIds: [],
      coleccion: coleccionId,
    }
    this.albumes.set(album.albumId, album)
    const { coleccion: _c, ...sinColeccion } = album
    return sinColeccion
  }
  async actualizarAlbum(
    _coleccionId: string,
    albumId: string,
    cambios: { titulo: string; coverUrl: string | null; songIds: string[] },
  ) {
    Object.assign(this.albumes.get(albumId)!, cambios)
    return { albumId, ...cambios }
  }
  async eliminarAlbum(_coleccionId: string, albumId: string) {
    this.albumes.delete(albumId)
  }
  async esDe(coleccionId: string, albumId: string) {
    return this.albumes.get(albumId)?.coleccion === coleccionId
  }
}

/** Fake de MediaService: firma el audio y registra lo eliminado. */
class FakeMedia {
  eliminados: string[] = []
  assets = new Map<string, { ownerId: string; kind: string }>()

  async estado(assetId: string) {
    const asset = this.assets.get(assetId)
    if (!asset) throw new NotFoundException('Medio no encontrado')
    return asset
  }
  async eliminar(assetId: string) {
    this.eliminados.push(assetId)
  }
  async urlDeOrigen(assetId: string) {
    return `https://firmada/${assetId}.mp3`
  }
}

const admin = { id: 'a1', role: 'ADMIN' as const }
const maestro = { id: 'm1', role: 'MAESTRO' as const }

let music: FakeMusicRepo
let media: FakeMedia
let colecciones: FakeColeccionRepo
let svc: MusicService

beforeEach(() => {
  music = new FakeMusicRepo()
  media = new FakeMedia()
  media.assets.set('audio-nuevo', { ownerId: 'a1', kind: 'AUDIO' })
  media.assets.set('video-nuevo', { ownerId: 'a1', kind: 'VIDEO' })
  media.assets.set('audio-ajeno', { ownerId: 'otro', kind: 'AUDIO' })
  colecciones = new FakeColeccionRepo()
  svc = new MusicService(music, media as never, colecciones)
})

const cancionMinima = {
  title: 'Gracia que me encontró',
  artistName: 'Opus33',
  albumId: 'al1',
  subtitle: null,
  trackNumber: 1,
  audioAssetId: 'audio-nuevo',
  durationSeconds: 180,
  tone: 'vino' as const,
  backgroundUrl: null,
  backgroundAssetId: null,
  backgroundType: null,
  subtitlesSrt: null,
}

describe('catálogo de Alabanza (HU-9.2)', () => {
  it('solo lleva canciones publicadas, con el audio firmado y la portada del álbum', async () => {
    music.seed(nuevaCancion({ id: 's1', isPublished: true }))
    music.seed(nuevaCancion({ id: 's2' }))

    const { albumes, canciones } = await svc.catalogo()

    expect(albumes).toHaveLength(1)
    expect(canciones.map((c) => c.songId)).toEqual(['s1'])
    expect(canciones[0]!.audioUrl).toContain('firmada')
    expect(canciones[0]!.coverUrl).toBe('https://portada/a01.webp')
    expect(canciones[0]!.numero).toBe('01')
  })

  it('una canción sin audio no se sirve: no habría nada que reproducir', async () => {
    music.seed(nuevaCancion({ id: 's1', isPublished: true, audioAssetId: null }))

    expect((await svc.catalogo()).canciones).toEqual([])
  })
})

describe('administración de música (módulo Contenido)', () => {
  it('una canción nace sin publicar', async () => {
    const cancion = await svc.crearCancion(admin, cancionMinima)

    expect(cancion.isPublished).toBe(false)
    expect((await svc.catalogo()).canciones).toEqual([])
  })

  it('publicar la hace visible en Alabanza', async () => {
    const cancion = await svc.crearCancion(admin, cancionMinima)

    await svc.publicarCancion(admin, cancion.id, true)

    expect((await svc.catalogo()).canciones.map((c) => c.songId)).toEqual([cancion.id])
  })

  it('rechaza un medio que no es audio y uno ajeno', async () => {
    await expect(
      svc.crearCancion(admin, { ...cancionMinima, audioAssetId: 'video-nuevo' }),
    ).rejects.toThrow(BadRequestException)
    await expect(
      svc.crearCancion(admin, { ...cancionMinima, audioAssetId: 'audio-ajeno' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('rechaza un álbum que no existe', async () => {
    await expect(
      svc.crearCancion(admin, { ...cancionMinima, albumId: 'fantasma' }),
    ).rejects.toThrow(NotFoundException)
  })

  it('reutiliza el artista en vez de duplicarlo', async () => {
    await svc.crearCancion(admin, cancionMinima)
    await svc.crearCancion(admin, { ...cancionMinima, title: 'Otra' })

    expect(await music.findArtists()).toHaveLength(1)
  })

  it('crear un álbum con artista nuevo lo da de alta', async () => {
    const album = await svc.crearAlbum(admin, {
      title: 'Madero de esperanza',
      artistName: 'Membeth',
      number: 'A02',
      description: null,
      coverImageUrl: null,
      tone: 'marfil',
      discColor: null,
    })

    expect(album.titulo).toBe('Madero de esperanza')
    expect((await music.findArtists()).map((a) => a.name)).toContain('Membeth')
  })

  it('un álbum con canciones no se borra', async () => {
    music.seed(nuevaCancion({ id: 's1' }))

    await expect(svc.eliminarAlbum(admin, 'al1')).rejects.toThrow(BadRequestException)
    expect(music.albumesBorrados).toEqual([])
  })

  it('un álbum vacío sí se borra', async () => {
    await svc.eliminarAlbum(admin, 'al1')
    expect(music.albumesBorrados).toEqual(['al1'])
  })

  it('eliminar una canción borra también su audio', async () => {
    const cancion = await svc.crearCancion(admin, cancionMinima)

    await svc.eliminarCancion(admin, cancion.id)

    expect(music.borradas).toEqual([cancion.id])
    expect(media.eliminados).toEqual(['audio-nuevo'])
  })

  it('el fondo en video debe ser un video y del propio admin', async () => {
    await expect(
      svc.crearCancion(admin, { ...cancionMinima, backgroundAssetId: 'audio-nuevo' }),
    ).rejects.toThrow(BadRequestException)
    media.assets.set('video-ajeno', { ownerId: 'otro', kind: 'VIDEO' })
    await expect(
      svc.crearCancion(admin, { ...cancionMinima, backgroundAssetId: 'video-ajeno' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('eliminar una canción con fondo en video borra los dos archivos', async () => {
    const cancion = await svc.crearCancion(admin, {
      ...cancionMinima,
      backgroundAssetId: 'video-nuevo',
      backgroundType: 'video',
    })

    await svc.eliminarCancion(admin, cancion.id)

    expect(media.eliminados).toEqual(['audio-nuevo', 'video-nuevo'])
  })

  it('editar el álbum corrige sus datos', async () => {
    const album = await svc.editarAlbum(admin, 'al1', { title: 'Otro título', tone: 'azul' })

    expect(album.titulo).toBe('Otro título')
    expect(album.tono).toBe('azul')
  })

  it('no se publica dos veces al mismo estado', async () => {
    const cancion = await svc.crearCancion(admin, cancionMinima)
    await expect(svc.publicarCancion(admin, cancion.id, false)).rejects.toThrow(BadRequestException)
  })

  it('solo el admin administra la música', async () => {
    music.seed(nuevaCancion({ id: 's1' }))

    await expect(svc.listarParaAdmin(maestro)).rejects.toThrow(ForbiddenException)
    await expect(svc.crearCancion(maestro, cancionMinima)).rejects.toThrow(ForbiddenException)
    await expect(svc.publicarCancion(maestro, 's1', true)).rejects.toThrow(ForbiddenException)
    await expect(svc.eliminarCancion(maestro, 's1')).rejects.toThrow(ForbiddenException)
    await expect(svc.eliminarAlbum(maestro, 'al1')).rejects.toThrow(ForbiddenException)
  })
})

describe('colecciones: guardar sin cuenta, recuperar con un código', () => {
  /** Abre una colección y devuelve su código, como haría el primer álbum. */
  const nuevaColeccion = async () => (await svc.crearColeccion()).codigo

  it('el primer álbum abre la colección y devuelve el código', async () => {
    const { album, codigo } = await svc.crearAlbumPersonal('Para orar')

    expect(codigo).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/)
    expect(album.titulo).toBe('Para orar')
    expect((await svc.abrirColeccion(codigo!)).albumesPersonales).toHaveLength(1)
  })

  it('con código, el álbum se suma a la colección que ya existe', async () => {
    const codigo = await nuevaColeccion()

    const segundo = await svc.crearAlbumPersonal('Para caminar', codigo)

    expect(segundo.codigo).toBeNull()
    expect((await svc.abrirColeccion(codigo)).albumesPersonales).toHaveLength(1)
  })

  it('marcar y desmarcar una canción', async () => {
    const codigo = await nuevaColeccion()
    music.seed(nuevaCancion({ id: 's1' }))

    await svc.marcarCancion(codigo, 's1', true)
    expect((await svc.abrirColeccion(codigo)).cancionesFavoritas).toEqual(['s1'])

    await svc.marcarCancion(codigo, 's1', false)
    expect((await svc.abrirColeccion(codigo)).cancionesFavoritas).toEqual([])
  })

  it('no se marca una canción que no existe', async () => {
    const codigo = await nuevaColeccion()
    await expect(svc.marcarCancion(codigo, 'fantasma', true)).rejects.toThrow(NotFoundException)
  })

  it('cada código abre solo su colección', async () => {
    const mio = await nuevaColeccion()
    const ajeno = await nuevaColeccion()
    music.seed(nuevaCancion({ id: 's1' }))
    await svc.marcarCancion(mio, 's1', true)

    expect((await svc.abrirColeccion(ajeno)).cancionesFavoritas).toEqual([])
  })

  it('un código desconocido no abre nada', async () => {
    await expect(svc.abrirColeccion('AAAAA-BBBBB')).rejects.toThrow(NotFoundException)
  })

  it('el código se acepta en minúsculas y con espacios de sobra', async () => {
    const codigo = await nuevaColeccion()

    await expect(svc.abrirColeccion(`  ${codigo.toLowerCase()} `)).resolves.toBeDefined()
  })

  it('un álbum solo lo edita o borra quien tiene su código', async () => {
    const mio = await nuevaColeccion()
    const ajeno = await nuevaColeccion()
    const { album } = await svc.crearAlbumPersonal('Para orar', mio)

    await expect(
      svc.editarAlbumPersonal(ajeno, album.albumId, {
        titulo: 'Mío',
        coverUrl: null,
        songIds: [],
      }),
    ).rejects.toThrow(NotFoundException)
    await expect(svc.eliminarAlbumPersonal(ajeno, album.albumId)).rejects.toThrow(NotFoundException)
  })

  it('editar sustituye título y contenido del álbum', async () => {
    const codigo = await nuevaColeccion()
    const { album } = await svc.crearAlbumPersonal('Para orar', codigo)

    const editado = await svc.editarAlbumPersonal(codigo, album.albumId, {
      titulo: 'Para caminar',
      coverUrl: 'https://portada/x.webp',
      songIds: ['s1', 's2'],
    })

    expect(editado.titulo).toBe('Para caminar')
    expect(editado.songIds).toEqual(['s1', 's2'])
  })

  it('un álbum sin nombre no se crea', async () => {
    await expect(svc.crearAlbumPersonal('   ')).rejects.toThrow(BadRequestException)
  })
})
