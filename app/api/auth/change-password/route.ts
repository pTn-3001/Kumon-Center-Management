import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE_NAME, getStaffSessionFromToken, hashPassword, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: 'Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      passwordHash: true,
    },
  });
  if (!staff || !staff.passwordHash) {
    return NextResponse.json({ message: 'Tài khoản không hợp lệ' }, { status: 400 });
  }

  const valid = verifyPassword(currentPassword, staff.passwordHash);
  if (!valid) {
    return NextResponse.json({ message: 'Mật khẩu hiện tại không đúng' }, { status: 401 });
  }

  await prisma.staff.update({
    where: { id: session.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return NextResponse.json({ success: true });
}
