import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const DEFAULT_CENTER_ID = 1;

export async function ensureCenter() {
  return prisma.center.upsert({
    where: { id: DEFAULT_CENTER_ID },
    create: { id: DEFAULT_CENTER_ID, code: 'KUMON-DIAN', name: 'Kumon Dĩ An' },
    update: {},
  });
}

export function parseDateInput(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return new Date();
  }

  return new Date(value);
}

export function toNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}
