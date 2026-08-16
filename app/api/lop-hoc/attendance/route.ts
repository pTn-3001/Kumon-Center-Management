import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, parseDateInput, toNumber } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

function toAttendanceStatus(value: unknown) {
  return value === 'Vắng' ? 'ABSENT' : 'PRESENT';
}

function fromAttendanceStatus(value: string) {
  return value === 'ABSENT' ? 'Vắng' : 'Hiện diện';
}

function combineDateAndTime(dateInput: string, checkInTime?: string | null) {
  const [yearStr, monthStr, dayStr] = dateInput.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return parseDateInput(dateInput);
  }

  let hours = 0;
  let minutes = 0;
  if (checkInTime) {
    const [h, m] = checkInTime.split(':').map(Number);
    if (Number.isFinite(h)) hours = h;
    if (Number.isFinite(m)) minutes = m;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.classGroupId || !body.studentId || !body.date) {
    return NextResponse.json({ message: 'Thiếu thông tin điểm danh' }, { status: 400 });
  }

  const created = await prisma.attendance.create({
    data: {
      classGroupId: toNumber(body.classGroupId),
      studentId: toNumber(body.studentId),
      date: combineDateAndTime(body.date, body.checkInTime),
      checkOutAt: null,
      status: toAttendanceStatus(body.status),
      makeUpClassGroupId: body.makeUpClassGroupId ? toNumber(body.makeUpClassGroupId) : null,
    },
    include: {
      classGroup: { select: { label: true } },
      student: { select: { fullName: true } },
    },
  });

  if (created.status === 'ABSENT') {
    const attendanceDate = created.date.toLocaleDateString('vi-VN', {  day: '2-digit',  month: '2-digit', year: 'numeric', });
    const makeUpClass = created.makeUpClassGroupId
      ? await prisma.classGroup.findUnique({ where: { id: created.makeUpClassGroupId }, select: { label: true } })
      : null;
    const makeUpMessage = makeUpClass?.label ? `Học bù: ${makeUpClass.label}.` : 'Không có lịch học bù.';

    await createNotification({
      centerId: DEFAULT_CENTER_ID,
      type: 'ABSENT_ATTENDANCE',
      title: 'Học viên vắng mặt',
      message: `${created.student.fullName} vắng buổi ${created.classGroup.label} ngày ${attendanceDate}. ${makeUpMessage}`,
    });
  }

  return NextResponse.json({
    ...created,
    date: created.date.toISOString(),
    checkOutAt: created.checkOutAt?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    status: fromAttendanceStatus(created.status),
    classGroupLabel: created.classGroup.label,
    studentName: created.student.fullName,
  }, { status: 201 });
}
