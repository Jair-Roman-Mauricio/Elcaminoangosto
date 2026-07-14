import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RoleSchema, type Role } from '@elcamino/shared-types'
import { Boton, Eyebrow, Field, Input, Select } from '@elcamino/ui'
import { apiClient, ApiError } from '../../lib/api-client'

interface UsuarioRow {
  id: string
  role: Role
  displayName: string
  levelRank: number
}

const ETIQUETA_ROL: Record<Role, string> = {
  ESTUDIANTE: 'Estudiante',
  MAESTRO: 'Maestro',
  ADMIN: 'Admin',
}

/** Gestión de usuarios y roles (HU-1.2, solo ADMIN). */
export function UsuariosPage() {
  const qc = useQueryClient()
  const { data: usuarios, isPending } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get<UsuarioRow[]>('/users'),
  })

  const cambiarRol = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiClient.patch(`/users/${id}/role`, { role }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const [creando, setCreando] = useState(false)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-aire-l py-aire-m">
      <header className="flex items-end justify-between gap-aire-m">
        <div className="flex flex-col gap-aire-xs">
          <Eyebrow>Administración</Eyebrow>
          <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Usuarios y roles</h1>
        </div>
        <Boton onClick={() => setCreando((v) => !v)}>
          {creando ? 'Cancelar' : 'Crear cuenta'}
        </Boton>
      </header>

      {creando && <FormularioNuevaCuenta onHecho={() => setCreando(false)} />}

      {isPending && <p className="font-mono text-body text-texto-tenue">Cargando…</p>}

      {usuarios && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-body-s">
            <thead>
              <tr className="border-b border-linea text-left text-eyebrow uppercase tracking-label text-texto-tenue">
                <th className="py-aire-xs pr-aire-s font-normal">Nombre</th>
                <th className="py-aire-xs pr-aire-s font-normal">Nivel</th>
                <th className="py-aire-xs font-normal">Rol</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-linea/50">
                  <td className="py-aire-s pr-aire-s text-contenido">{u.displayName}</td>
                  <td className="py-aire-s pr-aire-s text-texto-tenue">
                    {u.levelRank > 0 ? u.levelRank : '—'}
                  </td>
                  <td className="py-aire-s">
                    <Select
                      value={u.role}
                      disabled={cambiarRol.isPending}
                      onChange={(e) =>
                        cambiarRol.mutate({ id: u.id, role: RoleSchema.parse(e.target.value) })
                      }
                      className="w-auto py-1 text-body-s"
                    >
                      {RoleSchema.options.map((r) => (
                        <option key={r} value={r}>
                          {ETIQUETA_ROL[r]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cambiarRol.isError && (
        <p role="alert" className="font-mono text-body-s text-vino">
          No se pudo cambiar el rol.
        </p>
      )}
    </div>
  )
}

/** El ADMIN crea una cuenta (p. ej. un profesor) con la que esa persona entrará. */
function FormularioNuevaCuenta({ onHecho }: { onHecho: () => void }) {
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
      className="flex flex-col gap-aire-s rounded border border-linea bg-superficie-1 p-aire-m"
    >
      <p className="m-0 font-mono text-body-s text-texto-tenue">
        Crea una cuenta con su rol. La persona entrará con este correo y contraseña.
      </p>
      <div className="grid gap-aire-s sm:grid-cols-2">
        <Field label="Nombre" htmlFor="nc-nombre">
          <Input
            id="nc-nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nombre de la persona"
            autoComplete="off"
          />
        </Field>
        <Field label="Rol" htmlFor="nc-rol">
          <Select
            id="nc-rol"
            value={role}
            onChange={(e) => setRole(RoleSchema.parse(e.target.value))}
          >
            {RoleSchema.options.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Correo" htmlFor="nc-correo">
          <Input
            id="nc-correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            autoComplete="off"
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
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="m-0 font-mono text-body-s text-vino">
          {error}
        </p>
      )}

      <Boton type="submit" disabled={!valido || crear.isPending} className="self-start">
        {crear.isPending ? 'Creando…' : 'Crear cuenta'}
      </Boton>
    </form>
  )
}
