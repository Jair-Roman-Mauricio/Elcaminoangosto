import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eyebrow } from '@elcamino/ui'
import { usePerfil } from '../../auth/session'
import { useFeed, type FeedCard } from './feed-api'

/**
 * Feed vertical de Tarjetas de Fe (HU-3.1). Contenedor con `scroll-snap`: cada
 * tarjeta ocupa la pantalla; el video en foco se reproduce y los demás se
 * pausan (IntersectionObserver). Respeta `prefers-reduced-motion` no
 * autorreproduciendo si el usuario lo pide.
 */
export function FeedPage() {
  const { data, isPending, fetchNextPage, hasNextPage } = useFeed()
  const { data: perfil } = usePerfil()
  const cards = data?.pages.flat() ?? []

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, fetchNextPage])

  const puedePublicar = perfil?.role === 'MAESTRO' || perfil?.role === 'ADMIN'

  if (isPending) {
    return <p className="py-aire-l text-center font-mono text-body text-texto-tenue">Cargando…</p>
  }

  return (
    <div className="relative">
      {puedePublicar && (
        <Link
          to="/tarjetas/publicar"
          className="fixed bottom-24 right-gutter z-20 rounded-full border border-linea-fuerte bg-superficie-1/90 px-aire-m py-aire-s font-mono text-eyebrow uppercase tracking-label text-contenido no-underline backdrop-blur transition-colors duration-fade ease-camino hover:border-vino hover:bg-vino hover:text-hueso"
        >
          + Publicar
        </Link>
      )}

      {cards.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-aire-s text-center">
          <Eyebrow>Tarjetas de Fe</Eyebrow>
          <p className="m-0 font-mono text-body text-texto-tenue">
            Todavía no hay tarjetas.
            {puedePublicar && ' Publica la primera.'}
          </p>
        </div>
      ) : (
        // Contenedor de snap vertical, altura de viewport menos el nav y la player bar.
        <div className="h-[calc(100vh-13rem)] snap-y snap-mandatory overflow-y-auto rounded scrollbar-none">
          {cards.map((card) => (
            <TarjetaViewport key={card.id} card={card} />
          ))}
          <div ref={sentinelRef} className="h-4" />
        </div>
      )}
    </div>
  )
}

function TarjetaViewport({ card }: { card: FeedCard }) {
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [enFoco, setEnFoco] = useState(false)

  // El video se reproduce cuando la tarjeta está en foco; se pausa al salir.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => setEnFoco((entries[0]?.intersectionRatio ?? 0) > 0.6),
      { threshold: [0, 0.6, 1] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (enFoco) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduced) void v.play().catch(() => undefined)
    } else {
      v.pause()
    }
  }, [enFoco])

  return (
    <section
      ref={ref}
      data-theme="dark"
      className="relative flex h-full snap-start snap-always items-center justify-center overflow-hidden bg-negro"
    >
      {card.type === 'VIDEO' ? (
        <video
          ref={videoRef}
          src={card.mediaUrl}
          poster={card.posterUrl ?? undefined}
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
        />
      ) : (
        <img src={card.mediaUrl} alt={card.caption ?? ''} className="h-full w-full object-contain" />
      )}

      {/* Overlay de autor y caption, con scrim solo abajo (DESIGN.md §8). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-aire-xs bg-gradient-to-t from-negro/85 to-transparent p-gutter pt-aire-l">
        <p className="m-0 font-mono text-eyebrow uppercase tracking-label text-texto-tenue">
          {card.authorName}
        </p>
        {card.caption && (
          <p className="m-0 max-w-prose font-mono text-body text-hueso">{card.caption}</p>
        )}
      </div>
    </section>
  )
}
