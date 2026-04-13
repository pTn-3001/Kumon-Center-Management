import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE_NAME, AUTH_SESSION_SECONDS, createSessionToken, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

function mapRole(value: string) {
  if (value === 'TEACHER') return 'Giáo viên';
  if (value === 'ASSISTANT') return 'Trợ giảng';
  if (value === 'CONSULTANT') return 'Tư vấn';
  return 'Admin';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ message: 'Vui lòng nhập username và mật khẩu' }, { status: 400 });
  }

  const staff = await prisma.staff.findFirst({
    where: { username },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      passwordHash: true,
    },
  });
  if (!staff || !staff.active || !staff.passwordHash) {
    return NextResponse.json({ message: 'Tài khoản hoặc mật khẩu không đúng' }, { status: 401 });
  }

  const valid = verifyPassword(password, staff.passwordHash);
  if (!valid) {
    return NextResponse.json({ message: 'Tài khoản hoặc mật khẩu không đúng' }, { status: 401 });
  }

  const role = mapRole(staff.role);
  const token = createSessionToken({
    staffId: staff.id,
    username,
    role,
  });

  const response = NextResponse.json({
    id: staff.id,
    fullName: staff.fullName,
    username: staff.username,
    role,
    email: staff.email,
    phone: staff.phone,
  });

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_SESSION_SECONDS,
  });

  return response;
}
