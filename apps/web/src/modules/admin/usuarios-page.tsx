import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RoleSchema, type Role } from '@elcamino/shared-types'
import { Boton, Eyebrow, Field, Input, Modal } from '@elcamino/ui'
import { apiClient, ApiError } from '../../lib/api-client'
import { SelectPildora } from '../../components/select-pildora'
import { useLevels } from '../discipleship/authoring-api'

interface UsuarioRow {
  id: string
  role: Role
  displayName: string
  levelRank: number
  currentLevelId: string | null
}

const ETIQUETA_ROL: Record<Role, string> = {
  ESTUDIANTE: 'Estudiante',
  MAESTRO: 'Maestro',
  ADMIN: 'Admin',
}

type Filtro = 'TODOS' | Role
const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'ESTUDIANTE', label: 'Estudiantes' },
  { valor: 'MAESTRO', label: 'Maestros' },
  { valor: 'ADMIN', label: 'Admins' },
]

const OPCIONES_FILAS = [10, 25, 50, 100]

// Formato cápsula para campos y select del formulario (mismo estilo del buscador).
const PILL = 'h-12 rounded-full border-linea-fuerte bg-superficie-1 px-[1.4rem] py-0'

/** Filas por defecto según el alto de pantalla (más pantalla, más filas). */
function filasPorDefecto(): number {
  if (typeof window === 'undefined') return 10
  const h = window.innerHeight
  if (h < 800) return 10
  if (h < 1200) return 25
  return 50
}

