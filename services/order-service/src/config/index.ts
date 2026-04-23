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
  productServiceUrl: string;
  cartServiceUrl: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3004', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  cartServiceUrl: process.env.CART_SERVICE_URL || 'http://localhost:3003',
};

validateJwtSecret(config.jwtSecret);

if (!config.databaseUrl) {
  console.error('FATAL: DATABASE_URL is not defined');
  process.exit(1);
}
