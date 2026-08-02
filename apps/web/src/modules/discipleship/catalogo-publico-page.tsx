import { useSession } from '../../auth/session'
import { CatalogoPage } from './catalogo-page'

/** Misma interfaz de catálogo; solo cambia la fuente pública de solo lectura. */
export function CatalogoPublicoPage() {
  const { session } = useSession()
  return <CatalogoPage lecturaPublica={!session} />
}