/** Gestión de usuarios y roles (HU-1.2, solo ADMIN): buscador, filtros y tabla. */
export function UsuariosPage() {
  const qc = useQueryClient()
  const { data: usuarios, isPending } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get<UsuarioRow[]>('/users'),
  })

  const { data: catalogoNiveles } = useLevels()
  const niveles = catalogoNiveles ?? []

  const invalidarUsuarios = () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] })

  const cambiarRol = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiClient.patch(`/users/${id}/role`, { role }),
    onSuccess: invalidarUsuarios,
  })

  /**
   * Cambiar el nivel altera qué cursos ve el estudiante, así que además de la
   * lista se invalida su catálogo.
   */
  const cambiarNivel = useMutation({
    mutationFn: ({ id, levelId }: { id: string; levelId: string }) =>
      apiClient.patch(`/users/${id}/level`, { levelId }),
    onSuccess: () => {
      invalidarUsuarios()
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    },
  })

  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('TODOS')

  const [porPagina, setPorPagina] = useState<number>(filasPorDefecto)
  const [pagina, setPagina] = useState(1)

  const lista = useMemo(() => usuarios ?? [], [usuarios])
  const q = busqueda.trim().toLowerCase()
  const visibles = lista.filter(
    (u) => (filtro === 'TODOS' || u.role === filtro) && u.displayName.toLowerCase().includes(q),
  )
  const cuenta = (f: Filtro) => (f === 'TODOS' ? lista.length : lista.filter((u) => u.role === f).length)

  // Paginación: al cambiar de filtro/búsqueda/tamaño, se vuelve a la página 1.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  useEffect(() => {
    setPagina(1)
  }, [filtro, q, porPagina])
  const paginaSegura = Math.min(pagina, totalPaginas)
  const filas = visibles.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina)

  // Subrayado deslizante sobre el filtro activo (formato del catálogo).
  const filtrosRef = useRef<HTMLElement>(null)
  const [indicador, setIndicador] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const mover = () => {
      const nav = filtrosRef.current
      const boton = nav?.querySelector<HTMLButtonElement>(`[data-filtro="${filtro}"]`)
      if (!nav || !boton) return
      setIndicador({ left: boton.offsetLeft, width: boton.offsetWidth })
    }
    mover()
    window.addEventListener('resize', mover)
    return () => window.removeEventListener('resize', mover)
  }, [filtro, usuarios])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-wrap items-end justify-between gap-aire-s">
        <div className="flex flex-col gap-aire-xs">
          <Eyebrow>Administración</Eyebrow>
          <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Usuarios y roles</h1>
          {lista.length > 0 && (
            <p className="m-0 font-mono text-body-s text-texto-tenue">{lista.length} usuario(s).</p>
          )}
        </div>
        <Boton variante="formulario" onClick={() => setCreando(true)}>
          Crear cuenta
        </Boton>
      </header>

      <Modal
        abierto={creando}
        onCerrar={() => setCreando(false)}
        titulo="Nueva cuenta"
        descripcion="Crea una cuenta con su rol. La persona entrará con este correo y contraseña."
      >
        <FormularioNuevaCuenta
          onHecho={() => setCreando(false)}
          onCancelar={() => setCreando(false)}
        />
      </Modal>

      {/* Buscador con lupa */}
      <label className="relative block w-full">
        <span className="sr-only">Buscar usuario</span>
        <svg
          className="pointer-events-none absolute left-aire-s top-1/2 size-5 -translate-y-1/2 text-texto-tenue"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un usuario por nombre"
          className="h-14 w-full rounded-full border border-linea-fuerte bg-superficie-1 pl-12 pr-aire-s font-ui text-body text-contenido shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[border-color,box-shadow] placeholder:text-texto-tenue focus:border-vino focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vino)_12%,transparent)]"
        />
      </label>

      {/* Filtros por rol */}
      <nav ref={filtrosRef} aria-label="Filtrar por rol" className="relative flex gap-aire-m">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-vino transition-[width,transform] duration-[600ms] ease-camino"
          style={{ width: indicador.width, transform: `translateX(${indicador.left}px)` }}
        />
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            data-filtro={f.valor}
            onClick={() => setFiltro(f.valor)}
            aria-pressed={filtro === f.valor}
            className={[
              'shrink-0 pb-2 font-ui text-body-s font-medium transition-colors',
              filtro === f.valor ? 'text-contenido' : 'text-texto-tenue hover:text-contenido',
            ].join(' ')}
          >
            {f.label} · {cuenta(f.valor)}
          </button>
        ))}
      </nav>

      {isPending && <p className="font-mono text-body text-texto-tenue">Cargando…</p>}
      {!isPending && visibles.length === 0 && (
        <p className="font-ui text-body-s text-texto-tenue">Ningún usuario coincide.</p>
      )}

      {/* Tabla de usuarios: ancho fijo, columnas repartidas para no dejar hueco. */}
      {visibles.length > 0 && (
        <div className="w-full overflow-x-auto bg-superficie-1 shadow-[0_0.9rem_2.2rem_-0.5rem_rgba(20,17,15,0.22)]">
          <table className="w-full table-fixed border-collapse font-mono text-body-s">
            <colgroup>
              <col className="w-1/2" />
              <col className="w-[18%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr className="bg-vino text-left text-eyebrow uppercase tracking-label text-hueso">
                <th className="px-aire-s py-aire-s font-normal">Nombre</th>
                <th className="px-aire-s py-aire-s font-normal">Nivel</th>
                <th className="px-aire-s py-aire-s font-normal">Rol</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((u) => (
                <tr key={u.id} className="border-b border-linea/50 last:border-0">
                  <td className="truncate px-aire-s py-aire-s text-contenido">{u.displayName}</td>
                  <td className="px-aire-s py-aire-s text-texto-tenue">
                    {/* El nivel abre o cierra cursos: solo lo tiene el estudiante. */}
                    {u.role === 'ESTUDIANTE' ? (
                      <SelectPildora
                        tono="contorno"
                        aria-label={`Nivel de ${u.displayName}`}
                        // La celda solo muestra el número; el nombre del nivel
                        // vive en el `title` para quien necesite saber cuál es.
                        title={niveles.find((n) => n.id === u.currentLevelId)?.name ?? 'Sin nivel'}
                        value={u.currentLevelId ?? ''}
                        disabled={cambiarNivel.isPending || niveles.length === 0}
                        onChange={(e) => cambiarNivel.mutate({ id: u.id, levelId: e.target.value })}
                        className="pl-[1.4rem]"
                      >
                        {!u.currentLevelId && (
                          <option value="" disabled>
                            —
                          </option>
                        )}
                        {niveles.map((n) => (
                          <option key={n.id} value={n.id} className="bg-superficie-1 text-contenido">
                            {n.rank}
                          </option>
                        ))}
                      </SelectPildora>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-aire-s py-aire-s">
                    <SelectPildora
                      aria-label={`Rol de ${u.displayName}`}
                      value={u.role}
                      disabled={cambiarRol.isPending}
                      onChange={(e) =>
                        cambiarRol.mutate({ id: u.id, role: RoleSchema.parse(e.target.value) })
                      }
                    >
                      {RoleSchema.options.map((r) => (
                        <option key={r} value={r} className="bg-superficie-1 text-contenido">
                          {ETIQUETA_ROL[r]}
                        </option>
                      ))}
                    </SelectPildora>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pie: filas por página + navegación */}
          <div className="flex flex-wrap items-center justify-between gap-aire-s border-t border-linea px-aire-s py-aire-xs font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
            <label className="flex items-center gap-aire-xs">
              Filas por página
              <select
                value={porPagina}
                onChange={(e) => setPorPagina(Number(e.target.value))}
                className="cursor-pointer rounded border border-linea bg-superficie-2 px-aire-xs py-1 font-mono text-eyebrow text-contenido outline-none focus:border-vino"
              >
                {OPCIONES_FILAS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-aire-s">
              <span className="normal-case tracking-normal">
                {(paginaSegura - 1) * porPagina + 1}–{Math.min(paginaSegura * porPagina, visibles.length)} de{' '}
                {visibles.length}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaSegura <= 1}
                aria-label="Página anterior"
                className="rounded border border-linea px-aire-xs py-1 transition-colors hover:border-vino hover:text-vino disabled:cursor-default disabled:opacity-40"
              >
                ‹
              </button>
              <span>
                {paginaSegura} / {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura >= totalPaginas}
                aria-label="Página siguiente"
                className="rounded border border-linea px-aire-xs py-1 transition-colors hover:border-vino hover:text-vino disabled:cursor-default disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {cambiarRol.isError && (
        <p role="alert" className="font-mono text-body-s text-vino">
          No se pudo cambiar el rol.
        </p>
      )}

      {cambiarNivel.isError && (
        <p role="alert" className="font-mono text-body-s text-vino">
          {cambiarNivel.error instanceof ApiError
            ? cambiarNivel.error.message
            : 'No se pudo cambiar el nivel.'}
        </p>
      )}
    </div>
  )
}

/** El ADMIN crea una cuenta (p. ej. un profesor) con la que esa persona entrará. */
function FormularioNuevaCuenta({
  onHecho,
  onCancelar,
}: {
  onHecho: () => void
  onCancelar: () => void
}) {
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('MAESTRO')
  const [error, setError] = useState<string | null>(null)

  const crear = useMutation({
    mutationFn: () =>
      apiClient.post('/users', { displayName: displayName.trim(), email: email.trim(), password, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      onHecho()
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'No se pudo crear la cuenta.'),
  })

  const valido = displayName.trim().length >= 1 && email.includes('@') && password.length >= 8

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        if (valido) crear.mutate()
      }}
      className="flex flex-col gap-aire-s"
    >
      <div className="grid gap-aire-s sm:grid-cols-2">
        <Field label="Nombre" htmlFor="nc-nombre">
          <Input
            id="nc-nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nombre de la persona"
            autoComplete="off"
            className={PILL}
          />
        </Field>
        <Field label="Rol" htmlFor="nc-rol">
          <span className="relative block">
            <select
              id="nc-rol"
              value={role}
              onChange={(e) => setRole(RoleSchema.parse(e.target.value))}
              className="h-12 w-full cursor-pointer appearance-none rounded-full border border-linea-fuerte bg-superficie-1 pl-[1.4rem] pr-[2.6rem] font-mono text-body text-contenido outline-none focus:border-vino"
            >
              {RoleSchema.options.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETA_ROL[r]}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-[1.2rem] top-1/2 size-4 -translate-y-1/2 text-texto-tenue"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Field>
        <Field label="Correo" htmlFor="nc-correo">
          <Input
            id="nc-correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            autoComplete="off"
            className={PILL}
          />
        </Field>
        <Field label="Contraseña" htmlFor="nc-pass" hint="Mínimo 8 caracteres">
          <Input
            id="nc-pass"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña inicial"
            autoComplete="off"
            className={PILL}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="m-0 font-mono text-body-s text-vino">
          {error}
        </p>
      )}

      <div className="mt-aire-xs flex flex-wrap items-center gap-aire-s">
        <Boton
          type="submit"
          variante="formulario"
          disabled={!valido || crear.isPending}
          className="px-[1.4rem] py-[0.5rem] text-hueso [font-size:0.62rem] hover:border-vino hover:bg-vino hover:text-hueso"
        >
          {crear.isPending ? 'Creando…' : 'Crear cuenta'}
        </Boton>
        <Boton
          type="button"
          variante="contorno"
          onClick={onCancelar}
          className="px-[1.4rem] py-[0.5rem] [font-size:0.62rem]"
        >
          Cancelar
        </Boton>
      </div>
    </form>
  )
}
