import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateJwtSecret, validateEnv } from '@ecommerce/shared/middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  redisUrl: string;
  jwtSecret: string;
  rabbitmqUrl: string;
  cartTtl: number;
  productServiceUrl: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3003', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  cartTtl: parseInt(process.env.CART_TTL || '259200', 10), // 72 hours in seconds
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
};

validateJwtSecret(config.jwtSecret);
validateEnv(['REDIS_URL']);
