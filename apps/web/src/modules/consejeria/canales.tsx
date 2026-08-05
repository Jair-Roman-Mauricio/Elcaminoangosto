import type { ReactNode } from 'react'

/**
 * Los canales por los que se puede escribir a un consejero.
 *
 * Cada uno sabe convertir el dato en un enlace que abre lo que toca: `tel:`
 * marca, `mailto:` abre el correo, `wa.me` abre WhatsApp con la conversación
 * empezada. Escribir un número y que no se pueda pulsar es dejar a alguien
 * copiando dígitos en su peor momento.
 *
 * El orden importa: primero lo que responde antes. Quien está en crisis pulsa
 * el primero que ve.
 */
export interface Canal {
  clave: string
  nombre: string
  /** Qué hacer con el dato guardado. */
  enlace: (dato: string) => string
  icono: ReactNode
}

/** Deja solo los dígitos y el `+`: un número con espacios no marca. */
const soloNumero = (dato: string) => dato.replace(/[^\d+]/g, '')

export const CANALES: Canal[] = [
  {
    clave: 'whatsapp',
    nombre: 'WhatsApp',
    enlace: (dato) => `https://wa.me/${soloNumero(dato).replace('+', '')}`,
    icono: (
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.3 4.8 4.9-1.3A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.1 15.1l-.3-.2-2.9.8.8-2.8-.2-.3a8.1 8.1 0 0 1 6.7-12.6Zm-3 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.7-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.4Z" />
    ),
  },
  {
    clave: 'telefono',
    nombre: 'Llamar',
    enlace: (dato) => `tel:${soloNumero(dato)}`,
    icono: (
      <path d="M6.6 2.5a1.6 1.6 0 0 1 1.4.8l1.5 2.6c.3.5.2 1.2-.2 1.6l-1.3 1.2a11 11 0 0 0 5.3 5.3l1.2-1.3c.4-.4 1.1-.5 1.6-.2l2.6 1.5c.5.3.8.9.8 1.4v2.3c0 1-.8 1.8-1.8 1.8A16.9 16.9 0 0 1 2.5 4.3c0-1 .8-1.8 1.8-1.8h2.3Z" />
    ),
  },
  {
    clave: 'correo',
    nombre: 'Correo',
    enlace: (dato) => `mailto:${dato}`,
    icono: (
      <path d="M3 5.5h18c.6 0 1 .4 1 1v11c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1v-11c0-.6.4-1 1-1Zm1.6 1.8 7.4 5 7.4-5H4.6Zm15.6 1.4-7.7 5.2a1 1 0 0 1-1.1 0L3.8 8.7v8h16.4v-8Z" />
    ),
  },
  {
    clave: 'instagram',
    nombre: 'Instagram',
    enlace: (dato) => dato,
    icono: (
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.7 9.9 2.7 10.2 2.7 12s0 2.1.1 3.3c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.5.1-3.3s0-2.1-.1-3.3c-.1-1.1-.2-1.7-.4-2.1a3.4 3.4 0 0 0-.8-1.3 3.4 3.4 0 0 0-1.3-.8c-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm6.3-8.2a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z" />
    ),
  },
  {
    clave: 'facebook',
    nombre: 'Facebook',
    enlace: (dato) => dato,
    icono: (
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    ),
  },
]

/** El dato tal como se enseña: un número se lee, un enlace no. */
export function comoSeLee(clave: string, dato: string): string {
  if (clave === 'telefono' || clave === 'whatsapp' || clave === 'correo') return dato
  return dato.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}
