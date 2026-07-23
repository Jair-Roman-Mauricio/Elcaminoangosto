/** Ejecuta el cambio completo con el crossfade ligero definido en index.css. */
export function navegarConTransicion(navegar: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> }
  }
  if (!doc.startViewTransition) {
    navegar()
    return
  }

  // Evita sumar la entrada local de la página al fundido global. Cada una se
  // conserva para su contexto, pero nunca se reproducen juntas.
  document.documentElement.dataset.navigationTransition = 'active'
  const transition = doc.startViewTransition(navegar)
  void transition.finished.finally(() => {
    delete document.documentElement.dataset.navigationTransition
  })
}
