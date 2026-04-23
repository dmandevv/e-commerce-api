import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateJwtSecret } from '@ecommerce/shared/middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  rabbitmqUrl: string;
  redisUrl: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3005', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

validateJwtSecret(config.jwtSecret);

if (!config.databaseUrl) {
  console.error('FATAL: DATABASE_URL is not defined');
  process.exit(1);
}

if (!config.stripeSecretKey) {
  console.error('FATAL: STRIPE_SECRET_KEY is not defined');
  process.exit(1);
}
