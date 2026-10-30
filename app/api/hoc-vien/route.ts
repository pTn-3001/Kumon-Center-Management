import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureDefaultCenter, parseDateInput, toNumber } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

function toStudentStatus(value: unknown) {
  if (value === 'Thôi học') return 'DROPPED';
  if (value === 'Học thử') return 'TRIAL';
  if (value === 'Hết hạn') return 'EXPIRED';
  return 'OFFICIAL';
}

function fromStudentStatus(value: string) {
  if (value === 'DROPPED') return 'Thôi học';
  if (value === 'TRIAL') return 'Học thử';
  if (value === 'EXPIRED') return 'Hết hạn';
  return 'Chính thức';
}

function toGender(value: unknown) {
  if (value === 'Nữ') return 'FEMALE';
  if (value === 'Khác') return 'OTHER';
  return 'MALE';
}

function fromGender(value: string) {
  if (value === 'FEMALE') return 'Nữ';
  if (value === 'OTHER') return 'Khác';
  return 'Nam';
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
  const [students, allEnrollments, classGroups, staffList]: [any[], any[], any[], any[]] = await Promise.all([
    prisma.student.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { fullName: 'asc' },
    }),
    prisma.enrollment.findMany({
      where: { student: { centerId: DEFAULT_CENTER_ID } },
      orderBy: { startDate: 'desc' },
    }),
    prisma.classGroup.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      select: { id: true, label: true, weekday: true, classShift: true },
    }),
    prisma.staff.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      select: { id: true, fullName: true },
    }),
  ]);

  const classGroupById = new Map<number, any>(
    classGroups.map((cg: any) => [
      cg.id,
      {
        id: cg.id,
        label: cg.label,
        weekday: cg.weekday,
        classShift: fromClassShift(cg.classShift),
      },
    ])
  );
  const staffNameById = new Map<number, string>(
    staffList.map((s: any) => [s.id, s.fullName])
  );
  const enrollmentsByStudentId = new Map<number, any[]>();
  for (const enrollment of allEnrollments) {
    const formatted = {
      ...enrollment,
      registrationType: fromRegistrationType(enrollment.registrationType),
      enrollmentType: fromEnrollmentType(enrollment.enrollmentType),
      classShift: fromClassShift(enrollment.classShift),
      currentLevel: enrollment.currentLevel ?? null,
      startDate: enrollment.startDate.toISOString(),
      reportBDate: enrollment.reportBDate?.toISOString() ?? null,
      reenrollDate: enrollment.reenrollDate?.toISOString() ?? null,
      endDate: enrollment.endDate?.toISOString() ?? null,
      classGroup: enrollment.classGroupId ? (classGroupById.get(enrollment.classGroupId) ?? null) : null,
    };
    const list = enrollmentsByStudentId.get(enrollment.studentId);
    if (list) {
      list.push(formatted);
    } else {
      enrollmentsByStudentId.set(enrollment.studentId, [formatted]);
    }
  }

  return NextResponse.json(
    students.map((student: any) => ({
      ...student,
      parentName: [student.fatherFullName, student.motherFullName].filter(Boolean).join(' / ') || null,
      parentPhone: student.fatherPhone || student.motherPhone || null,
      birthDate: student.birthDate?.toISOString() ?? null,
      admissionDate: student.admissionDate.toISOString(),
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
      assignedStaffId: student.assignedStaffId,
      assignedStaffName: student.assignedStaffId ? (staffNameById.get(student.assignedStaffId) ?? null) : null,
      status: fromStudentStatus(student.status),
      gender: fromGender(student.gender),
      reportBDate: student.reportBDate?.toISOString() ?? null,
      enrollments: enrollmentsByStudentId.get(student.id) ?? [],
      latestCertificate: null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const center = await ensureDefaultCenter();

  if (!body.fullName || !body.gender || !body.admissionDate) {
    return NextResponse.json({ message: 'Thiếu thông tin học viên (họ tên, giới tính, ngày nhập học)' }, { status: 400 });
  }

  const created = await prisma.student.create({
    data: {
      centerId: center.id,
      fullName: String(body.fullName),
      birthDate: body.birthDate ? parseDateInput(body.birthDate) : null,
      gender: toGender(body.gender),
      admissionDate: parseDateInput(body.admissionDate),
      fatherFullName: body.fatherFullName ? String(body.fatherFullName) : null,
      fatherPhone: body.fatherPhone ? String(body.fatherPhone) : null,
      motherFullName: body.motherFullName ? String(body.motherFullName) : null,
      motherPhone: body.motherPhone ? String(body.motherPhone) : null,
      address: body.address ? String(body.address) : null,
      status: toStudentStatus(body.status),
      reportB: Boolean(body.reportB),
      reportBDate: body.reportBDate ? parseDateInput(body.reportBDate) : null,
      assignedStaffId: body.assignedStaffId ? toNumber(body.assignedStaffId) : null,
    },
  });

  if (!body.skipNotification) {
    await createNotification({
      centerId: DEFAULT_CENTER_ID,
      type: 'NEW_STUDENT',
      title: 'Học viên mới đăng ký',
      message: `${created.fullName} vừa đăng ký học mới (ngày nhập học ${created.admissionDate.toLocaleDateString('vi-VN', {  day: '2-digit',  month: '2-digit', year: 'numeric', })}).`,
      eventKey: `NEW_STUDENT_${created.id}`,
    });
  }

  return NextResponse.json(
    {
      ...created,
      parentName: [created.fatherFullName, created.motherFullName].filter(Boolean).join(' / ') || null,
      parentPhone: created.fatherPhone || created.motherPhone || null,
      birthDate: created.birthDate?.toISOString() ?? null,
      admissionDate: created.admissionDate.toISOString(),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      status: fromStudentStatus(created.status),
      gender: fromGender(created.gender),
      reportBDate: created.reportBDate?.toISOString() ?? null,
    },
    { status: 201 }
  );
}
