import { useRegistrarVisita } from '../lib/analitica'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@elcamino/ui/static'
import { useFeed, type FeedCard } from '../modules/feed/feed-api'
import { pastoresPublicos } from './pastores-config'
import './landing.css'

const heroSlides = [
  {
    image: '/media/hero-costa-amanecer-v2.png',
    mobileImage: '/media/hero-costa-amanecer-mobile-v1.png',
    imageAlt: 'Luz al amanecer en un sendero costero rocoso',
    eyebrow: 'UNA PLATAFORMA PARA CRECER EN LA FE',
    titleText: 'El camino se recorre juntos.',
    title: <>El camino se<br />recorre juntos.</>,
    text: 'Te acompañamos en este camino para valientes, con distintos recursos para crecer en tu fe.',
  },
  {
    image: '/media/hero-comunidad-costera-v1.png',
    mobileImage: '/media/hero-comunidad-costera-mobile-v1.png',
    imageAlt: 'Grupo diverso de adultos caminando juntos por un sendero costero al amanecer',
    eyebrow: 'UNA COMUNIDAD QUE CAMINA CONTIGO',
    titleText: 'No tienes que recorrerlo a solas.',
    title: <>No tienes que<br />recorrerlo a solas.</>,
    text: 'Encuentra personas, conversaciones y apoyo para seguir adelante.',
  },
  {
    image: '/media/hero-estudio-fe-v1.png',
    mobileImage: '/media/hero-estudio-fe-mobile-v1.png',
    imageAlt: 'Adultos jóvenes conversando alrededor de una mesa de madera con cuadernos y una Biblia discreta',
    eyebrow: 'RECURSOS PARA CADA PASO',
    titleText: 'Una fe que se hace parte de tu vida.',
    title: <>Una fe que se hace<br />parte de tu vida.</>,
    text: 'Cursos, historias y pausas para avanzar con intención.',
  },
]

function HeroImage({ slide, className, decorative = false }: { slide: (typeof heroSlides)[number], className: string, decorative?: boolean }) {
  return (
    <picture className={className} aria-hidden={decorative || undefined}>
      <source media="(max-width: 700px)" srcSet={slide.mobileImage} />
      <img src={slide.image} alt={decorative ? '' : slide.imageAlt} />
    </picture>
  )
}

const caminos = [
  { tab: 'DISCIPULADO', title: 'APRENDE A CAMINAR', text: 'Recorridos sencillos y profundos para descubrir a Jesús, formar hábitos y dar el siguiente paso con intención.', action: 'Explorar cursos', to: '/discipulado', image: '/media/comunidad-discipulado-v2.png', imageAlt: 'Tarjetas de cursos contemporáneos sobre una superficie cálida' },
  { tab: 'COMUNIDAD', title: 'NADIE CAMINA SOLO', text: 'Encuentra una comunidad de personas que comparten sus preguntas, sus aprendizajes y el deseo de seguir creciendo.', action: 'Entrar a la comunidad', to: '/entrar?registro=1', image: '/media/comunidad-comunidad-v2.png', imageAlt: 'Comunidad diversa de adultos compartiendo y cantando con una guitarra acústica' },
  { tab: 'TARJETAS DE FE', title: 'PAUSAS PARA VOLVER AL CENTRO', text: 'Reflexiones breves y visuales para llevar una palabra contigo durante el día.', action: 'Explorar tarjetas', to: '/tarjetas', image: '/media/recurso-tarjetas-fe-educativas-alpha-v4.png', imageAlt: 'Cuatro tarjetas educativas de reflexión con diseño editorial minimalista', object: true },
  { tab: 'VIDEOS', title: 'MIRA Y CONVERSA', text: 'Historias y enseñanzas breves para mirar, escuchar y conversar con calma.', action: 'Ver videos', to: '/videos', image: '/media/recurso-videos-smartphone-alpha-v4.png', imageAlt: 'Smartphone vertical moderno con una visual de video editorial', object: true },
  { tab: 'MÚSICA', title: 'CANCIONES QUE ACOMPAÑAN', text: 'Música para tus momentos de silencio, gratitud y oración.', action: 'Escuchar música', to: '/alabanza', image: '/media/recurso-musica-vinilo-3d-alpha-v5.png', imageAlt: 'Funda de álbum tridimensional de El Camino Angosto y vinilo negro', object: true, brand: true },
]

