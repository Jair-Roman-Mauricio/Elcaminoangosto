import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { CHAPTERS, VIDEOS_INMEDIATOS } from './chapters'

/* ═══════════════════════════════════════════════════════════
   EL CAMINO — lógica de escena
   Portada desde docs/legacy-landing/script.js. Ningún video se
   reproduce solo: el scroll mueve su `currentTime` fotograma a
   fotograma. Los mp4 de media/ vienen con todos los fotogramas en
   keyframe (scripts/encode.sh); si no, cada seek obligaría a decodificar
   desde el keyframe anterior y el scrub iría a tirones.
   ═══════════════════════════════════════════════════════════ */

/** Ventana del crossfade, en fracción de viewport. */
const FADE_START = 'top 72%'
const FADE_END = 'top 28%'

/** El scrub termina cuando el capítulo siguiente acaba de taparlo. Si lo
 *  dejáramos correr hasta "bottom bottom", los últimos segundos de cada clip
 *  se reproducirían ya invisibles. */
const SCRUB_END = 'bottom 28%'

const EASE = 'power2.out'

interface Refs {
  root: HTMLDivElement | null
}

export function useEscena({ root }: Refs): void {
  useEffect(() => {
    if (!root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const TEXTO_IN = reduced ? 0.25 : 1.1
    const TEXTO_OUT = reduced ? 0.2 : 0.55
    const TEXTO_Y = reduced ? 0 : 22

    /** Segundos de video por segundo real. El scroll marca ADÓNDE debe ir el
     *  video, no a qué velocidad: por rápido que scrollees, nunca corre más
     *  que esto. Se queda atrás y avanza a velocidad de cine hasta alcanzarlo. */
    const VELOCIDAD_MAX = reduced ? Infinity : 1

    gsap.registerPlugin(ScrollTrigger)

    const q = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel))

    const overlays = q<HTMLElement>('.overlay')
    const layers = q<HTMLElement>('.video-layer')
    const videos = layers.map((l) => l.querySelector('video'))
    const counters = q<HTMLElement>('.counter__item')
    const hint = root.querySelector<HTMLElement>('[data-hint]')
    const secciones = q<HTMLElement>('.recorrido .chapter')

    // ── Carga diferida de los videos 3 y 4 ──────────────────────────────
    const cargarVideo = (i: number): void => {
      const v = videos[i]
      if (!v || v.src) return
      const src = v.dataset.src
      if (!src) return
      v.src = src
      v.load()
    }

    /** Mueve el video al fotograma que toca. `p` va de 0 a 1.
     *  Nos paramos un pelo antes del final (el último fotograma a veces no
     *  existe y el navegador se queda en negro), y no pedimos seek si el salto
     *  es menor que medio fotograma: cada petición cuesta. */
    const seek = (v: HTMLVideoElement, p: number): void => {
      if (!v.duration || !Number.isFinite(v.duration)) return
      if (v.readyState < 1) return
      const t = Math.max(0, Math.min(p, 1)) * (v.duration - 0.06)
      if (Math.abs(v.currentTime - t) < 1 / 48) return
      v.currentTime = t
    }

    // ── El bucle que persigue al scroll a velocidad de cine ─────────────
    const destino = CHAPTERS.map(() => 0)
    const cabeza = CHAPTERS.map(() => 0)

    let ultimoTick = performance.now()
    let rafId = 0

    const tick = (ahora: number): void => {
      // Si la pestaña estuvo oculta, dt sería enorme y el video saltaría.
      const dt = Math.min((ahora - ultimoTick) / 1000, 0.05)
      ultimoTick = ahora

      // El capítulo más alto que ya cubre del todo la pantalla: lo que quede
      // por debajo está tapado y no merece un solo seek.
      let techo = 0
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        if (parseFloat(layers[i]?.style.opacity || '0') >= 0.999) {
          techo = i
          break
        }
      }

      for (let i = techo; i < CHAPTERS.length; i++) {
        const v = videos[i]
        const layer = layers[i]
        if (!v || !layer || !v.duration || !Number.isFinite(v.duration)) continue

        // Un video invisible no se persigue: se teletransporta.
        const visible = parseFloat(layer.style.opacity || '0') > 0.01
        if (!visible) {
          cabeza[i] = destino[i]!
          continue
        }

        const diff = destino[i]! - cabeza[i]!
        if (Math.abs(diff) > 1e-4) {
          // El tope está en segundos de video; lo pasamos a progreso (0–1).
          const vel = VELOCIDAD_MAX * (CHAPTERS[i]?.velocidad ?? 1)
          const tope = (vel * dt) / (v.duration - 0.06)
          cabeza[i] = cabeza[i]! + Math.sign(diff) * Math.min(Math.abs(diff), tope)
        }
        seek(v, cabeza[i]!)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // ── Cambio de capítulo ──────────────────────────────────────────────
    let stepActual = -1

    const setActive = (step: number, instant = false): void => {
      if (step === stepActual) return
      stepActual = step

      // El cierre (step 4) se queda sobre el último video.
      const vIdx = Math.min(step, CHAPTERS.length - 1)

      // Precarga anticipada: el siguiente ya está listo cuando toca.
      cargarVideo(vIdx)
      cargarVideo(vIdx + 1)

      overlays.forEach((ov, i) => {
        const bloques = ov.querySelectorAll('.overlay__inner')
        if (i === step) {
          gsap.killTweensOf([ov, ...bloques])
          gsap.set(ov, { visibility: 'visible' })
          gsap.to(ov, { opacity: 1, duration: instant ? 0 : TEXTO_IN * 0.6, ease: EASE })
          // Fade + leve translate-up, escalonado: entra el título, luego el versículo.
          gsap.fromTo(
            bloques,
            { y: TEXTO_Y, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: instant ? 0 : TEXTO_IN,
              ease: EASE,
              delay: instant ? 0 : 0.12,
              stagger: instant ? 0 : 0.1,
            },
          )
        } else if (ov.style.visibility !== 'hidden') {
          gsap.killTweensOf(ov)
          gsap.to(ov, {
            opacity: 0,
            duration: instant ? 0 : TEXTO_OUT,
            ease: 'power1.in',
            onComplete: () => gsap.set(ov, { visibility: 'hidden' }),
          })
        }
      })

      counters.forEach((c, i) => c.classList.toggle('is-on', i === vIdx))

      // El indicador de scroll solo vive en el hero.
      if (hint) {
        gsap.to(hint, { opacity: step === 0 ? 1 : 0, duration: instant ? 0 : 0.5, ease: EASE })
      }
    }

    // ── Estado inicial ──────────────────────────────────────────────────
    layers.forEach((l, i) => {
      l.classList.remove('is-active')
      gsap.set(l, { opacity: i === 0 ? 1 : 0 })
    })
    for (let i = 0; i < VIDEOS_INMEDIATOS; i++) cargarVideo(i)
    overlays.forEach((ov) => gsap.set(ov, { opacity: 0, visibility: 'hidden' }))
    setActive(0, true)

    // ── Smooth scroll (Lenis) — se omite con reduced-motion ─────────────
    let lenis: Lenis | null = null
    let tickerFn: ((time: number) => void) | null = null

    if (!reduced) {
      lenis = new Lenis({
        duration: 1.25,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.4,
      })
      const l = lenis
      l.on('scroll', ScrollTrigger.update)
      tickerFn = (time: number) => l.raf(time * 1000)
      gsap.ticker.add(tickerFn)
      gsap.ticker.lagSmoothing(0)
    }

    // ── Scroll → escena ─────────────────────────────────────────────────
    const triggers: ScrollTrigger[] = []
    const tweens: gsap.core.Tween[] = []

    secciones.forEach((sec) => {
      const step = Number(sec.dataset.step)

      // a) Overlays y contador: el capítulo "manda" mientras su centro cruza
      //    el centro de la pantalla. Igual bajando que subiendo.
      triggers.push(
        ScrollTrigger.create({
          trigger: sec,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActive(step),
          onEnterBack: () => setActive(step),
        }),
      )

      if (step >= CHAPTERS.length) return // el cierre no tiene video propio

      const layer = layers[step]
      if (!layer) return

      // b) SCRUB: el scroll fija el DESTINO del video (0 a 1). Quién lo
      //    persigue —y a qué velocidad— es el bucle de arriba. Arranca antes
      //    de que la sección llene la pantalla, para que el video ya esté en
      //    movimiento durante el fundido y no aparezca congelado.
      triggers.push(
        ScrollTrigger.create({
          trigger: sec,
          start: step === 0 ? 'top top' : FADE_START,
          end: SCRUB_END,
          onUpdate: (self) => (destino[step] = self.progress),
          onLeave: () => (destino[step] = 1),
          onLeaveBack: () => (destino[step] = 0),
          onRefresh: (self) => (destino[step] = self.progress),
        }),
      )

      // c) CROSSFADE: solo hace falta hacer aparecer el entrante. Está por
      //    encima en el DOM, así que al llegar a opacidad 1 ya cubre al
      //    anterior. Un solo fundido = disolvencia limpia, sin bache oscuro.
      if (step > 0) {
        tweens.push(
          gsap.fromTo(
            layer,
            { opacity: 0 },
            {
              opacity: 1,
              ease: 'none',
              scrollTrigger: { trigger: sec, start: FADE_START, end: FADE_END, scrub: true },
            },
          ),
        )
      }
    })

    // Anclas internas a través de Lenis: si no, pelean entre sí.
    const anclas = q<HTMLAnchorElement>('a[href^="#"]')
    const onAncla = (e: MouseEvent): void => {
      const a = e.currentTarget as HTMLAnchorElement
      const id = a.getAttribute('href')
      if (!id || id === '#') return
      const target = root.querySelector(id)
      if (!target) return
      e.preventDefault()
      if (lenis) lenis.scrollTo(target as HTMLElement, { duration: 1.6 })
      else target.scrollIntoView()
    }
    anclas.forEach((a) => a.addEventListener('click', onAncla))

    // Si el navegador restaura el scroll a media página, recalculamos.
    const onLoad = (): void => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)

    // ── Limpieza: StrictMode monta el efecto dos veces en desarrollo ─────
    return () => {
      window.removeEventListener('load', onLoad)
      anclas.forEach((a) => a.removeEventListener('click', onAncla))
      cancelAnimationFrame(rafId)
      triggers.forEach((t) => t.kill())
      tweens.forEach((t) => t.scrollTrigger?.kill())
      tweens.forEach((t) => t.kill())
      if (tickerFn) gsap.ticker.remove(tickerFn)
      lenis?.destroy()
      gsap.killTweensOf(overlays)
    }
  }, [root])
}
