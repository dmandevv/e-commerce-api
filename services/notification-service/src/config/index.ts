import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateJwtSecret, validateEnv } from '@ecommerce/shared/middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  rabbitmqUrl: string;
  jwtSecret: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  fromEmail: string;
  userServiceUrl: string;
  clientUrl: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3006', 10),
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  jwtSecret: process.env.JWT_SECRET || '',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://user-service:3001',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  fromEmail: process.env.SMTP_FROM || 'noreply@ecommerce.com',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};

validateJwtSecret(config.jwtSecret);
validateEnv(['RABBITMQ_URL', 'CLIENT_URL']);