// Sustituir solo estas dos rutas cuando esté disponible la presentación final.
// No se reutilizan los clips narrativos existentes porque no son una
// introducción identificable del dueño de El Camino.
const presentationVideo = {
  src: null as string | null,
  poster: null as string | null,
  title: 'Presentación de El Camino',
}

function textoTarjeta(card: FeedCard) {
  return card.title ?? card.caption ?? card.manifesto ?? 'Una pausa para volver al centro.'
}

function FaithCardsCarousel() {
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useFeed()
  const cards = useMemo(() => data?.pages.flat() ?? [], [data])
  const [index, setIndex] = useState(0)
  const [stride, setStride] = useState(0)
  const [animating, setAnimating] = useState(false)
  const indexRef = useRef(0)
  const pauseUntilRef = useRef(0)
  const nextAdvanceRef = useRef(Date.now() + 6500)
  const pausedRef = useRef({ hidden: document.hidden, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches })
  const trackRef = useRef<HTMLDivElement>(null)

  // La API pagina por cursor: se pide cada página una única vez y TanStack Query
  // conserva el resultado compartido con /tarjetas.
  useEffect(() => {
    if (isPending || isError || !hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, cards.length])

  useEffect(() => {
    if (cards.length === 0) return
    indexRef.current = cards.length
    nextAdvanceRef.current = Date.now() + 6500
    setAnimating(false)
    setIndex(cards.length)
    requestAnimationFrame(() => setAnimating(true))
  }, [cards.length])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return undefined
    const updateStride = () => {
      const card = track.querySelector<HTMLElement>('[data-faith-card]')
      if (!card) return
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
      setStride(card.getBoundingClientRect().width + gap)
    }
    updateStride()
    const observer = new ResizeObserver(updateStride)
    observer.observe(track)
    return () => observer.disconnect()
  }, [cards.length])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { pausedRef.current = { hidden: document.hidden, reducedMotion: motionQuery.matches } }
    update()
    document.addEventListener('visibilitychange', update)
    motionQuery.addEventListener('change', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      motionQuery.removeEventListener('change', update)
    }
  }, [])

  const move = (direction: 1 | -1, manual = false) => {
    if (cards.length < 2 || stride === 0) return
    if (manual) pauseUntilRef.current = Date.now() + 7500
    else nextAdvanceRef.current = Date.now() + 6500
    const next = indexRef.current + direction
    indexRef.current = next
    setAnimating(true)
    setIndex(next)
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pausedRef.current.hidden || pausedRef.current.reducedMotion || Date.now() < pauseUntilRef.current || Date.now() < nextAdvanceRef.current) return
      move(1)
    }, 250)
    return () => window.clearInterval(timer)
  }, [cards.length, stride])

  const resetLoopPosition = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || cards.length === 0) return
    const current = indexRef.current
    if (current >= cards.length * 2 || current <= 0) {
      // Cada copia mide exactamente `cards.length * stride`. Restar o sumar
      // ese ciclo deja la misma tarjeta en la misma coordenada visual, sin
      // exponer el inicio/final de la pista.
      const resetIndex = current >= cards.length * 2 ? current - cards.length : current + cards.length
      indexRef.current = resetIndex
      const track = trackRef.current
      if (!track) return
      track.classList.remove('faith-cards__track--animating')
      track.style.transform = `translate3d(-${resetIndex * stride}px, 0, 0)`
      setIndex(resetIndex)
      // Forzar el estilo sin transición antes de reactivarla para el próximo
      // paso; no se desmonta ni se repinta la secuencia visible.
      void track.offsetWidth
      track.classList.add('faith-cards__track--animating')
    }
  }

  // Hay suficientes copias para cubrir las tres posiciones de escritorio y
  // una secuencia extra. Son los mismos datos publicados, no contenido falso.
  const copyCount = cards.length > 1 ? Math.max(3, 2 + Math.ceil(3 / cards.length)) : 1
  const repeatedCards = Array.from({ length: copyCount }, () => cards).flat()
  const stateMessage = isPending
    ? 'Cargando las tarjetas publicadas…'
    : isError
      ? 'No pudimos cargar las tarjetas publicadas en este momento.'
      : 'Aún no hay tarjetas publicadas para mostrar.'

  return (
    <section className="faith-cards" id="tarjetas" aria-labelledby="faith-cards-title">
      <div className="faith-cards__heading">
        <div>
          <p className="eyebrow eyebrow--dark">TARJETAS PARA EL CAMINO</p>
          <h2 id="faith-cards-title">Palabras para<br />volver al centro.</h2>
        </div>
        <Link className="text-link" to="/tarjetas">Seguir viendo tarjetas <span>↗</span></Link>
      </div>

      {cards.length > 0 ? (
        <>
          <div className="faith-cards__viewport" aria-roledescription="carrusel" aria-label="Tarjetas de fe publicadas">
            <div
              ref={trackRef}
              className={`faith-cards__track${animating ? ' faith-cards__track--animating' : ''}`}
              style={{ transform: `translate3d(-${index * stride}px, 0, 0)` }}
              onTransitionEnd={resetLoopPosition}
            >
              {repeatedCards.map((card, repeatedIndex) => {
                const isClone = cards.length > 1 && (repeatedIndex < cards.length || repeatedIndex >= cards.length * 2)
                const image = card.posterUrl ?? card.mediaUrl
                return (
                  <article className="faith-card" data-faith-card key={`${card.id}-${repeatedIndex}`} aria-hidden={isClone || undefined}>
                    {isClone
                      ? <img src={image} alt="" loading={repeatedIndex < 4 ? 'eager' : 'lazy'} />
                      : <Link to="/tarjetas" aria-label={`Ver tarjeta: ${textoTarjeta(card)}`}><img src={image} alt={textoTarjeta(card)} loading={repeatedIndex < 4 ? 'eager' : 'lazy'} /></Link>}
                  </article>
                )
              })}
            </div>
          </div>
          {cards.length > 1 && (
            <div className="faith-cards__controls" aria-label="Controles del carrusel de tarjetas">
              <button type="button" onClick={() => move(-1, true)} aria-label="Ver tarjeta anterior">←</button>
              <button type="button" onClick={() => move(1, true)} aria-label="Ver tarjeta siguiente">→</button>
              <p aria-live="polite">Tarjetas publicadas</p>
            </div>
          )}
        </>
      ) : <p className="faith-cards__status" role="status">{stateMessage}</p>}
    </section>
  )
}

