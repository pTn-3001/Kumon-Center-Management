const { PrismaClient } = require('@prisma/client') as { PrismaClient: new (...args: any[]) => any };

const globalForPrisma = globalThis as unknown as {
  prisma?: any;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Always retain prisma client singleton in globalThis (including production) to avoid exhausting connection pool
globalForPrisma.prisma = prisma;
