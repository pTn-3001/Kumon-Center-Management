import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function toRegistrationType(value: unknown) {
  return value === 'Học thử' ? 'TRIAL' : 'OFFICIAL';
}

function toEnrollmentType(value: unknown) {
  return value === 'Hàng ngày' ? 'DAILY' : 'TWICE_WEEKLY';
}

function toClassShift(value: unknown) {
  if (value === 'Ca 2') return 'SHIFT_2';
  if (value === 'Ca 3') return 'SHIFT_3';
  if (value === 'Ca 4') return 'SHIFT_4';
  if (value === 'Ca 5') return 'SHIFT_5';
  return 'SHIFT_1';
}

function fromRegistrationType(value: string) {
  return value === 'TRIAL' ? 'Học thử' : 'Chính thức';
}

function fromEnrollmentType(value: string) {
  return value === 'DAILY' ? 'Hàng ngày' : '2 buổi/tuần';
}

function fromClassShift(value: string) {
  if (value === 'SHIFT_2') return 'Ca 2';
  if (value === 'SHIFT_3') return 'Ca 3';
  if (value === 'SHIFT_4') return 'Ca 4';
  if (value === 'SHIFT_5') return 'Ca 5';
  return 'Ca 1';
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json();
  const updateDataBase = {
    studentId: body.studentId !== undefined ? toNumber(body.studentId) : undefined,
    classGroupId: body.classGroupId !== undefined ? (body.classGroupId ? toNumber(body.classGroupId) : null) : undefined,
    subjectCode: body.subjectCode !== undefined ? body.subjectCode : undefined,
    registrationType: body.registrationType !== undefined ? toRegistrationType(body.registrationType) : undefined,
    enrollmentType: body.enrollmentType !== undefined ? toEnrollmentType(body.enrollmentType) : undefined,
    studyDays: body.studyDays !== undefined ? String(body.studyDays) : undefined,
    classShift: body.classShift !== undefined ? toClassShift(body.classShift) : undefined,
    currentLevel: body.currentLevel !== undefined ? (body.currentLevel ? String(body.currentLevel) : null) : undefined,
    startDate: body.startDate !== undefined ? parseDateInput(body.startDate) : undefined,
    reenrollDate: body.reenrollDate !== undefined ? (body.reenrollDate ? parseDateInput(body.reenrollDate) : null) : undefined,
    endDate: body.endDate !== undefined ? (body.endDate ? parseDateInput(body.endDate) : null) : undefined,
  };

  let updated: any;
  try {
    updated = await prisma.enrollment.update({
      where: { id: toNumber(params.id) },
      data: {
        ...updateDataBase,
        reportBDate: body.reportBDate !== undefined ? (body.reportBDate ? parseDateInput(body.reportBDate) : null) : undefined,
      },
      include: {
        student: { select: { id: true, fullName: true, status: true } },
        classGroup: { select: { id: true, label: true, weekday: true, classShift: true } },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const hasUnknownReportB = message.includes('Unknown argument `reportBDate`');
    const hasUnknownReenroll = message.includes('Unknown argument `reenrollDate`');
    if (!hasUnknownReportB && !hasUnknownReenroll) {
      throw error;
    }

    const fallbackBase: any = { ...updateDataBase };
    if (hasUnknownReenroll) {
      delete fallbackBase.reenrollDate;
    }

    updated = await prisma.enrollment.update({
      where: { id: toNumber(params.id) },
      data: hasUnknownReportB
        ? fallbackBase
        : {
            ...fallbackBase,
            reportBDate: body.reportBDate !== undefined ? (body.reportBDate ? parseDateInput(body.reportBDate) : null) : undefined,
          },
      include: {
        student: { select: { id: true, fullName: true, status: true } },
        classGroup: { select: { id: true, label: true, weekday: true, classShift: true } },
      },
    });
  }

  return NextResponse.json({
    ...updated,
    subjectCode: updated.subjectCode,
    registrationType: fromRegistrationType(updated.registrationType),
    enrollmentType: fromEnrollmentType(updated.enrollmentType),
    classShift: fromClassShift(updated.classShift),
    startDate: updated.startDate.toISOString(),
    reportBDate: updated.reportBDate?.toISOString() ?? null,
    reenrollDate: updated.reenrollDate?.toISOString() ?? null,
    endDate: updated.endDate?.toISOString() ?? null,
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  await prisma.enrollment.delete({ where: { id: toNumber(params.id) } });
  return NextResponse.json({ message: 'Đã xóa enrollment' });
}
