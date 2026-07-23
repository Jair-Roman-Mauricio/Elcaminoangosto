/**
 * Componentes sin dependencias de animación. Este punto de entrada evita que
 * una pantalla que solo necesita marca, botones o formularios descargue
 * Framer Motion junto con los controles multimedia.
 */
export { cn } from './lib/cn'
export { useReducedMotion } from './lib/use-reduced-motion'

export { Eyebrow, type EyebrowProps } from './components/eyebrow'
export {
  BrandLogo,
  BrandMark,
  type BrandLogoSize,
  type BrandLogoLayout,
  type BrandLogoProps,
  type BrandLogoTone,
} from './components/brand-logo'
export { Boton, type BotonProps, type BotonVariante } from './components/boton'
export { Card, type CardProps } from './components/card'
export {
  Field,
  Input,
  Textarea,
  Select,
  type FieldProps,
  type InputProps,
  type TextareaProps,
  type SelectProps,
} from './components/form'
export { Nav, NavLink, type NavProps } from './components/nav'
export { Verse, type VerseProps } from './components/verse'
