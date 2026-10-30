import { prisma } from '@/lib/prisma';

export const DEFAULT_CENTER_ID = 1;
export const OWNER_ADMIN_USERNAME = process.env.OWNER_ADMIN_USERNAME || 'admin';

export function getVisibleStaffWhere(centerId: number) {
  return {
    centerId,
    NOT: {
      username: OWNER_ADMIN_USERNAME,
    },
  };
}

export function toNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function parseDateInput(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return new Date();
  }

  return new Date(value);
}

export async function ensureDefaultCenter() {
  return prisma.center.upsert({
    where: { id: DEFAULT_CENTER_ID },
    create: { id: DEFAULT_CENTER_ID, code: 'KUMON-GIAHOA', name: 'Kumon Gia Hòa' },
    update: { name: 'Kumon Gia Hòa' },
  });
}
