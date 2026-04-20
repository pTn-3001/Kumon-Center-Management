import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, parseDateInput, toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

const EXTRA_CLASS_NOTE_PREFIX = '[EXTRA_CLASS]';

function toClassShift(value: string) {
  if (value === 'SHIFT_2') return 'Ca 2';
  if (value === 'SHIFT_3') return 'Ca 3';
  if (value === 'SHIFT_4') return 'Ca 4';
  if (value === 'SHIFT_5') return 'Ca 5';
  return 'Ca 1';
}

function fromStudentStatus(value: string) {
  if (value === 'DROPPED') return 'Thôi học';
  if (value === 'TRIAL') return 'Học thử';
  if (value === 'EXPIRED') return 'Hết hạn';
  return 'Chính thức';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const classGroupId = toNumber(body.classGroupId);
  const studentId = toNumber(body.studentId);

  if (!classGroupId || !studentId || !body.scheduledAt) {
    return NextResponse.json({ message: 'Thiếu thông tin học viên học thêm' }, { status: 400 });
  }

  const classGroup = await prisma.classGroup.findFirst({
    where: {
      id: classGroupId,
      centerId: DEFAULT_CENTER_ID,
    },
    select: {
      id: true,
      subjectCode: true,
      classShift: true,
    },
  });

  if (!classGroup) {
    return NextResponse.json({ message: 'Không tìm thấy lớp học' }, { status: 404 });
  }

  const created = await prisma.personalSchedule.create({
    data: {
      centerId: DEFAULT_CENTER_ID,
      studentId,
      subjectCode: classGroup.subjectCode,
      classShift: classGroup.classShift,
      scheduledAt: parseDateInput(body.scheduledAt),
      note: `${EXTRA_CLASS_NOTE_PREFIX}${classGroupId}`,
    },
    include: {
      student: { select: { id: true, fullName: true, status: true } },
    },
  });

  return NextResponse.json({
    id: created.id,
    classGroupId,
    studentId: created.studentId,
    subjectCode: created.subjectCode,
    classShift: toClassShift(created.classShift),
    scheduledAt: created.scheduledAt.toISOString(),
    note: created.note,
    student: {
      id: created.student.id,
      fullName: created.student.fullName,
      status: fromStudentStatus(created.student.status),
    },
  }, { status: 201 });
}
