import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';

const logger = createLogger('notification-service');
let transporter: Transporter;

export function initEmailService(): void {
  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    logger.info({ host: config.smtp.host }, 'Email service connected');
  } else {
    logger.warn('SMTP not configured — emails will be logged');
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!transporter) {
    logger.info({ to, subject, body: html.substring(0, 500) }, 'EMAIL (console mode)');
    return;
  }

  await transporter.sendMail({
    from: config.fromEmail,
    to,
    subject,
    html,
  });
}
