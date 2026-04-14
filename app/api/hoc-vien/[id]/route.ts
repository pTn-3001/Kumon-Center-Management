import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, toNumber } from '@/lib/api-helpers';

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json();
  const updated = await prisma.student.update({
    where: { id: toNumber(params.id) },
    data: {
      fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
      birthDate: body.birthDate !== undefined ? (body.birthDate ? parseDateInput(body.birthDate) : null) : undefined,
      gender: body.gender !== undefined ? toGender(body.gender) : undefined,
      admissionDate: body.admissionDate !== undefined ? parseDateInput(body.admissionDate) : undefined,
      fatherFullName: body.fatherFullName !== undefined ? (body.fatherFullName ? String(body.fatherFullName) : null) : undefined,
      fatherPhone: body.fatherPhone !== undefined ? (body.fatherPhone ? String(body.fatherPhone) : null) : undefined,
      motherFullName: body.motherFullName !== undefined ? (body.motherFullName ? String(body.motherFullName) : null) : undefined,
      motherPhone: body.motherPhone !== undefined ? (body.motherPhone ? String(body.motherPhone) : null) : undefined,
      address: body.address !== undefined ? (body.address ? String(body.address) : null) : undefined,
      status: body.status !== undefined ? toStudentStatus(body.status) : undefined,
      reportB: body.reportB !== undefined ? Boolean(body.reportB) : undefined,
      reportBDate: body.reportBDate !== undefined ? (body.reportBDate ? parseDateInput(body.reportBDate) : null) : undefined,
      assignedStaffId: body.assignedStaffId !== undefined ? (body.assignedStaffId ? toNumber(body.assignedStaffId) : null) : undefined,
    },
  });

  return NextResponse.json({
    ...updated,
    parentName: [updated.fatherFullName, updated.motherFullName].filter(Boolean).join(' / ') || null,
    parentPhone: updated.fatherPhone || updated.motherPhone || null,
    birthDate: updated.birthDate?.toISOString() ?? null,
    admissionDate: updated.admissionDate.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    status: fromStudentStatus(updated.status),
    gender: fromGender(updated.gender),
    reportBDate: updated.reportBDate?.toISOString() ?? null,
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const studentId = toNumber(params.id);

  await prisma.$transaction([
    prisma.lead.updateMany({ where: { convertedStudentId: studentId }, data: { convertedStudentId: null } }),
    prisma.enrollment.deleteMany({ where: { studentId } }),
    prisma.assessmentRecord.deleteMany({ where: { studentId } }),
    prisma.attendance.deleteMany({ where: { studentId } }),
    prisma.worksheetUsage.deleteMany({ where: { studentId } }),
    prisma.personalSchedule.deleteMany({ where: { studentId } }),
    prisma.certificateRecord.deleteMany({ where: { studentId } }),
    prisma.studentLeave.deleteMany({ where: { studentId } }),
    prisma.student.delete({ where: { id: studentId } }),
  ]);

  return NextResponse.json({ message: 'Đã xóa học viên' });
}
