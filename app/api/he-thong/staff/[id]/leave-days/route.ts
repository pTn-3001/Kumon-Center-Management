import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE_NAME, getStaffSessionFromToken } from '@/lib/auth';

export const runtime = 'nodejs';

function toUtcDateOnly(dateText: string) {
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const params = await context.params;
  const staffId = Number(params.id);
  const body = await request.json();
  const dates: unknown[] = Array.isArray(body?.dates) ? body.dates : [];

  const values = dates
    .map((value: unknown) => (typeof value === 'string' ? value : ''))
    .filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .map((value: string) => ({ staffId, leaveDate: toUtcDateOnly(value) }))
    .filter((value: { staffId: number; leaveDate: Date | null }): value is { staffId: number; leaveDate: Date } => Boolean(value.leaveDate));

  if (values.length === 0) {
    return NextResponse.json({ message: 'Thiếu ngày nghỉ phép hợp lệ' }, { status: 400 });
  }

  await prisma.staffLeave.createMany({
    data: values,
    skipDuplicates: true,
  });

  const leaveDays = await prisma.staffLeave.findMany({
    where: { staffId },
    orderBy: { leaveDate: 'asc' },
  });

  return NextResponse.json({
    leaveDays: leaveDays.map((item: { leaveDate: Date }) => item.leaveDate.toISOString().slice(0, 10)),
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const params = await context.params;
  const staffId = Number(params.id);
  const body = await request.json();
  const dateText = typeof body?.date === 'string' ? body.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return NextResponse.json({ message: 'Ngày nghỉ phép không hợp lệ' }, { status: 400 });
  }

  const leaveDate = toUtcDateOnly(dateText);
  if (!leaveDate) {
    return NextResponse.json({ message: 'Ngày nghỉ phép không hợp lệ' }, { status: 400 });
  }

  await prisma.staffLeave.deleteMany({
    where: {
      staffId,
      leaveDate,
    },
  });

  const leaveDays = await prisma.staffLeave.findMany({
    where: { staffId },
    orderBy: { leaveDate: 'asc' },
  });

  return NextResponse.json({
    leaveDays: leaveDays.map((item: { leaveDate: Date }) => item.leaveDate.toISOString().slice(0, 10)),
  });
}
