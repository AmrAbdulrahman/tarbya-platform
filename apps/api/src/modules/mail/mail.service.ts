import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends email over SMTP. Moves behind the pg-boss `email.send` queue with notifications (step 7). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    const port = config.get('SMTP_PORT', { infer: true });
    this.from = config.get('SMTP_FROM', { infer: true });
    this.transport = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      secure: port === 465,
      auth: user
        ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) }
        : undefined,
    });
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...mail });
    this.logger.log(`Sent "${mail.subject}"`);
  }
}
