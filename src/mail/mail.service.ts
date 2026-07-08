import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly from = process.env.MAIL_FROM || 'team@expeditedtransportservices.net';
  private readonly logger = new Logger(MailService.name);

  async send(to: string, subject: string, html: string, text?: string): Promise<void> {
    const { error } = await this.resend.emails.send({ from: this.from, to, subject, html, text });
    if (error) {
      this.logger.error(`Resend error sending to ${to}: ${JSON.stringify(error)}`);
      throw new Error(error.message);
    }
  }
}
