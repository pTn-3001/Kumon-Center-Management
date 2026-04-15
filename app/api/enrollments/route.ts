import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureDefaultCenter, parseDateInput, toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function fromSubjectCode(value: string) {
  return value;
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

export async function GET() {
  const enrollments = await prisma.enrollment.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      student: { select: { id: true, fullName: true, status: true } },
      classGroup: { select: { id: true, label: true, weekday: true, classShift: true } },
    },
  });

  return NextResponse.json(enrollments.map((enrollment: any) => ({
    ...enrollment,
    subjectCode: fromSubjectCode(enrollment.subjectCode),
    registrationType: fromRegistrationType(enrollment.registrationType),
    enrollmentType: fromEnrollmentType(enrollment.enrollmentType),
    classShift: fromClassShift(enrollment.classShift),
    startDate: enrollment.startDate.toISOString(),
    reportBDate: enrollment.reportBDate?.toISOString() ?? null,
    reenrollDate: enrollment.reenrollDate?.toISOString() ?? null,
    endDate: enrollment.endDate?.toISOString() ?? null,
  })));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  await ensureDefaultCenter();

  if (!body.studentId || !body.subjectCode || !body.registrationType || !body.enrollmentType || !body.studyDays || !body.classShift || !body.startDate) {
    return NextResponse.json({ message: 'Thiếu thông tin enrollment' }, { status: 400 });
  }

  const createDataBase = {
    studentId: toNumber(body.studentId),
    classGroupId: body.classGroupId ? toNumber(body.classGroupId) : null,
    subjectCode: body.subjectCode,
    registrationType: body.registrationType === 'Học thử' ? 'TRIAL' : 'OFFICIAL',
    enrollmentType: body.enrollmentType === 'Hàng ngày' ? 'DAILY' : 'TWICE_WEEKLY',
    studyDays: String(body.studyDays),
    classShift: body.classShift === 'Ca 2' ? 'SHIFT_2' : body.classShift === 'Ca 3' ? 'SHIFT_3' : body.classShift === 'Ca 4' ? 'SHIFT_4' : body.classShift === 'Ca 5' ? 'SHIFT_5' : 'SHIFT_1',
    startDate: parseDateInput(body.startDate),
    reenrollDate: body.reenrollDate ? parseDateInput(body.reenrollDate) : null,
    endDate: body.endDate ? parseDateInput(body.endDate) : null,
  };

  let created: any;
  try {
    created = await prisma.enrollment.create({
      data: {
        ...createDataBase,
        reportBDate: body.reportBDate ? parseDateInput(body.reportBDate) : null,
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

    const fallbackBase: any = { ...createDataBase };
    if (hasUnknownReenroll) {
      delete fallbackBase.reenrollDate;
    }

    created = await prisma.enrollment.create({
      data: hasUnknownReportB
        ? fallbackBase
        : {
            ...fallbackBase,
            reportBDate: body.reportBDate ? parseDateInput(body.reportBDate) : null,
          },
      include: {
        student: { select: { id: true, fullName: true, status: true } },
        classGroup: { select: { id: true, label: true, weekday: true, classShift: true } },
      },
    });
  }

  return NextResponse.json({
    ...created,
    subjectCode: fromSubjectCode(created.subjectCode),
    registrationType: fromRegistrationType(created.registrationType),
    enrollmentType: fromEnrollmentType(created.enrollmentType),
    classShift: fromClassShift(created.classShift),
    startDate: created.startDate.toISOString(),
    reportBDate: created.reportBDate?.toISOString() ?? null,
    reenrollDate: created.reenrollDate?.toISOString() ?? null,
    endDate: created.endDate?.toISOString() ?? null,
  }, { status: 201 });
}
