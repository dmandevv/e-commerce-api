import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  rabbitmqUrl: string;
  clientUrl: string;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://admin:admin_password@localhost:27017/user-service?authSource=admin',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
};

if (!config.jwtSecret) {
  console.error('FATAL: JWT_SECRET is not defined');
  process.exit(1);
}
