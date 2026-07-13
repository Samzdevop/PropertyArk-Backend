import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL?.includes('?')
                ? process.env.DATABASE_URL + "&connection_limit=5&pool_timeout=10"
                : process.env.DATABASE_URL + "?connection_limit=5&pool_timeout=10"
        }
    },
     log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error', 'warn']
});

export default prisma;