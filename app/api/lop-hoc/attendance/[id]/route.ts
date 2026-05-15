import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function toAttendanceStatus(value: unknown) {
  return value === 'Vắng' ? 'ABSENT' : 'PRESENT';
}

function fromAttendanceStatus(value: string) {
  return value === 'ABSENT' ? 'Vắng' : 'Hiện diện';
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const nextCheckOutAt = body.checkOutAt !== undefined
    ? (body.checkOutAt ? new Date(body.checkOutAt) : null)
    : undefined;

  if (nextCheckOutAt instanceof Date && Number.isNaN(nextCheckOutAt.getTime())) {
    return NextResponse.json({ message: 'Giờ ra không hợp lệ' }, { status: 400 });
  }

  const updated = await prisma.attendance.update({
    where: { id: toNumber(params.id) },
    data: {
      classGroupId: body.classGroupId !== undefined ? toNumber(body.classGroupId) : undefined,
      studentId: body.studentId !== undefined ? toNumber(body.studentId) : undefined,
      date: body.date !== undefined ? parseDateInput(body.date) : undefined,
      checkOutAt: nextCheckOutAt,
      status: body.status !== undefined ? toAttendanceStatus(body.status) : undefined,
      makeUpClassGroupId: body.makeUpClassGroupId !== undefined ? (body.makeUpClassGroupId ? toNumber(body.makeUpClassGroupId) : null) : undefined,
    },
    include: { classGroup: { select: { label: true } }, student: { select: { fullName: true } } },
  });

  return NextResponse.json({
    ...updated,
    date: updated.date.toISOString(),
    checkOutAt: updated.checkOutAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    status: fromAttendanceStatus(updated.status),
    classGroupLabel: updated.classGroup.label,
    studentName: updated.student.fullName,
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.attendance.delete({ where: { id: toNumber(params.id) } });
  return NextResponse.json({ message: 'Đã xóa điểm danh' });
}
