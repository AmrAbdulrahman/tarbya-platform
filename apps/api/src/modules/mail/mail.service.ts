import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Locale } from '@tarbya/db';
import type { Env } from '../../config/env';
import { EMAIL_LOGO_CID, emailLayout } from './email-layout';
import { EMAIL_LOGO_PNG_BASE64 } from './email-logo';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** The message body only; `send` wraps it in the branded layout. */
  html: string;
  /** Preview text shown after the subject in most inboxes. */
  preheader: string;
  locale: Locale;
}

interface Outgoing {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const LOGO = {
  filename: 'tarbya-logo.png',
  contentType: 'image/png',
  base64: EMAIL_LOGO_PNG_BASE64,
};

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

/**
 * Sends email through Resend's HTTPS API when `RESEND_API_KEY` is set (Railway blocks
 * outbound SMTP below the Pro plan), otherwise over SMTP (Mailpit locally).
 * Moves behind the pg-boss `email.send` queue with notifications (step 7).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly appUrl: string;
  private readonly resendKey?: string;
  private readonly transport?: Transporter;

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('SMTP_FROM', { infer: true });
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    this.resendKey = config.get('RESEND_API_KEY', { infer: true });
    if (this.resendKey) return;

    const user = config.get('SMTP_USER', { infer: true });
    const port = config.get('SMTP_PORT', { infer: true });
    this.transport = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      secure: port === 465,
      auth: user
        ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) }
        : undefined,
      // Fail fast: sign-in waits on this.
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  async send(mail: Mail): Promise<void> {
    const { to, subject, text, html, preheader, locale } = mail;
    const outgoing: Outgoing = {
      from: this.from,
      to,
      subject,
      text,
      html: emailLayout({ body: html, preheader, locale, appUrl: this.appUrl }),
    };
    // The layout's logo travels inside the email (cid:), not as a remote image.
    if (this.resendKey) {
      await this.sendWithResend(outgoing, this.resendKey);
    } else {
      await this.transport?.sendMail({
        ...outgoing,
        attachments: [
          {
            filename: LOGO.filename,
            contentType: LOGO.contentType,
            content: Buffer.from(LOGO.base64, 'base64'),
            cid: EMAIL_LOGO_CID,
          },
        ],
      });
    }
    this.logger.log(`Sent "${subject}"`);
  }

  private async sendWithResend(mail: Outgoing, key: string): Promise<void> {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...mail,
        attachments: [
          {
            filename: LOGO.filename,
            content_type: LOGO.contentType,
            content: LOGO.base64,
            content_id: EMAIL_LOGO_CID,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    }
  }
}
