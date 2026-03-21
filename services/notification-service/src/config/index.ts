import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  rabbitmqUrl: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  fromEmail: string;
  userServiceUrl: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3006', 10),
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://user-service:3001',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  fromEmail: process.env.FROM_EMAIL || 'noreply@ecommerce.com',
};
