import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ใช้ Pool ที่ checkout client ใหม่ต่อ query
// ป้องกัน "client is already executing a query" warning
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// PrismaPg รับ Pool โดยตรง — จะ checkout/release client เองต่อ transaction
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
