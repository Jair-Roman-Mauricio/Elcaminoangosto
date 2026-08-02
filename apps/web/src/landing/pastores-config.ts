/**
 * Solo deben añadirse aquí contactos con consentimiento explícito para la
 * landing pública. No derivar teléfonos, redes ni WhatsApp desde perfiles de
 * la plataforma o el directorio autenticado de mentores.
 */
export interface PastorPublico {
  id: string
  nombre: string
  rol: string
  descripcion: string
  foto: string
  fotoAlt: string
  telefono: string | null
  whatsapp: string | null
  redes: Record<'facebook' | 'instagram' | 'tiktok', string | null>
  /** Estos perfiles son ilustrativos hasta que el equipo confirme sus datos. */
  isPlaceholder?: boolean
}

const redesPendientes = {
  facebook: null,
  instagram: null,
  tiktok: null,
} as const

/**
 * Solo Rafael tiene datos de contacto autorizados. Los demás son perfiles
 * PLACEHOLDER explícitos: reemplazar nombre, foto, rol y enlaces antes de
 * presentar estos perfiles como personas reales.
 */
export const pastoresPublicos: PastorPublico[] = [
  {
    id: 'rafael-roman',
    nombre: 'Rafael Román',
    rol: 'Pastor',
    descripcion: 'Acompañamiento cercano para caminar la fe con calma, honestidad y esperanza.',
    foto: '/media/pastor-rafael-roman-v1.png',
    fotoAlt: 'Retrato de Rafael Román',
    telefono: '999 645 662',
    whatsapp: 'https://wa.me/51999645662',
    redes: redesPendientes,
  },
  {
    id: 'pastor-proximamente',
    nombre: 'Pastor próximamente',
    rol: 'Perfil por confirmar',
    descripcion: 'Descripción de ejemplo. Este perfil es provisional hasta contar con datos públicos autorizados.',
    foto: '/media/pastor-placeholder-editorial-v1.png',
    fotoAlt: 'Retrato ilustrativo de un perfil pastoral provisional',
    telefono: null,
    whatsapp: null,
    redes: redesPendientes,
    isPlaceholder: true,
  },
  {
    id: 'perfil-por-confirmar',
    nombre: 'Perfil por confirmar',
    rol: 'Acompañamiento pastoral',
    descripcion: 'Descripción de ejemplo. Este perfil es provisional y no representa a una persona ni contacto real.',
    foto: '/media/pastor-placeholder-editorial-v2.png',
    fotoAlt: 'Retrato ilustrativo de un segundo perfil pastoral provisional',
    telefono: null,
    whatsapp: null,
    redes: redesPendientes,
    isPlaceholder: true,
  },
]
