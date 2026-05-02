import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config/index.js';

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
    console.log(`Email service connected to ${config.smtp.host}`);
  } else {
    // Development fallback: log emails to console
    console.log('SMTP not configured — emails will be logged to console');
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!transporter) {
    console.log('─── EMAIL (console mode) ───');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html.substring(0, 500)}...`);
    console.log('────────────────────────────');
    return;
  }

  await transporter.sendMail({
    from: config.fromEmail,
    to,
    subject,
    html,
  });
}
