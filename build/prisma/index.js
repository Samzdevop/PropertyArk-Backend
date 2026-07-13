"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
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
exports.default = prisma;
