import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateJwtSecret, validateEnv } from '@ecommerce/shared/middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  rabbitmqUrl: string;
  redisUrl: string;
  userServiceUrl: string;
  productServiceUrl: string;
  cartServiceUrl: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3004', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  cartServiceUrl: process.env.CART_SERVICE_URL || 'http://localhost:3003',
};

validateJwtSecret(config.jwtSecret);
validateEnv(['DATABASE_URL', 'REDIS_URL']);
