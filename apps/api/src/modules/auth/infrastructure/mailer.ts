import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'

/**
 * Correo saliente por SMTP. Si no hay SMTP configurado (local, staging sin
 * credenciales) el mensaje se registra en el log: así el enlace de verificación
 * o de recuperación sigue siendo alcanzable sin enviar nada fuera.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name)
  private readonly transporte: Transporter | null
  private readonly from: string

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')
    this.from = config.getOrThrow<string>('MAIL_FROM')
    this.transporte = host
      ? createTransport({
          host,
          port: config.getOrThrow<number>('SMTP_PORT'),
          auth: config.get('SMTP_USER')
            ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
            : undefined,
        })
      : null
  }

  async enviar(para: string, asunto: string, html: string, texto: string): Promise<void> {
    if (!this.transporte) {
      this.logger.warn(`SMTP sin configurar. Correo para ${para} — ${asunto}\n${texto}`)
      return
    }
    await this.transporte.sendMail({ from: this.from, to: para, subject: asunto, html, text: texto })
  }
}
