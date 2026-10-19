/**
 * Datos para recibir donaciones. Es el ÚNICO sitio donde viven: la página y el
 * aviso los leen de aquí, y cambiar una cuenta no toca ningún componente.
 *
 * Una cuenta mal copiada manda el dinero a otra persona, así que los datos que
 * faltan NO se rellenan con una suposición: la interfaz se niega a pintar un
 * medio al que le falte algo (ver `medioDisponible`).
 */
export const DATOS_DE_DONACION = {
  /** Imagen del código QR de Yape. Se sirve desde `public/`. */
  yapeQr: '/donaciones/yape-qr.png',

  banco: 'BCP',
  titular: 'Rafael Enrique Roman Salazar',

  /** Código de Cuenta Interbancario, 20 dígitos, sin guiones ni espacios. */
  cci: '00219111109329404659',
} as const

export type Metodo = 'yape' | 'cci'

/** `cci` solo se ofrece si el número está completo (20 dígitos). */
export function medioDisponible(metodo: Metodo): boolean {
  if (metodo === 'yape') return DATOS_DE_DONACION.yapeQr.length > 0
  return /^\d{20}$/.test(DATOS_DE_DONACION.cci)
}

/** `0021 9111…` en grupos de cuatro: se lee y se compara con la app del banco. */
export function cciConEspacios(cci: string): string {
  return cci.replace(/(\d{4})(?=\d)/g, '$1 ')
}
