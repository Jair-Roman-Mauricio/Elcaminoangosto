import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RoleSchema, type Role } from '@elcamino/shared-types'
import { Eyebrow, Select } from '@elcamino/ui'
import { apiClient } from '../../lib/api-client'

interface UsuarioRow {
  id: string
  role: Role
  displayName: string
  levelRank: number
}

/** Gestión de roles (HU-1.2, solo ADMIN). */
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Administración</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Usuarios y roles</h1>
      </header>

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
                          {r}
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