function PastorsSection() {
  const pastors = pastoresPublicos
  const [index, setIndex] = useState(pastors.length)
  const [stride, setStride] = useState(0)
  const [animating, setAnimating] = useState(false)
  const indexRef = useRef(pastors.length)
  const pauseUntilRef = useRef(0)
  const nextAdvanceRef = useRef(Date.now() + 6500)
  const pausedRef = useRef({ hidden: document.hidden, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches })
  const trackRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track || pastors.length === 0) return undefined
    const updateStride = () => {
      const slide = track.querySelector<HTMLElement>('[data-pastor-slide]')
      if (slide) {
        const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
        setStride(slide.getBoundingClientRect().width + gap)
      }
    }
    updateStride()
    const observer = new ResizeObserver(updateStride)
    observer.observe(track)
    return () => observer.disconnect()
  }, [pastors.length])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { pausedRef.current = { hidden: document.hidden, reducedMotion: motionQuery.matches } }
    update()
    document.addEventListener('visibilitychange', update)
    motionQuery.addEventListener('change', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      motionQuery.removeEventListener('change', update)
    }
  }, [])

  const move = (direction: 1 | -1, manual = false) => {
    if (pastors.length < 2 || stride === 0) return
    if (manual) pauseUntilRef.current = Date.now() + 7500
    else nextAdvanceRef.current = Date.now() + 6500
    const next = indexRef.current + direction
    indexRef.current = next
    setAnimating(true)
    setIndex(next)
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pausedRef.current.hidden || pausedRef.current.reducedMotion || Date.now() < pauseUntilRef.current || Date.now() < nextAdvanceRef.current) return
      move(1)
    }, 250)
    return () => window.clearInterval(timer)
  }, [pastors.length, stride])

  const resetLoopPosition = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || pastors.length === 0) return
    const current = indexRef.current
    if (current < pastors.length * 2 && current > 0) return
    const resetIndex = current >= pastors.length * 2 ? current - pastors.length : current + pastors.length
    indexRef.current = resetIndex
    const track = trackRef.current
    if (!track) return
    track.classList.remove('pastors__track--animating')
    track.style.transform = `translate3d(-${resetIndex * stride}px, 0, 0)`
    setAnimating(false)
    setIndex(resetIndex)
    void track.offsetWidth
    requestAnimationFrame(() => {
      track.classList.add('pastors__track--animating')
      setAnimating(true)
    })
  }

  const repeatedPastors = pastors.length > 1 ? Array.from({ length: 3 }, () => pastors).flat() : pastors

  return (
    <section className="pastors" id="pastores" aria-labelledby="pastors-title">
      <div className="pastors__heading">
        <h2 id="pastors-title">Pastores para<br />caminar contigo.</h2>
      </div>
      {pastors.length > 0 ? (
        <>
          <div className="pastors__viewport" aria-roledescription="carrusel" aria-label="Pastores y acompañamiento pastoral">
            <div
              ref={trackRef}
              className={`pastors__track${animating ? ' pastors__track--animating' : ''}`}
              style={{ transform: `translate3d(-${index * stride}px, 0, 0)` }}
              onTransitionEnd={resetLoopPosition}
            >
              {repeatedPastors.map((pastor, repeatedIndex) => {
                const isClone = pastors.length > 1 && (repeatedIndex < pastors.length || repeatedIndex >= pastors.length * 2)
                return (
                  <article className="pastor-card" data-pastor-slide key={`${pastor.id}-${repeatedIndex}`} aria-hidden={isClone || undefined} inert={isClone || undefined}>
                    <img className="pastor-card__portrait" src={pastor.foto} alt={isClone ? '' : pastor.fotoAlt} loading={repeatedIndex < 4 ? 'eager' : 'lazy'} />
                    <div className="pastor-card__details">
                      {pastor.isPlaceholder && <p className="pastor-card__status">PERFIL PROVISIONAL</p>}
                      <p className="eyebrow eyebrow--dark">{pastor.rol}</p>
                      <h3>{pastor.nombre}</h3>
                      <p className="pastor-card__description">{pastor.descripcion}</p>
                      <div className="pastor-card__contact">
                        <div className="pastor-card__socials" aria-label={`Redes de ${pastor.nombre}`}>
                          {(['facebook', 'instagram', 'tiktok'] as const).map((red) => {
                            const label = red === 'facebook' ? 'Facebook' : red === 'instagram' ? 'Instagram' : 'TikTok'
                            const url = pastor.redes[red]
                            return url
                              ? <a key={red} href={url} target="_blank" rel="noreferrer" aria-label={`${label} de ${pastor.nombre}`}>{red === 'facebook' ? 'f' : red === 'instagram' ? '◎' : '♪'}</a>
                              : <span key={red} aria-label={`${label}: enlace pendiente de confirmación`} title="Enlace pendiente de confirmación">{red === 'facebook' ? 'f' : red === 'instagram' ? '◎' : '♪'}</span>
                          })}
                        </div>
                        {pastor.telefono && <p className="pastor-card__phone">{pastor.telefono}</p>}
                        {pastor.whatsapp && <a className="pastor-card__cta" href={pastor.whatsapp} target="_blank" rel="noreferrer">COMUNÍCATE <span>↗</span></a>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
          {pastors.length > 1 && <div className="pastors__controls" aria-label="Controles del carrusel de pastores">
            <button type="button" onClick={() => move(-1, true)} aria-label="Ver pastor anterior">←</button>
            <button type="button" onClick={() => move(1, true)} aria-label="Ver pastor siguiente">→</button>
            <p aria-live="polite">Acompañamiento pastoral</p>
          </div>}
        </>
      ) : <p className="pastors__empty" role="status">Los perfiles públicos de nuestros pastores estarán disponibles próximamente.</p>}
    </section>
  )
}

export function LandingPage() {
  useRegistrarVisita('landing')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const irASeccion = (event: MouseEvent<HTMLAnchorElement>, selector: string) => {
    event.preventDefault()
    setMobileNavOpen(false)
    const destino = document.querySelector<HTMLElement>(selector)
    if (!destino) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seccion = destino.getBoundingClientRect()
    const navHeight = document.querySelector<HTMLElement>('.editorial-nav')?.getBoundingClientRect().height ?? 0
    const disponible = Math.max(1, window.innerHeight - navHeight)
    const inicioAbsoluto = window.scrollY + seccion.top
    const titulo = destino.querySelector<HTMLElement>('h1, h2, [role="heading"]')
    const tituloAbsoluto = titulo ? window.scrollY + titulo.getBoundingClientRect().top : inicioAbsoluto
    // Una sección que cabe completa se centra en el espacio de lectura. Para
    // las largas, se compone respecto a su título real, no a un offset fijo.
    const puntoDeScroll = seccion.height <= disponible
      ? inicioAbsoluto - navHeight - (disponible - seccion.height) / 2
      : tituloAbsoluto - navHeight - Math.min(disponible * .14, Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 7)
    const limite = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    window.scrollTo({ top: Math.min(limite, Math.max(0, puntoDeScroll)), behavior: reduceMotion ? 'auto' : 'smooth' })
    window.history.replaceState(null, '', selector)
  }
  const [heroActive, setHeroActive] = useState(0)
  const [heroPrevious, setHeroPrevious] = useState<number | null>(null)
  const heroActiveRef = useRef(0)
  const heroPauseRef = useRef({ hidden: document.hidden, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches })
  const heroNextAdvanceRef = useRef(Date.now() + 6500)
  const [active, setActive] = useState(0)
  const [indicatorIndex, setIndicatorIndex] = useState(0)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const camino = caminos[active]!
  const hero = heroSlides[heroActive]!

  useEffect(() => {
    if (heroPrevious === null) return undefined
    const timeout = window.setTimeout(() => setHeroPrevious(null), 320)
    return () => window.clearTimeout(timeout)
  }, [heroActive, heroPrevious])

  const changeHero = (direction: 1 | -1) => {
    const current = heroActiveRef.current
    const next = (current + direction + heroSlides.length) % heroSlides.length
    heroActiveRef.current = next
    setHeroPrevious(current)
    setHeroActive(next)
    heroNextAdvanceRef.current = Date.now() + 6500
  }

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const deferAdvance = () => { heroNextAdvanceRef.current = Date.now() + 6500 }
    const updateVisibility = () => {
      heroPauseRef.current.hidden = document.hidden
      deferAdvance()
    }
    const updateMotion = () => {
      heroPauseRef.current.reducedMotion = motionQuery.matches
      deferAdvance()
    }
    document.addEventListener('visibilitychange', updateVisibility)
    motionQuery.addEventListener('change', updateMotion)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      motionQuery.removeEventListener('change', updateMotion)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const paused = heroPauseRef.current
      if (paused.hidden || paused.reducedMotion || Date.now() < heroNextAdvanceRef.current) return
      changeHero(1)
    }, 250)
    return () => window.clearInterval(interval)
  }, [])

  const updateIndicator = () => {
    const tab = tabRefs.current[indicatorIndex]
    if (tab) setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth })
  }

  useLayoutEffect(() => {
    updateIndicator()
    const tabs = tabsRef.current
    if (!tabs) return undefined
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(tabs)
    tabs.addEventListener('scroll', updateIndicator, { passive: true })
    window.addEventListener('resize', updateIndicator)
    return () => {
      observer.disconnect()
      tabs.removeEventListener('scroll', updateIndicator)
      window.removeEventListener('resize', updateIndicator)
    }
  }, [indicatorIndex])

  const selectTab = (index: number) => {
    setIndicatorIndex(index)
    if (index !== active) setActive(index)
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyToIndex: Record<string, number> = {
      ArrowRight: (index + 1) % caminos.length,
      ArrowLeft: (index - 1 + caminos.length) % caminos.length,
      Home: 0,
      End: caminos.length - 1,
    }
    const nextIndex = keyToIndex[event.key]
    if (nextIndex === undefined) return
    event.preventDefault()
    tabRefs.current[nextIndex]?.focus()
    selectTab(nextIndex)
  }

  return (
    <div className="editorial-landing" data-theme="dark">
      <header className={`editorial-nav${mobileNavOpen ? ' editorial-nav--open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape') setMobileNavOpen(false) }}>
        <a className="editorial-nav__brand" href="#inicio" aria-label="El Camino, inicio">
          <BrandLogo layout="horizontal" tone="light" size="md" decorative />
        </a>
        <nav className="editorial-nav__links" aria-label="Navegación principal">
          <a href="#comunidad" onClick={(event) => irASeccion(event, '#comunidad')}>Comunidad</a>
          <a href="#tarjetas" onClick={(event) => irASeccion(event, '#tarjetas')}>Tarjetas</a>
          <a href="#videos" onClick={(event) => irASeccion(event, '#videos')}>Videos</a>
          <a href="#pastores" onClick={(event) => irASeccion(event, '#pastores')}>Pastores</a>
          <a href="#invitacion" onClick={(event) => irASeccion(event, '#invitacion')}>Invitación</a>
        </nav>
        <Link className="editorial-nav__cta" to="/tarjetas">Ver contenido</Link>
        <button
          className="editorial-nav__menu"
          type="button"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileNavOpen ? '×' : '☰'}</span>
          <span className="sr-only">{mobileNavOpen ? 'Cerrar navegación' : 'Abrir navegación'}</span>
        </button>
        <nav id="mobile-navigation" className="editorial-nav__mobile-links" aria-label="Navegación móvil" aria-hidden={!mobileNavOpen} inert={!mobileNavOpen || undefined}>
          <a href="#comunidad" onClick={(event) => irASeccion(event, '#comunidad')}>Comunidad</a>
          <a href="#tarjetas" onClick={(event) => irASeccion(event, '#tarjetas')}>Tarjetas</a>
          <a href="#videos" onClick={(event) => irASeccion(event, '#videos')}>Videos</a>
          <a href="#pastores" onClick={(event) => irASeccion(event, '#pastores')}>Pastores</a>
          <a href="#invitacion" onClick={(event) => irASeccion(event, '#invitacion')}>Invitación</a>
          <Link to="/tarjetas" onClick={() => setMobileNavOpen(false)}>Ver contenido</Link>
        </nav>
      </header>

      <main>
        <section className="editorial-hero" id="inicio">
          {heroPrevious !== null && <HeroImage slide={heroSlides[heroPrevious]!} className="editorial-hero__image editorial-hero__image--leaving" decorative />}
          <HeroImage slide={hero} className={`editorial-hero__image editorial-hero__image--active editorial-hero__image--enter-${heroActive % 2}`} />
          <div className="editorial-hero__shade" />
          <div className={`editorial-hero__content editorial-hero__content--enter-${heroActive % 2}`}>
            <p className="eyebrow">{hero.eyebrow}</p>
            <h1>{hero.title}</h1>
            <p className="editorial-hero__lede">{hero.text}</p>
            <a className="text-link text-link--light" href="#comunidad" onClick={(event) => irASeccion(event, '#comunidad')}>Comienza tu camino <span>↗</span></a>
          </div>
          <div className="editorial-hero__controls" aria-label="Controles del carrusel principal">
            <button type="button" onClick={() => changeHero(-1)} aria-label="Ver diapositiva anterior">←</button>
            <button type="button" onClick={() => changeHero(1)} aria-label="Ver diapositiva siguiente">→</button>
            <p className="editorial-hero__index" aria-hidden="true">{String(heroActive + 1).padStart(2, '0')} / 03</p>
          </div>
          <p className="sr-only" aria-live="polite">Diapositiva {heroActive + 1} de {heroSlides.length}: {hero.titleText}</p>
        </section>

        <section className="community" id="comunidad">
          <div className="community__heading">
            <h2>Un espacio para<br />volver a lo esencial.</h2>
          </div>
          <div className="community__tabs" ref={tabsRef} role="tablist" aria-label="Áreas de El Camino">
            {caminos.map((item, index) => (
              <button key={item.tab} ref={(element) => { tabRefs.current[index] = element }} id={`camino-tab-${index}`} type="button" role="tab" aria-selected={active === index} aria-controls="camino-panel" tabIndex={active === index ? 0 : -1} onClick={() => selectTab(index)} onKeyDown={(event) => handleTabKeyDown(event, index)}>{item.tab}</button>
            ))}
            <span className="community__tab-indicator" aria-hidden="true" style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }} />
          </div>
          <div id="camino-panel" aria-labelledby={`camino-tab-${active}`} className={`community__feature${camino.object ? ' community__feature--object' : ''}`} role="tabpanel">
            <div key={active} className="community__feature-content">
              {camino.brand ? <div className="community__object community__object--music"><img src={camino.image} alt={camino.imageAlt} /><img className="community__object-brand" src="/brand/logo/el-camino-mark-wine.svg" alt="" aria-hidden="true" /></div> : <img src={camino.image} alt={camino.imageAlt} />}
              <div className="community__copy">
                <p className="eyebrow eyebrow--dark">{camino.tab}</p>
                <h3>{camino.title}</h3>
                <p>{camino.text}</p>
                <Link className="text-link" to={camino.to}>{camino.action} <span>↗</span></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="youtube-promo" id="videos" aria-labelledby="youtube-title">
          <picture className="youtube-promo__background">
            <source media="(max-width: 980px)" srcSet="/media/youtube-tablet-editorial-mobile-v2.png" />
            <img src="/media/youtube-tablet-editorial-desktop-v2.png" alt="Tablet moderna sobre una mesa de madera con el canal ElcaminoAngosto-Videos en pantalla" />
          </picture>
          <div className="youtube-promo__shade" aria-hidden="true" />
          <div className="youtube-promo__copy">
            <p className="eyebrow eyebrow--dark">EL CAMINO EN YOUTUBE</p>
            <h2 id="youtube-title">Sigue caminando<br />también en video.</h2>
            <p>Música, reflexiones e historias para hacer una pausa, volver al centro y seguir con intención.</p>
            <a className="text-link" href="https://www.youtube.com/@ElcaminoAngosto-e4d" target="_blank" rel="noreferrer">Visitar canal <span>↗</span></a>
          </div>
        </section>

        <FaithCardsCarousel />

        <section className="landing-introduction" aria-labelledby="landing-introduction-title">
          <div className="landing-introduction__video">
            <video
              controls
              preload="metadata"
              poster={presentationVideo.poster ?? undefined}
              aria-describedby="landing-introduction-status"
              aria-label={presentationVideo.title}
            >
              {presentationVideo.src && <source src={presentationVideo.src} type="video/mp4" />}
              Tu navegador no puede reproducir este video.
            </video>
            {!presentationVideo.src && <div className="landing-introduction__placeholder" aria-hidden="true"><span>▶</span><p>Video de presentación próximamente</p></div>}
            <p id="landing-introduction-status" className="sr-only">{presentationVideo.src ? 'Reproductor de la presentación de El Camino.' : 'El video de presentación de El Camino se añadirá próximamente.'}</p>
          </div>
          <div className="landing-introduction__copy">
            <p className="eyebrow">UNA BIENVENIDA</p>
            <h2 id="landing-introduction-title">Un lugar para<br />caminar con intención.</h2>
            <p>Muy pronto conocerás, en sus propias palabras, el corazón de El Camino y la manera de recorrerlo juntos.</p>
          </div>
        </section>

        <PastorsSection />

        <section className="invitation" id="invitacion">
          <div className="invitation__image"><img src="/media/invitacion-comunidad-centrada.png" alt="Grupo de cristianos contemporáneos caminando juntos junto al mar" /></div>
          <div className="invitation__copy"><p className="eyebrow eyebrow--dark">EL SIGUIENTE PASO</p><h2>Tu fe no tiene<br />que vivirse a solas.</h2><p>El Camino reúne formación, conversación y recursos para que encuentres un ritmo de fe que puedas habitar.</p><Link className="text-link" to="/entrar?registro=1">Únete a El Camino <span>↗</span></Link></div>
        </section>

        <section className="newsletter"><p className="eyebrow">UNA CARTA PARA EL CAMINO</p><h2>Recibe una pausa<br />en tu semana.</h2><p>Reflexiones y recursos para seguir caminando, directo en tu correo.</p><form onSubmit={(event) => event.preventDefault()}><label htmlFor="correo">Tu correo electrónico</label><input id="correo" type="email" placeholder="nombre@correo.com" required /><button type="submit">Suscribirme</button></form></section>
      </main>

      <footer className="editorial-footer"><BrandLogo layout="horizontal" tone="light" size="md" decorative /><p>Un lugar para caminar con fe, intención y compañía.</p><div><Link to="/entrar">Iniciar sesión</Link><Link to="/entrar?registro=1">Crear cuenta</Link></div><small>© {new Date().getFullYear()} El Camino</small></footer>
    </div>
  )
}
