// backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host:   config.get('MAIL_HOST')   || 'smtp.gmail.com',
      port:   config.get<number>('MAIL_PORT') || 587,
      secure: config.get('MAIL_SECURE') === 'true',
      auth: {
        user: config.get('MAIL_USER'),
        pass: config.get('MAIL_PASS'),
      },
    });
  }

  private get fromAddress(): string {
    return this.config.get('MAIL_FROM') || '"LAT Torneos" <noreply@lattorneos.com>';
  }

  private async send(options: nodemailer.SendMailOptions): Promise<void> {
    if (!this.config.get('MAIL_USER') || !this.config.get('MAIL_PASS')) {
      this.logger.warn(`Email no enviado (MAIL_USER/MAIL_PASS no configurados): ${options.subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.fromAddress, ...options });
      this.logger.log(`Email enviado a ${options.to}: ${options.subject}`);
    } catch (err) {
      this.logger.error(`Error enviando email a ${options.to}: ${err.message}`);
    }
  }

  // ── BASE HTML WRAPPER ────────────────────────────────────────────────────
  private wrap(content: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- HEADER -->
        <tr>
          <td style="background:#1B3A1B;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;">
              🎾 LAT Torneos
            </h1>
            <p style="margin:6px 0 0;color:#A7F3D0;font-size:13px;">Liga Abierta de Tenis</p>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
            ${content}
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#6B7280;font-size:12px;">
              Este es un mensaje automático de LAT Torneos.<br>
              Por favor no respondas a este correo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // ── BIENVENIDA — cuenta creada ───────────────────────────────────────────
  async sendWelcome(email: string, nombre: string, tempPassword?: string): Promise<void> {
    const passBlock = tempPassword
      ? `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0;">
           <p style="margin:0 0 8px;color:#374151;font-size:14px;font-weight:600;">Tu contraseña temporal:</p>
           <p style="margin:0;font-size:20px;font-weight:800;color:#1B3A1B;letter-spacing:2px;">${tempPassword}</p>
           <p style="margin:8px 0 0;color:#6B7280;font-size:12px;">Por seguridad, cámbiala la primera vez que ingreses.</p>
         </div>`
      : '';

    const html = this.wrap(`
      <h2 style="margin:0 0 8px;color:#1B3A1B;font-size:22px;font-weight:700;">¡Bienvenido/a a LAT Torneos!</h2>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${nombre}</strong>, tu cuenta ha sido creada exitosamente.</p>
      ${passBlock}
      <p style="color:#374151;font-size:14px;margin:0 0 8px;">Tu email de acceso es:</p>
      <p style="font-size:16px;font-weight:700;color:#1D4ED8;margin:0 0 24px;">${email}</p>
      <p style="color:#6B7280;font-size:13px;margin:0;">
        Desde tu cuenta podrás ver tu programación de partidos, resultados y torneos inscritos.
      </p>
    `);

    await this.send({ to: email, subject: '¡Bienvenido/a a LAT Torneos! 🎾', html });
  }

  // ── CONTRASEÑA CAMBIADA ──────────────────────────────────────────────────
  async sendPasswordChanged(email: string, nombre: string): Promise<void> {
    const html = this.wrap(`
      <h2 style="margin:0 0 8px;color:#1B3A1B;font-size:22px;font-weight:700;">Contraseña actualizada</h2>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Hola <strong>${nombre}</strong>, te confirmamos que la contraseña de tu cuenta LAT Torneos fue cambiada exitosamente.
      </p>
      <div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
        <p style="margin:0;color:#92400E;font-size:13px;">
          ⚠️ Si no fuiste tú quien realizó este cambio, contacta inmediatamente al administrador del torneo.
        </p>
      </div>
      <p style="color:#6B7280;font-size:13px;margin:0;">Correo asociado: <strong>${email}</strong></p>
    `);

    await this.send({ to: email, subject: 'Tu contraseña fue actualizada — LAT Torneos', html });
  }

  // ── CONFIRMACIÓN DE INSCRIPCIÓN ──────────────────────────────────────────
  async sendEnrollmentConfirmation(
    email: string,
    nombre: string,
    tournamentName: string,
    category: string,
    modality: string,
    status: 'approved' | 'reserved' | string,
    tempPassword?: string,
  ): Promise<void> {
    const isReserved = status === 'reserved';
    const statusBadge = isReserved
      ? `<span style="background:#FEF9C3;color:#92400E;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">RESERVADO — Pago pendiente</span>`
      : `<span style="background:#D1FAE5;color:#065F46;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">INSCRITO ✓</span>`;

    const passBlock = tempPassword
      ? `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;">
           <p style="margin:0 0 6px;color:#374151;font-size:13px;font-weight:600;">Cuenta creada — contraseña temporal:</p>
           <p style="margin:0;font-size:18px;font-weight:800;color:#1B3A1B;letter-spacing:2px;">${tempPassword}</p>
           <p style="margin:6px 0 0;color:#6B7280;font-size:12px;">Cámbiala al ingresar por primera vez.</p>
         </div>`
      : '';

    const reservedNote = isReserved
      ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;margin:16px 0;">
           <p style="margin:0;color:#92400E;font-size:13px;">
             Tu inscripción está reservada. Una vez confirmado el pago, tu estado cambiará a <strong>INSCRITO</strong>.
           </p>
         </div>`
      : '';

    const html = this.wrap(`
      <h2 style="margin:0 0 8px;color:#1B3A1B;font-size:22px;font-weight:700;">Confirmación de inscripción</h2>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Hola <strong>${nombre}</strong>, tu inscripción ha sido registrada.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:16px;">
        <tr style="background:#F9FAFB;">
          <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;width:40%;">Torneo</td>
          <td style="padding:12px 16px;font-size:14px;color:#111827;font-weight:700;">${tournamentName}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;border-top:1px solid #E5E7EB;">Categoría</td>
          <td style="padding:12px 16px;font-size:14px;color:#111827;font-weight:700;border-top:1px solid #E5E7EB;">${category}</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;border-top:1px solid #E5E7EB;">Modalidad</td>
          <td style="padding:12px 16px;font-size:14px;color:#111827;font-weight:700;border-top:1px solid #E5E7EB;">${modality === 'doubles' ? 'Dobles' : 'Singles'}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:600;border-top:1px solid #E5E7EB;">Estado</td>
          <td style="padding:12px 16px;border-top:1px solid #E5E7EB;">${statusBadge}</td>
        </tr>
      </table>
      ${reservedNote}
      ${passBlock}
    `);

    await this.send({ to: email, subject: `Inscripción registrada — ${tournamentName} 🎾`, html });
  }

  // ── RECUPERACIÓN DE CONTRASEÑA ───────────────────────────────────────────
  async sendPasswordReset(email: string, nombre: string, resetUrl: string): Promise<void> {
    const html = this.wrap(`
      <h2 style="margin:0 0 8px;color:#1B3A1B;font-size:22px;font-weight:700;">Recuperar contraseña</h2>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta LAT Torneos.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#1B3A1B,#2D6A2D);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.02em;">
          🔑 Restablecer contraseña
        </a>
      </div>
      <div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
        <p style="margin:0;color:#92400E;font-size:13px;">
          ⏰ Este enlace es válido por <strong>15 minutos</strong> y solo puede usarse una vez.<br>
          Si no solicitaste este cambio, ignora este correo.
        </p>
      </div>
      <p style="color:#9CA3AF;font-size:12px;margin:0;word-break:break-all;">
        O copia este enlace en tu navegador:<br>${resetUrl}
      </p>
    `);

    await this.send({ to: email, subject: 'Recuperar contraseña — LAT Torneos', html });
  }

  // ── PROGRAMACIÓN (con PDF adjunto) ───────────────────────────────────────
  async sendScheduleEmail(
    emails: string[],
    tournamentName: string,
    dateLabel: string,
    pdfBase64: string,
    filename: string,
  ): Promise<{ sent: number }> {
    if (!emails.length) return { sent: 0 };

    const html = this.wrap(`
      <h2 style="margin:0 0 8px;color:#1B3A1B;font-size:22px;font-weight:700;">Programación de partidos</h2>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Estimado/a jugador/a,<br><br>
        Adjunto encontrarás la programación de partidos del torneo
        <strong>${tournamentName}</strong> para <strong>${dateLabel}</strong>.
      </p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
        <p style="margin:0;color:#065F46;font-size:13px;font-weight:600;">
          📎 El PDF con el cronograma completo está adjunto a este correo.
        </p>
      </div>
      <p style="color:#6B7280;font-size:13px;margin:0;">
        Se recomienda llegar al menos <strong>20 minutos antes</strong> del horario asignado.
      </p>
    `);

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    let sent = 0;

    for (const to of emails) {
      await this.send({
        to,
        subject: `Programación — ${tournamentName} (${dateLabel})`,
        html,
        attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
      });
      sent++;
    }
    return { sent };
  }

  // ── CUADRO / DRAW (con PDF adjunto opcional) ─────────────────────────────
  async sendDrawEmail(
    emails: string[],
    tournamentName: string,
    category: string,
    pdfBase64?: string,
    filename?: string,
  ): Promise<{ sent: number }> {
    if (!emails.length) return { sent: 0 };

    const html = this.wrap(`
      <h2 style="margin:0 0 8px;color:#1B3A1B;font-size:22px;font-weight:700;">Cuadro de llaves publicado</h2>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Estimado/a jugador/a,<br><br>
        El cuadro de llaves para la categoría <strong>${category}</strong> del torneo
        <strong>${tournamentName}</strong> ha sido generado.
      </p>
      ${pdfBase64 ? `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
        <p style="margin:0;color:#065F46;font-size:13px;font-weight:600;">
          📎 El cuadro completo está adjunto en PDF.
        </p>
      </div>` : ''}
      <p style="color:#6B7280;font-size:13px;margin:0;">
        ¡Mucha suerte en el torneo! 🎾
      </p>
    `);

    const attachments =
      pdfBase64 && filename
        ? [{ filename, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
        : [];

    let sent = 0;
    for (const to of emails) {
      await this.send({ to, subject: `Cuadro publicado — ${tournamentName} / ${category}`, html, attachments });
      sent++;
    }
    return { sent };
  }
}
