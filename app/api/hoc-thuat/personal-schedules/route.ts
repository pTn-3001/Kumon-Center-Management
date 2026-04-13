import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureCenter, parseDateInput, runtime, toNumber } from '../_helpers';

export { runtime };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const studentId = toNumber(body.studentId);

  if (!studentId || !body.subjectCode || !body.scheduledAt || !body.classShift) {
    return NextResponse.json({ message: 'Thiếu thông tin lịch học cá nhân' }, { status: 400 });
  }

  await ensureCenter();

  const created = await prisma.personalSchedule.create({
    data: {
      centerId: DEFAULT_CENTER_ID,
      studentId,
      subjectCode: body.subjectCode,
      scheduledAt: parseDateInput(body.scheduledAt),
      classShift: body.classShift,
      note: body.note ? String(body.note) : null,
    },
  });

  return NextResponse.json({
    id: created.id,
    centerId: created.centerId,
    studentId: created.studentId,
    subjectCode: created.subjectCode,
    scheduledAt: created.scheduledAt.toISOString(),
    classShift: created.classShift,
    note: created.note,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}
