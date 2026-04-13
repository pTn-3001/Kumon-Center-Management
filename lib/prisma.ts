const { PrismaClient } = require('@prisma/client') as { PrismaClient: new (...args: any[]) => any };

const globalForPrisma = globalThis as unknown as {
  prisma?: any;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
