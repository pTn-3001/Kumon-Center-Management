import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function toWeekday(value: unknown) {
  return value === 'T3' || value === 'T4' || value === 'T5' || value === 'T6' || value === 'T7' ? value : 'T2';
}

function toClassShift(value: unknown) {
  if (value === 'Ca 2') return 'SHIFT_2';
  if (value === 'Ca 3') return 'SHIFT_3';
  if (value === 'Ca 4') return 'SHIFT_4';
  if (value === 'Ca 5') return 'SHIFT_5';
  return 'SHIFT_1';
}

function fromClassShift(value: string) {
  if (value === 'SHIFT_2') return 'Ca 2';
  if (value === 'SHIFT_3') return 'Ca 3';
  if (value === 'SHIFT_4') return 'Ca 4';
  if (value === 'SHIFT_5') return 'Ca 5';
  return 'Ca 1';
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const updated = await prisma.classGroup.update({
    where: { id: toNumber(params.id) },
    data: {
      label: body.label !== undefined ? String(body.label) : undefined,
      subjectCode: body.subjectCode !== undefined ? body.subjectCode : undefined,
      weekday: body.weekday !== undefined ? toWeekday(body.weekday) : undefined,
      classShift: body.classShift !== undefined ? toClassShift(body.classShift) : undefined,
      teacherId: body.teacherId !== undefined ? (body.teacherId ? toNumber(body.teacherId) : null) : undefined,
    },
    include: { teacher: { select: { id: true, fullName: true, role: true } } },
  });

  return NextResponse.json({
    ...updated,
    weekday: updated.weekday,
    classShift: fromClassShift(updated.classShift),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const classGroupId = toNumber(params.id);

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { classGroupId } }),
    prisma.enrollment.updateMany({ where: { classGroupId }, data: { classGroupId: null } }),
    prisma.classGroup.delete({ where: { id: classGroupId } }),
  ]);

  return NextResponse.json({ message: 'Đã xóa lớp học' });
}
