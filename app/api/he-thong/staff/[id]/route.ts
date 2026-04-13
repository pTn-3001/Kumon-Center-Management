import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/api-helpers';
import { AUTH_COOKIE_NAME, getStaffSessionFromToken, hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

function mapRole(value: string) {
  if (value === 'TEACHER') return 'Giáo viên';
  if (value === 'ASSISTANT') return 'Trợ giảng';
  if (value === 'CONSULTANT') return 'Tư vấn';
  return 'Admin';
}

function toRole(value: unknown) {
  if (value === 'Giáo viên') return 'TEACHER';
  if (value === 'Trợ giảng') return 'ASSISTANT';
  if (value === 'Tư vấn') return 'CONSULTANT';
  return 'ADMIN';
}

function mapEmploymentType(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'PART_TIME' || normalized === 'PART-TIME' || normalized === 'PARTTIME') {
    return 'Part-time';
  }
  if (normalized === 'FULL_TIME' || normalized === 'FULL-TIME' || normalized === 'FULLTIME') {
    return 'Full-time';
  }
  if (normalized.includes('PART')) {
    return 'Part-time';
  }
  return 'Full-time';
}

function toEmploymentType(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'part-time' || normalized === 'part time' || normalized === 'bán thời gian' || normalized === 'ban thoi gian') {
    return 'PART_TIME';
  }
  return 'FULL_TIME';
}

function staffFieldExists(fieldName: string) {
  const fields = (prisma as any)?._runtimeDataModel?.models?.Staff?.fields;
  if (!Array.isArray(fields)) return true;
  return fields.some((field: { name?: string }) => field?.name === fieldName);
}

function isMissingStaffColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const text = error.message || '';
  return text.includes('P2022') && (text.includes('Staff.employmentType') || text.includes('Staff.hourlyRate'));
}

async function supportsEmploymentColumnsInDb() {
  try {
    await prisma.staff.findFirst({
      select: {
        id: true,
        employmentType: true,
        hourlyRate: true,
      },
    });
    return true;
  } catch (error) {
    if (isMissingStaffColumnError(error)) {
      return false;
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const params = await context.params;
  const body = await request.json();
  const canUseEmploymentType = staffFieldExists('employmentType');
  const canUseHourlyRate = staffFieldExists('hourlyRate');
  const dbSupportsEmploymentColumns = (canUseEmploymentType && canUseHourlyRate)
    ? await supportsEmploymentColumnsInDb()
    : false;

  if ((body.employmentType === 'Part-time' || body.employmentType === 'Bán thời gian') && !dbSupportsEmploymentColumns) {
    return NextResponse.json(
      { message: 'Hệ thống chưa cập nhật Prisma Client cho loại nhân sự bán thời gian. Vui lòng chạy: npx prisma migrate dev, npx prisma generate và khởi động lại server.' },
      { status: 503 }
    );
  }

  const updateData: any = {
    fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
    username: typeof body.username === 'string' ? body.username : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    role: body.role ? toRole(body.role) : undefined,
    joinDate: typeof body.joinDate === 'string' ? (body.joinDate ? new Date(body.joinDate) : null) : undefined,
    contractEndDate: typeof body.contractEndDate === 'string' ? (body.contractEndDate ? new Date(body.contractEndDate) : null) : undefined,
    salary: body.salary != null ? toNumber(body.salary) : undefined,
    leaveDate: typeof body.leaveDate === 'string' ? new Date(body.leaveDate) : undefined,
    active: typeof body.active === 'boolean' ? body.active : undefined,
    passwordHash: typeof body.password === 'string' && body.password.length > 0 ? hashPassword(body.password) : undefined,
  };

  if (dbSupportsEmploymentColumns) {
    updateData.employmentType = body.employmentType ? toEmploymentType(body.employmentType) : undefined;
  }

  if (dbSupportsEmploymentColumns) {
    updateData.hourlyRate = body.hourlyRate != null ? (String(body.hourlyRate).length > 0 ? toNumber(body.hourlyRate) : null) : undefined;
  }

  const updated = await prisma.staff.update({
    where: { id: Number(params.id) },
    data: updateData,
  });

  return NextResponse.json({
    id: updated.id,
    fullName: updated.fullName,
    username: updated.username,
    email: updated.email,
    phone: updated.phone,
    role: mapRole(updated.role),
    employmentType: mapEmploymentType(updated.employmentType ?? 'FULL_TIME'),
    joinDate: updated.joinDate?.toISOString().slice(0, 10) ?? null,
    contractEndDate: updated.contractEndDate?.toISOString().slice(0, 10) ?? null,
    salary: Number(updated.salary),
    hourlyRate: updated.hourlyRate != null ? Number(updated.hourlyRate) : null,
    leaveDate: updated.leaveDate?.toISOString().slice(0, 10) ?? null,
    active: updated.active,
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSessionFromToken(_request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const params = await context.params;
  await prisma.staff.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
