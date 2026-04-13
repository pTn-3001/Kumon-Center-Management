import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureDefaultCenter, getVisibleStaffWhere, toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function toWeekday(value: unknown) {
  return value === 'T3' || value === 'T4' || value === 'T5' || value === 'T6' || value === 'T7' ? value : 'T2';
}

function fromWeekday(value: string) {
  return value;
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

function fromSubjectCode(value: string) {
  return value;
}

function fromStudentStatus(value: string) {
  if (value === 'DROPPED') return 'Thôi học';
  if (value === 'TRIAL') return 'Học thử';
  if (value === 'EXPIRED') return 'Hết hạn';
  return 'Chính thức';
}

export async function GET() {
  const [classGroups, students, staff, attendance, allEnrollments]: [any[], any[], any[], any[], any[]] = await Promise.all([
    prisma.classGroup.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { label: 'asc' },
      include: {
        teacher: { select: { id: true, fullName: true, role: true } },
      },
    }),
    prisma.student.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, status: true, fatherPhone: true, motherPhone: true },
    }),
    prisma.staff.findMany({
      where: getVisibleStaffWhere(DEFAULT_CENTER_ID),
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        active: true,
      },
    }),
    prisma.attendance.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        classGroup: { select: { id: true, label: true } },
        student: { select: { id: true, fullName: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        student: { centerId: DEFAULT_CENTER_ID },
        endDate: null,
      },
      orderBy: { startDate: 'desc' },
      include: {
        student: { select: { id: true, fullName: true, status: true } },
      },
    }),
  ]);

  function matchesEnrollmentToGroup(enrollment: any, group: any) {
    if (enrollment.subjectCode !== group.subjectCode) return false;
    if (enrollment.classGroupId === group.id) return true;

    const weekday = fromWeekday(group.weekday);
    const shiftLabel = fromClassShift(group.classShift);
    const dayWithShift = `${weekday}(${shiftLabel})`;

    if (typeof enrollment.studyDays === 'string' && enrollment.studyDays.includes(dayWithShift)) {
      return true;
    }

    return false;
  }

  return NextResponse.json({
    classGroups: classGroups.map((group: any) => ({
      ...group,
      weekday: fromWeekday(group.weekday),
      classShift: fromClassShift(group.classShift),
      subjectCode: fromSubjectCode(group.subjectCode),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      teacher: group.teacher
        ? { ...group.teacher, role: group.teacher.role }
        : null,
      enrollments: allEnrollments
        .filter((enrollment: any) => matchesEnrollmentToGroup(enrollment, group))
        .map((enrollment: any) => ({
        id: enrollment.id,
        studentId: enrollment.studentId,
        classGroupId: enrollment.classGroupId,
        subjectCode: enrollment.subjectCode,
        registrationType: enrollment.registrationType === 'TRIAL' ? 'Học thử' : 'Chính thức',
        enrollmentType: enrollment.enrollmentType === 'DAILY' ? 'Hàng ngày' : '2 buổi/tuần',
        studyDays: enrollment.studyDays,
        classShift: fromClassShift(enrollment.classShift),
        startDate: enrollment.startDate.toISOString(),
        endDate: enrollment.endDate?.toISOString() ?? null,
        student: enrollment.student,
      })),
    })),
    students: students.map((student: any) => ({
      id: student.id,
      fullName: student.fullName,
      status: fromStudentStatus(student.status),
      parentPhone: student.fatherPhone || student.motherPhone,
    })),
    staff,
    attendance: attendance.map((item: any) => ({
      ...item,
      date: item.date.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      status: item.status === 'ABSENT' ? 'Vắng' : 'Hiện diện',
      classGroupLabel: item.classGroup.label,
      makeUpClassGroupLabel: classGroups.find((group: any) => group.id === item.makeUpClassGroupId)?.label ?? null,
      studentName: item.student.fullName,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const center = await ensureDefaultCenter();

  if (!body.label || !body.subjectCode || !body.weekday || !body.classShift) {
    return NextResponse.json({ message: 'Thiếu thông tin lớp học' }, { status: 400 });
  }

  const created = await prisma.classGroup.create({
    data: {
      centerId: center.id,
      label: String(body.label),
      subjectCode: body.subjectCode,
      weekday: toWeekday(body.weekday),
      classShift: toClassShift(body.classShift),
      teacherId: body.teacherId ? toNumber(body.teacherId) : null,
    },
    include: { teacher: { select: { id: true, fullName: true, role: true } } },
  });

  return NextResponse.json({
    ...created,
    weekday: fromWeekday(created.weekday),
    classShift: fromClassShift(created.classShift),
    subjectCode: fromSubjectCode(created.subjectCode),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}
