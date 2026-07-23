import type { ReactNode } from 'react'
import { BrandLogo } from '@elcamino/ui/static'
import { PanelCurvo } from './panel-curvo'

/**
 * Marco estático para los pasos auxiliares de autenticación.
 *
 * Recuperar, restablecer y verificar el correo son variaciones del mismo
 * formulario. No se anima su montaje para que el cambio entre ellas no se
 * sienta como una pantalla completamente distinta.
 */
export function AuthUtilityShell({
  children,
  leyenda,
}: {
  children: ReactNode
  leyenda: ReactNode
}) {
  return (
    <div data-theme="dark" className="relative min-h-screen overflow-hidden bg-negro">
      <img
        src="/brand/paisaje.webp"
        alt=""
        aria-hidden
        width={1535}
        height={1024}
        className="absolute inset-0 h-full w-full object-cover object-[47%_42%] md:object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0 md:hidden"
        style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,.25), rgba(10,10,10,.95))' }}
      />
      <PanelCurvo className="absolute inset-y-0 right-0 hidden h-full w-[56%] md:block xl:w-[50%]" />

      <main className="relative grid min-h-screen grid-cols-1 content-center md:grid-cols-[62%_38%] md:content-stretch">
        <div className="flex flex-col items-center justify-center gap-aire-s px-gutter pt-aire-l text-center md:min-h-screen md:pt-0">
          <BrandLogo layout="horizontal" tone="light" size="lg" />
          <span aria-hidden className="h-px w-12 bg-vino md:w-16" />
          <p className="m-0 hidden font-mono text-eyebrow uppercase leading-relaxed tracking-label text-texto-tenue md:block">
            {leyenda}
          </p>
        </div>

        <div className="flex items-center justify-center px-gutter py-aire-l md:min-h-screen">
          <div className="flex w-full max-w-sm flex-col gap-aire-m">{children}</div>
        </div>
      </main>
    </div>
  )
}
