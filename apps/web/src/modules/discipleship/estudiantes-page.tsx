import { useQuery } from '@tanstack/react-query'
import { Eyebrow } from '@elcamino/ui'
import { apiClient } from '../../lib/api-client'

interface Mentee {
  studentId: string
  displayName: string
  levelName: string | null
  levelRank: number
}

/** Mis estudiantes y su nivel (HU-1.3, MAESTRO). */
export function EstudiantesPage() {
  const { data, isPending } = useQuery({
    queryKey: ['my-students'],
    queryFn: () => apiClient.get<Mentee[]>('/users/my-students'),
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-aire-m py-aire-m">
      <header className="flex flex-col gap-aire-xs">
        <Eyebrow>Mentoría</Eyebrow>
        <h1 className="m-0 font-mono text-h-l font-normal text-contenido">Mis estudiantes</h1>
      </header>

      {isPending && <p className="font-mono text-body text-texto-tenue">Cargando…</p>}
      {data && data.length === 0 && (
        <p className="font-mono text-body text-texto-tenue">Aún no tienes estudiantes asignados.</p>
      )}

      {data && data.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {data.map((m) => (
            <li
              key={m.studentId}
              className="flex items-center justify-between rounded bg-superficie-1 px-aire-s py-aire-s"
            >
              <span className="font-mono text-body text-contenido">{m.displayName}</span>
              <span className="font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
                {m.levelName ?? `Nivel ${m.levelRank || '—'}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
