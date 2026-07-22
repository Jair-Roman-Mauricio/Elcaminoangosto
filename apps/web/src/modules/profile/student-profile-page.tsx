import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Level, Profile, UpdateProfile } from '@elcamino/shared-types'
import { Boton, Field, Input, Reveal, Textarea } from '@elcamino/ui'
import { usePerfil, useSession } from '../../auth/session'
import { apiClient, ApiError } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useCatalog } from '../discipleship/api'
import './student-profile.css'

const FORMATOS_DE_AVATAR = ['image/jpeg', 'image/png', 'image/webp']
const MAXIMO_AVATAR = 5 * 1024 * 1024

export function StudentProfilePage() {
  const { session } = useSession()
  const { data: perfil, isPending, isError } = usePerfil()
  const { data: niveles = [] } = useQuery({
    queryKey: ['niveles'],
    queryFn: () => apiClient.get<Level[]>('/users/levels'),
  })
  const catalogo = useCatalog()
  const queryClient = useQueryClient()
  const inputAvatarRef = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState('')
  const [bio, setBio] = useState('')
  const [errorAvatar, setErrorAvatar] = useState<string | null>(null)
  const [avatarCargando, setAvatarCargando] = useState(false)

  useEffect(() => {
    if (!perfil) return
    setNombre(perfil.displayName)
    setBio(perfil.bio ?? '')
  }, [perfil])

  const actualizarPerfil = useMutation({
    mutationFn: (cambios: UpdateProfile) => apiClient.patch<Profile>('/users/me', cambios),
    onSuccess: (perfilActualizado) => {
      queryClient.setQueryData(['perfil', session?.user.id], perfilActualizado)
    },
  })

  const cursosCompletados = useMemo(
    () => (catalogo.data ?? []).filter((curso) => curso.enrolled && (curso.progressPct ?? 0) >= 100),
    [catalogo.data],
  )
  const nivelBase = niveles.find((nivel) => nivel.rank === 1)
  const nivelActual = niveles.find((nivel) => nivel.id === perfil?.currentLevelId)
    ?? (perfil?.role === 'ESTUDIANTE' ? nivelBase : undefined)
  const iniciales = inicialesDe(perfil?.displayName ?? session?.user.email ?? 'Estudiante')
  const formularioSinCambios = Boolean(perfil)
    && nombre.trim() === perfil?.displayName
    && bio.trim() === (perfil?.bio ?? '')

  const guardarDatos = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const displayName = nombre.trim()
    if (!displayName || displayName.length > 60) return
    await actualizarPerfil.mutateAsync({ displayName, bio: bio.trim() || null })
  }

  const seleccionarAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0]
    event.target.value = ''
    if (!archivo || !session) return

    if (!FORMATOS_DE_AVATAR.includes(archivo.type)) {
      setErrorAvatar('Usa una imagen JPG, PNG o WebP.')
      return
    }
    if (archivo.size > MAXIMO_AVATAR) {
      setErrorAvatar('La imagen debe pesar menos de 5 MB.')
      return
    }

    setErrorAvatar(null)
    setAvatarCargando(true)
    try {
      const extension = archivo.type === 'image/png' ? 'png' : archivo.type === 'image/webp' ? 'webp' : 'jpg'
      const ruta = `${session.user.id}/perfil.${extension}`
      const { error } = await supabase.storage.from('avatars').upload(ruta, archivo, {
        cacheControl: '3600',
        contentType: archivo.type,
        upsert: true,
      })
      if (error) throw error

      const { data } = supabase.storage.from('avatars').getPublicUrl(ruta)
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`
      await actualizarPerfil.mutateAsync({ avatarUrl })
    } catch (error) {
      setErrorAvatar(error instanceof Error ? error.message : 'No pudimos actualizar la fotografía.')
    } finally {
      setAvatarCargando(false)
    }
  }

  const quitarAvatar = async () => {
    setErrorAvatar(null)
    await actualizarPerfil.mutateAsync({ avatarUrl: null })
  }

  if (isPending) return <EstadoPerfil texto="Preparando tu perfil…" />
  if (isError || !perfil) return <EstadoPerfil texto="No pudimos cargar tu perfil." />

  const errorGuardado = actualizarPerfil.error instanceof ApiError
    ? actualizarPerfil.error.message
    : actualizarPerfil.error instanceof Error
      ? actualizarPerfil.error.message
      : null

  return (
    <section className="student-profile" aria-labelledby="student-profile-title">
      <Reveal>
        <header className="student-profile__hero">
          <div className="student-profile__portrait-column">
            <div className="student-profile__portrait" role="img" aria-label={`Foto de ${perfil.displayName}`}>
              {perfil.avatarUrl
                ? <img src={perfil.avatarUrl} alt="" />
                : <span>{iniciales}</span>}
              <i aria-hidden="true" />
            </div>
            <div className="student-profile__avatar-actions">
              <Input
                ref={inputAvatarRef}
                type="file"
                accept={FORMATOS_DE_AVATAR.join(',')}
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => void seleccionarAvatar(event)}
              />
              <Boton
                variante="sutil"
                disabled={avatarCargando}
                onClick={() => inputAvatarRef.current?.click()}
              >
                {avatarCargando ? 'Subiendo…' : perfil.avatarUrl ? 'Cambiar foto' : 'Agregar foto'}
              </Boton>
              {perfil.avatarUrl && (
                <Boton variante="sutil" disabled={actualizarPerfil.isPending} onClick={() => void quitarAvatar()}>
                  Quitar
                </Boton>
              )}
            </div>
            {errorAvatar && <p role="alert" className="student-profile__avatar-error">{errorAvatar}</p>}
          </div>

          <div className="student-profile__identity">
            <span className="student-profile__eyebrow">Perfil del estudiante</span>
            <h1 id="student-profile-title">{perfil.displayName}</h1>
            <p>{perfil.bio || 'Este espacio contará quién eres y qué estás aprendiendo en el camino.'}</p>
            <div className="student-profile__identity-meta">
              <span>Estudiante</span>
              <span>{nivelActual?.name ?? 'Nivel por asignar'}</span>
              <span>{session?.user.email ?? 'Correo no disponible'}</span>
            </div>
          </div>

          <div className="student-profile__level" aria-label="Nivel formativo actual">
            <span>Tu nivel actual</span>
            <strong>{nivelActual ? String(nivelActual.rank).padStart(2, '0') : '—'}</strong>
            <p>{nivelActual?.description ?? 'Tu mentor podrá acompañar el avance de tu nivel.'}</p>
          </div>
        </header>
      </Reveal>

      <div className="student-profile__body">
        <Reveal className="student-profile__editor" delay={0.06}>
          <header className="student-profile__section-heading">
            <div>
              <span>Identidad</span>
              <h2>Editar perfil</h2>
            </div>
            <div className="student-profile__editor-actions">
              <span aria-live="polite">
                {actualizarPerfil.isSuccess && formularioSinCambios && !actualizarPerfil.isPending ? 'Cambios guardados.' : errorGuardado}
              </span>
              <Boton
                type="submit"
                form="student-profile-form"
                variante="formulario"
                disabled={actualizarPerfil.isPending || formularioSinCambios || !nombre.trim()}
                className="student-profile__save-button"
              >
                {actualizarPerfil.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
            </div>
          </header>

          <form id="student-profile-form" onSubmit={(event) => void guardarDatos(event)}>
            <Field
              label="Nombre visible"
              htmlFor="profile-display-name"
              hint={`${nombre.length}/60 caracteres`}
              className="student-profile__field student-profile__field--name"
            >
              <Input
                id="profile-display-name"
                value={nombre}
                maxLength={60}
                autoComplete="name"
                onChange={(event) => setNombre(event.target.value)}
              />
            </Field>

            <Field
              label="Acerca de mí"
              htmlFor="profile-bio"
              hint={`${bio.length}/500 caracteres`}
              className="student-profile__field student-profile__field--bio"
            >
              <Textarea
                id="profile-bio"
                value={bio}
                maxLength={500}
                rows={4}
                placeholder="Comparte brevemente qué estás aprendiendo o qué esperas encontrar en este camino."
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>

          </form>
        </Reveal>

        <Reveal className="student-profile__completed" delay={0.1}>
          <header className="student-profile__section-heading">
            <div>
              <span>Camino recorrido</span>
              <h2>Cursos terminados</h2>
            </div>
          </header>

          {catalogo.isPending && <p className="student-profile__empty">Cargando tu recorrido…</p>}
          {catalogo.isError && <p className="student-profile__empty">No pudimos consultar tus cursos.</p>}
          {!catalogo.isPending && !catalogo.isError && cursosCompletados.length === 0 && (
            <p className="student-profile__empty">Aún no has terminado ningún curso. Los que completes aparecerán aquí.</p>
          )}
          {cursosCompletados.map((curso, indice) => (
            <Link key={curso.id} to={`/discipulado/${curso.slug}`} className="student-profile__course">
              <span className="student-profile__course-index">{String(indice + 1).padStart(2, '0')}</span>
              <span className="student-profile__course-copy">
                <strong>{curso.title}</strong>
                <small>{curso.teacherName} · {curso.lessonCount} lecciones</small>
              </span>
              <span className="student-profile__course-percent">Completado</span>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

function EstadoPerfil({ texto }: { texto: string }) {
  return <p className="student-profile__status" role="status">{texto}</p>
}

function inicialesDe(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.slice(0, 1).toUpperCase())
    .join('') || 'E'
}
