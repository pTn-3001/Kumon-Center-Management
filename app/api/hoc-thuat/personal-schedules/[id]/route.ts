import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, runtime, toNumber } from '../../_helpers';

export { runtime };

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();

  const updated = await prisma.personalSchedule.update({
    where: { id: toNumber(id) },
    data: {
      studentId: body.studentId !== undefined ? toNumber(body.studentId) : undefined,
      subjectCode: body.subjectCode,
      scheduledAt: body.scheduledAt ? parseDateInput(body.scheduledAt) : undefined,
      classShift: body.classShift,
      note: body.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    centerId: updated.centerId,
    studentId: updated.studentId,
    subjectCode: updated.subjectCode,
    scheduledAt: updated.scheduledAt.toISOString(),
    classShift: updated.classShift,
    note: updated.note,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  await prisma.personalSchedule.delete({ where: { id: toNumber(id) } });
  return NextResponse.json({ message: 'Đã xóa lịch học cá nhân' });
}
