import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateJwtSecret, validateEnv } from '@ecommerce/shared/middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  accessTokenExpiresIn: string;      // replaces jwtExpiresIn
  refreshTokenExpiresInDays: number;
  cookieSecure: boolean;             // HTTPS-only in prod
  cookieDomain: string;              // for cross-subdomain if needed
  rabbitmqUrl: string;
  redisUrl: string;
  clientUrl: string;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://admin:admin_password@localhost:27017/user-service?authSource=admin',
  jwtSecret: process.env.JWT_SECRET || '',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
};

validateJwtSecret(config.jwtSecret);
validateEnv(['MONGODB_URI', 'REDIS_URL', 'RABBITMQ_URL']);
