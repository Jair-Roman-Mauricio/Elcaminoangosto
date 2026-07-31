/** Lee las URLs de una galería guardada en `content` (array JSON). */
export function parseGaleria(content: string | null): string[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : []
  } catch {
    return []
  }
}

/** Muestra una galería de imágenes (lección IMAGE), compartida por profesor y alumno. */
export function GaleriaImagenes({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return <p className="m-0 font-mono text-body-s text-texto-tenue">Esta galería no tiene imágenes.</p>
  }
  return (
    <div className="flex flex-col gap-aire-m">
      {urls.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`Imagen ${i + 1}`}
          loading="lazy"
          className="w-full rounded"
        />
      ))}
    </div>
  )
}
