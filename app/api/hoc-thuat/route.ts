import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/api-helpers';
import { DEFAULT_CENTER_ID } from './_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssessmentRow = {
  id: number;
  studentId: number;
  subjectCode: 'MATH' | 'EFL';
  level: string;
  correctAnswers: number;
  totalQuestions: number;
  actualMinutes: number;
  standardMinutes: number;
  groupNo: number;
  testDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type WorksheetBatchRow = {
  id: number;
  centerId: number;
  subjectCode: 'MATH' | 'EFL';
  level: string;
  codeRange: string;
  quantity: number;
  receivedAt: Date;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WorksheetUsageRow = {
  id: number;
  batchId: number;
  studentId: number | null;
  quantity: number;
  usedAt: Date;
  preparedBy: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PersonalScheduleRow = {
  id: number;
  centerId: number;
  studentId: number;
  subjectCode: 'MATH' | 'EFL';
  scheduledAt: Date;
  classShift: 'SHIFT_1' | 'SHIFT_2' | 'SHIFT_3' | 'SHIFT_4' | 'SHIFT_5';
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceRow = {
  id: number;
  classGroupId: number;
  studentId: number;
  date: Date;
  checkOutAt: Date | null;
  status: 'PRESENT' | 'ABSENT';
  makeUpClassGroupId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function fromStudentStatus(value: string) {
  if (value === 'DROPPED') return 'Thôi học';
  if (value === 'TRIAL') return 'Học thử';
  if (value === 'EXPIRED') return 'Hết hạn';
  return 'Chính thức';
}

function fromSubjectCode(value: string) {
  return value === 'EFL' ? 'EFL' : 'MATH';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');
  const monthParam = searchParams.get('month');

  const studentId = studentIdParam ? toNumber(studentIdParam) : null;

  const attendanceWhere: any = {
    classGroup: { centerId: DEFAULT_CENTER_ID },
  };
  const scheduleWhere: any = {
    centerId: DEFAULT_CENTER_ID,
  };

  if (studentId) {
    attendanceWhere.studentId = studentId;
    scheduleWhere.studentId = studentId;
  }

  if (monthParam) {
    const [year, month] = monthParam.split('-').map(Number);
    if (!isNaN(year) && !isNaN(month)) {
      const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      attendanceWhere.date = { gte: startOfMonth, lte: endOfMonth };
      scheduleWhere.scheduledAt = { gte: startOfMonth, lte: endOfMonth };
    }
  }

  const [students, assessments, worksheetBatches, worksheetUsages, personalSchedules, attendances] = await Promise.all([
    prisma.student.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        status: true,
        admissionDate: true,
        birthDate: true,
        fatherPhone: true,
        motherPhone: true,
        fatherFullName: true,
        motherFullName: true,
        enrollments: {
          where: { endDate: null },
          select: { id: true, subjectCode: true, currentLevel: true },
        },
      },
    }),
    prisma.assessmentRecord.findMany({ orderBy: { testDate: 'desc' }, take: 100 }),
    prisma.worksheetBatch.findMany({ where: { centerId: DEFAULT_CENTER_ID }, orderBy: { receivedAt: 'desc' } }),
    prisma.worksheetUsage.findMany({ where: { batch: { centerId: DEFAULT_CENTER_ID } }, orderBy: { usedAt: 'desc' } }),
    prisma.personalSchedule.findMany({ where: scheduleWhere, orderBy: { scheduledAt: 'desc' } }),
    prisma.attendance.findMany({
      where: attendanceWhere,
      orderBy: { date: 'desc' },
      include: { classGroup: { select: { id: true, label: true, subjectCode: true } } },
    }),
  ]);

  const assessmentRows = assessments as AssessmentRow[];
  const worksheetBatchRows = worksheetBatches as WorksheetBatchRow[];
  const worksheetUsageRows = worksheetUsages as WorksheetUsageRow[];
  const personalScheduleRows = personalSchedules as PersonalScheduleRow[];
  const attendanceRows = attendances as Array<AttendanceRow & { classGroup: { id: number; label: string; subjectCode: string } }>;

  return NextResponse.json({
    students: students.map((student: any) => ({
      ...student,
      parentPhone: student.fatherPhone || student.motherPhone,
      parentName: `${student.fatherFullName} / ${student.motherFullName}`,
      status: fromStudentStatus(student.status),
      subjects: Array.from(new Set((student.enrollments ?? []).map((item: { subjectCode: string }) => fromSubjectCode(item.subjectCode)))),
      enrollmentLevels: (student.enrollments ?? []).map((item: { id: number; subjectCode: string; currentLevel: string | null }) => ({
        id: item.id,
        subjectCode: fromSubjectCode(item.subjectCode),
        currentLevel: item.currentLevel,
      })),
      currentLevels: (student.enrollments ?? []).reduce((acc: Record<string, string>, item: { subjectCode: string; currentLevel: string | null }) => {
        if (item.currentLevel) {
          acc[fromSubjectCode(item.subjectCode)] = item.currentLevel;
        }
        return acc;
      }, {}),
    })),
    assessments: assessmentRows.map((item) => ({
      ...item,
      testDate: item.testDate.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    worksheetBatches: worksheetBatchRows.map((item) => ({
      ...item,
      receivedAt: item.receivedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    worksheetUsages: worksheetUsageRows.map((item) => ({
      ...item,
      usedAt: item.usedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    personalSchedules: personalScheduleRows.map((item) => ({
      ...item,
      scheduledAt: item.scheduledAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    attendances: attendanceRows.map((item) => ({
      id: item.id,
      classGroupId: item.classGroupId,
      classGroupLabel: item.classGroup.label,
      subjectCode: fromSubjectCode(item.classGroup.subjectCode),
      studentId: item.studentId,
      date: item.date.toISOString(),
      checkOutAt: item.checkOutAt?.toISOString() ?? null,
      status: item.status === 'PRESENT' ? 'Hiện diện' : 'Vắng',
      makeUpClassGroupId: item.makeUpClassGroupId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}
