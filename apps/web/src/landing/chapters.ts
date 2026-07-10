/* ═══════════════════════════════════════════════════════════
   EL CAMINO — contenido editable de la landing
   Portado literalmente desde docs/legacy-landing/script.js.
   ═══════════════════════════════════════════════════════════ */

/** Dónde se coloca el texto sobre el video, elegido para NO tapar la figura. */
export type Pos = 'split' | 'top-center' | 'top-left' | 'bottom-left' | 'center'

export interface Chapter {
  numero: string
  lugar: string
  /** Ruta del mp4 encodeado (todos los fotogramas en keyframe). */
  video: string
  /** Frame extraído; evita el pantallazo negro. */
  poster: string
  titulo: string
  verso: string
  ref: string
  pos: Pos
  /** Multiplica VELOCIDAD_MAX solo en este capítulo. 1 = ritmo natural. */
  velocidad?: number
}

export const CHAPTERS: readonly Chapter[] = [
  {
    numero: '01',
    lugar: 'El desierto',
    video: '/media/1.mp4',
    poster: '/posters/1.jpg',
    titulo: 'El principio del camino',
    verso: 'Y el Espíritu le llevó al desierto, donde el silencio enseña a escuchar.',
    ref: 'Marcos 1:12',
    // La figura camina justo por el centro del encuadre: el título se
    // queda en el cielo y el versículo baja al pie, sin cruzarla.
    pos: 'split',
  },
  {
    numero: '02',
    lugar: 'La ladera',
    video: '/media/2.mp4',
    poster: '/posters/2.jpg',
    titulo: 'El Sermón del Monte',
    verso: 'Bienaventurados los de limpio corazón, porque ellos verán a Dios.',
    ref: 'Mateo 5:8',
    // Su rostro queda arriba-al-centro: el texto se va a la columna
    // izquierda (cielo y ladera limpios) para no cruzarle la cara.
    pos: 'top-left',
  },
  {
    numero: '03',
    lugar: 'El camino',
    video: '/media/3.mp4',
    poster: '/posters/3.jpg',
    titulo: 'Caminando juntos',
    verso: 'Ya no os llamo siervos, sino amigos. Nadie recorre este camino a solas.',
    ref: 'Juan 15:15',
    // La figura ocupa el centro: el texto baja al lateral inferior izquierdo.
    pos: 'bottom-left',
  },
  {
    numero: '04',
    lugar: 'El amanecer',
    video: '/media/4.mp4',
    poster: '/posters/4.jpg',
    titulo: 'Ha resucitado',
    verso: 'No está aquí, pues ha resucitado, así como dijo. Venid, ved el lugar.',
    ref: 'Mateo 28:6',
    // Centro luminoso: el texto se apoya justo sobre el resplandor.
    pos: 'center',
    // El clip de la tumba apenas tiene movimiento; a 1x se arrastra.
    velocidad: 1.9,
  },
] as const

/** El cierre reutiliza el último video (la tumba vacía) y añade el CTA. */
export const CIERRE = {
  label: 'El camino continúa',
  titulo: 'Comienza tu camino',
  verso: 'La historia no termina en la tumba. Empieza contigo.',
  /** Entra a la plataforma: música, tarjetas de fe y discipulado. */
  cta: { texto: 'Crear mi cuenta', to: '/entrar?registro=1' },
  ctaSecundario: { texto: 'Ya tengo cuenta', to: '/entrar' },
  pie: 'El Camino · Hecho con reverencia',
} as const

/** Los dos primeros videos se cargan de entrada; 3 y 4 se difieren. */
export const VIDEOS_INMEDIATOS = 2
