import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Parse PostgreSQL schema from DATABASE_URL since the pg driver
// doesn't understand Prisma's ?schema= parameter
const databaseUrl = new URL(process.env.DATABASE_URL!);
const schema = databaseUrl.searchParams.get('schema') || 'public';
databaseUrl.searchParams.delete('schema');
databaseUrl.searchParams.delete('channel_binding');

const pool = new pg.Pool({ connectionString: databaseUrl.toString() });
const adapter = new PrismaPg(pool, { schema });

export const prisma = new PrismaClient({ adapter });
