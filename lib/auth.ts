import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { StaffRole } from '@/types';
import { prisma } from '@/lib/prisma';

export const AUTH_COOKIE_NAME = 'kumon_auth';
export const AUTH_SESSION_SECONDS = 60 * 60 * 24;

const AUTH_SECRET = process.env.AUTH_SECRET || 'kumon-management-local-auth-secret';

type SessionPayload = {
  staffId: number;
  username: string;
  role: StaffRole;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const derived = scryptSync(password, salt, 64).toString('hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  const derivedBuffer = Buffer.from(derived, 'hex');
  if (hashBuffer.length !== derivedBuffer.length) return false;

  return timingSafeEqual(hashBuffer, derivedBuffer);
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>) {
  const exp = Math.floor(Date.now() / 1000) + AUTH_SESSION_SECONDS;
  const fullPayload: SessionPayload = { ...payload, exp };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getStaffSessionFromToken(token: string | undefined) {
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const staff = await prisma.staff.findUnique({
    where: { id: payload.staffId },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      active: true,
    },
  });
  if (!staff || !staff.active || !staff.username) return null;

  const role: StaffRole = staff.role === 'TEACHER'
    ? 'Giáo viên'
    : staff.role === 'ASSISTANT'
      ? 'Trợ giảng'
      : staff.role === 'CONSULTANT'
        ? 'Tư vấn'
        : 'Admin';

  return {
    id: staff.id,
    fullName: staff.fullName,
    username: staff.username,
    email: staff.email,
    phone: staff.phone,
    role,
  };
}
