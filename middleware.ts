import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'kumon_auth';

type SessionRole = 'Admin' | 'Giáo viên' | 'Trợ giảng' | 'Tư vấn';

function isPublicPath(pathname: string) {
  return pathname === '/sign-in' || pathname.startsWith('/api/auth/sign-in');
}

function isBypassPath(pathname: string) {
  return pathname.startsWith('/_next')
    || pathname.startsWith('/images')
    || pathname === '/favicon.ico'
    || pathname === '/icon.png';
}

function isAuthSelfServicePath(pathname: string) {
  return pathname === '/api/auth/session'
    || pathname === '/api/auth/sign-out'
    || pathname === '/api/auth/change-password';
}

function normalizeRole(value: unknown): SessionRole {
  if (value === 'Giáo viên') return 'Giáo viên';
  if (value === 'Trợ giảng') return 'Trợ giảng';
  if (value === 'Tư vấn') return 'Tư vấn';
  return 'Admin';
}

function extractRoleFromToken(token: string | undefined): SessionRole | null {
  if (!token) return null;

  const encodedPayload = token.split('.')[0];
  if (!encodedPayload) return null;

  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = `${base64}${'='.repeat(padLength)}`;
    const payloadText = decodeURIComponent(escape(atob(padded)));
    const payload = JSON.parse(payloadText) as { role?: string; exp?: number };
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      return null;
    }

    return normalizeRole(payload.role);
  } catch {
    return null;
  }
}

function isAllowedPath(role: SessionRole, pathname: string, searchParams: URLSearchParams) {
  if (pathname === '/api/notifications' || pathname.startsWith('/api/notifications/')) {
    return true;
  }

  if (role === 'Admin') {
    return true;
  }

  if (role === 'Giáo viên' || role === 'Trợ giảng') {
    const allowedPrefixes = ['/hoc-vien', '/lop-hoc', '/hoc-thuat', '/api/hoc-vien', '/api/lop-hoc', '/api/hoc-thuat'];
    return allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }

  if (role === 'Tư vấn') {
    const allowedPrefixes = ['/hoc-vien', '/lop-hoc', '/tu-van', '/in-giay-khen', '/api/hoc-vien', '/api/lop-hoc', '/api/tu-van', '/api/certificates'];
    const isPrefixAllowed = allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (isPrefixAllowed) {
      return true;
    }

    if (pathname === '/hoc-thuat') {
      return searchParams.get('tab') === 'kho';
    }

    if (pathname.startsWith('/api/hoc-thuat')) {
      return true;
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const hasSession = Boolean(token);
  const role = extractRoleFromToken(token);

  if (!hasSession && !isPublicPath(pathname)) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const signInUrl = new URL('/sign-in', request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (hasSession && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (hasSession && isAuthSelfServicePath(pathname)) {
    return NextResponse.next();
  }

  if (hasSession && role && !isPublicPath(pathname) && !isAllowedPath(role, pathname, searchParams)) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (role === 'Giáo viên' || role === 'Trợ giảng') {
      return NextResponse.redirect(new URL('/hoc-vien', request.url));
    }

    if (role === 'Tư vấn') {
      return NextResponse.redirect(new URL('/tu-van', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
