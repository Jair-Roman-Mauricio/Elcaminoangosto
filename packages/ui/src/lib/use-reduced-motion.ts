import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * RNF-6. La landing desactiva Lenis y acorta las transiciones cuando esto
 * es `true`; el resto de la app debe saltarse reveals y morphs.
 *
 * Reactivo: el usuario puede cambiar la preferencia del sistema en caliente.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
