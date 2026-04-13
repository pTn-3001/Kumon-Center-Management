import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AUTH_COOKIE_NAME, getStaffSessionFromToken } from '@/lib/auth';

export const runtime = 'nodejs';

function toLocalDate(dateText: string, timeText: string) {
  if (!dateText || !timeText) return null;
  const value = new Date(`${dateText}T${timeText}:00`);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  if (!(prisma as any).staffTimeEntry) {
    return NextResponse.json({ message: 'Cần cập nhật Prisma Client để dùng chấm công giờ (chạy migrate + generate).' }, { status: 503 });
  }

  const params = await context.params;
  const staffId = Number(params.id);
  const body = await request.json();

  const workDate = typeof body.workDate === 'string' ? body.workDate : '';
  const clockInTime = typeof body.clockInTime === 'string' ? body.clockInTime : '';
  const clockOutTime = typeof body.clockOutTime === 'string' ? body.clockOutTime : '';

  const clockIn = toLocalDate(workDate, clockInTime);
  const clockOut = clockOutTime ? toLocalDate(workDate, clockOutTime) : null;

  if (!clockIn || (clockOutTime && !clockOut)) {
    return NextResponse.json({ message: 'Giờ vào/ra không hợp lệ' }, { status: 400 });
  }

  if (clockOut && clockOut < clockIn) {
    return NextResponse.json({ message: 'Giờ ra phải sau giờ vào' }, { status: 400 });
  }

  const created = await prisma.staffTimeEntry.create({
    data: {
      staffId,
      workDate: new Date(`${workDate}T00:00:00`),
      clockIn,
      clockOut,
      note: typeof body.note === 'string' && body.note.length > 0 ? body.note : null,
    },
  });

  return NextResponse.json({
    id: created.id,
    workDate: created.workDate.toISOString().slice(0, 10),
    clockIn: created.clockIn.toISOString(),
    clockOut: created.clockOut ? created.clockOut.toISOString() : null,
    note: created.note,
  }, { status: 201 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  if (!(prisma as any).staffTimeEntry) {
    return NextResponse.json({ message: 'Cần cập nhật Prisma Client để dùng chấm công giờ (chạy migrate + generate).' }, { status: 503 });
  }

  const body = await request.json();
  const entryId = Number(body?.entryId);
  if (!entryId) {
    return NextResponse.json({ message: 'Thiếu entryId' }, { status: 400 });
  }

  const params = await context.params;
  const staffId = Number(params.id);

  await prisma.staffTimeEntry.deleteMany({ where: { id: entryId, staffId } });
  return NextResponse.json({ success: true });
}
