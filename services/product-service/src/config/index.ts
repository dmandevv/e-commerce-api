import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateJwtSecret, validateEnv } from '@ecommerce/shared/middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

interface Config {
    port: number,
    mongoUri: string,
    jwtSecret: string,
    rabbitmqUrl: string;
    redisUrl: string;
    cloudinary: {
        cloudName: string;
        apiKey: string;
        apiSecret: string;
    };
}

export const config: Config = {
    port: parseInt(process.env.PORT || '3002', 10),
    mongoUri: process.env.MONGODB_URI || 'mongodb://admin:admin_password@localhost:27017/product-service?authSource=admin',
    jwtSecret: process.env.JWT_SECRET || '',
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin_password@localhost:5672',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
};

validateJwtSecret(config.jwtSecret);
validateEnv(['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);