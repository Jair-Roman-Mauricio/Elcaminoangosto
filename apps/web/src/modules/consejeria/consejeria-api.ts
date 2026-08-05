import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

/* Contratos de la consejería (espejo del servidor). */

export interface Consejero {
  id: string
  nombre: string
  presentacion: string | null
  rol: string | null
  fotoUrl: string | null
  /** De «canal» a dato: solo los que este consejero haya dejado. */
  contactos: Record<string, string>
  /** Sube al principio de la lista y destaca su contacto. */
  atiendeUrgencias: boolean
  orden: number
  oculto: boolean
}

export function useConsejeros() {
  return useQuery({
    queryKey: ['consejeros'],
    queryFn: () => apiClient.get<Consejero[]>('/consejeros'),
    staleTime: 5 * 60 * 1000,
  })
}

/** Los cambios llegan de un formulario parcial: admiten `undefined` explícito. */
type Cambios<T> = { [K in keyof T]?: T[K] | undefined }

export interface FichaConsejero {
  nombre: string
  presentacion: string | null
  rol: string | null
  fotoAssetId: string | null
  contactos: Record<string, string>
  atiendeUrgencias: boolean
  orden: number
}

function useInvalidarConsejeros() {
  const cliente = useQueryClient()
  return () => void cliente.invalidateQueries({ queryKey: ['consejeros'] })
}

export function usePublicarConsejero() {
  const invalidar = useInvalidarConsejeros()
  return useMutation({
    mutationFn: (input: FichaConsejero) => apiClient.post('/consejeros', input),
    onSuccess: invalidar,
  })
}

export function useEditarConsejero() {
  const invalidar = useInvalidarConsejeros()
  return useMutation({
    mutationFn: ({
      id,
      ...cambios
    }: { id: string; oculto?: boolean | undefined } & Cambios<FichaConsejero>) =>
      apiClient.patch(`/consejeros/${id}`, cambios),
    onSuccess: invalidar,
  })
}

export function useEliminarConsejero() {
  const invalidar = useInvalidarConsejeros()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/consejeros/${id}`),
    onSuccess: invalidar,
  })
}
