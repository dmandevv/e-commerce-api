import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
