import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureDefaultCenter, getVisibleStaffWhere, toNumber } from '@/lib/api-helpers';
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

export async function GET(request: NextRequest) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let useEmploymentColumns = true;
  let staffs: any[];

  try {
    staffs = await prisma.staff.findMany({
      where: getVisibleStaffWhere(DEFAULT_CENTER_ID),
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        employmentType: true,
        joinDate: true,
        contractEndDate: true,
        salary: true,
        hourlyRate: true,
        leaveDate: true,
        active: true,
        leaveDays: {
          orderBy: { leaveDate: 'asc' },
          select: { leaveDate: true },
        },
      },
    });
  } catch (error) {
    if (!isMissingStaffColumnError(error)) {
      throw error;
    }

    useEmploymentColumns = false;
    staffs = await prisma.staff.findMany({
      where: getVisibleStaffWhere(DEFAULT_CENTER_ID),
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        joinDate: true,
        contractEndDate: true,
        salary: true,
        leaveDate: true,
        active: true,
        leaveDays: {
          orderBy: { leaveDate: 'asc' },
          select: { leaveDate: true },
        },
      },
    });
  }

  const timeEntriesByStaffId = new Map<number, Array<{ id: number; workDate: Date; clockIn: Date; clockOut: Date | null; note: string | null }>>();
  if ((prisma as any).staffTimeEntry) {
    const staffIds = staffs.map((staff) => staff.id);
    if (staffIds.length > 0) {
      let rows: any[] = [];
      try {
        rows = await (prisma as any).staffTimeEntry.findMany({
          where: { staffId: { in: staffIds } },
          orderBy: [{ workDate: 'desc' }, { clockIn: 'desc' }],
          take: 500,
        });
      } catch {
        rows = [];
      }

      rows.forEach((item: { staffId: number; id: number; workDate: Date; clockIn: Date; clockOut: Date | null; note: string | null }) => {
        const current = timeEntriesByStaffId.get(item.staffId) ?? [];
        current.push({
          id: item.id,
          workDate: item.workDate,
          clockIn: item.clockIn,
          clockOut: item.clockOut,
          note: item.note,
        });
        timeEntriesByStaffId.set(item.staffId, current);
      });
    }
  }

  return NextResponse.json(
    staffs.map((staff: any) => ({
      id: staff.id,
      fullName: staff.fullName,
      username: staff.username,
      email: staff.email,
      phone: staff.phone,
      role: mapRole(staff.role),
      employmentType: useEmploymentColumns ? mapEmploymentType(staff.employmentType ?? 'FULL_TIME') : 'Full-time',
      joinDate: staff.joinDate?.toISOString().slice(0, 10) ?? null,
      contractEndDate: staff.contractEndDate?.toISOString().slice(0, 10) ?? null,
      salary: Number(staff.salary),
      hourlyRate: useEmploymentColumns && staff.hourlyRate != null ? Number(staff.hourlyRate) : null,
      leaveDate: staff.leaveDate?.toISOString().slice(0, 10) ?? null,
      leaveDays: (staff.leaveDays ?? []).map((item: { leaveDate: Date }) => item.leaveDate.toISOString().slice(0, 10)),
      timeEntries: (timeEntriesByStaffId.get(staff.id) ?? []).map((item) => ({
        id: item.id,
        workDate: item.workDate.toISOString().slice(0, 10),
        clockIn: item.clockIn.toISOString(),
        clockOut: item.clockOut ? item.clockOut.toISOString() : null,
        note: item.note,
      })),
      active: staff.active,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const center = await ensureDefaultCenter();
  const body = await request.json();
  const employmentType = toEmploymentType(body.employmentType);
  const canUseEmploymentType = staffFieldExists('employmentType');
  const canUseHourlyRate = staffFieldExists('hourlyRate');
  const dbSupportsEmploymentColumns = (canUseEmploymentType && canUseHourlyRate)
    ? await supportsEmploymentColumnsInDb()
    : false;

  if (!body.fullName || !body.username || !body.password) {
    return NextResponse.json({ message: 'Thiếu thông tin nhân sự' }, { status: 400 });
  }

  if (employmentType === 'FULL_TIME' && body.salary == null) {
    return NextResponse.json({ message: 'Nhân sự toàn thời gian cần có lương tháng' }, { status: 400 });
  }

  if (employmentType === 'PART_TIME' && body.hourlyRate == null) {
    return NextResponse.json({ message: 'Nhân sự bán thời gian cần có lương theo giờ' }, { status: 400 });
  }

  if (employmentType === 'PART_TIME' && !dbSupportsEmploymentColumns) {
    return NextResponse.json(
      { message: 'Hệ thống chưa cập nhật Prisma Client cho loại nhân sự bán thời gian. Vui lòng chạy: npx prisma migrate dev, npx prisma generate và khởi động lại server.' },
      { status: 503 }
    );
  }

  const existed = await prisma.staff.findFirst({ where: { username: String(body.username) }, select: { id: true } });
  if (existed) {
    return NextResponse.json({ message: 'Username đã tồn tại' }, { status: 409 });
  }

  const createData: any = {
    centerId: center.id,
    fullName: String(body.fullName),
    username: String(body.username),
    email: typeof body.email === 'string' && body.email.length > 0 ? body.email : null,
    phone: typeof body.phone === 'string' && body.phone.length > 0 ? body.phone : null,
    role: toRole(body.role),
    joinDate: typeof body.joinDate === 'string' && body.joinDate ? new Date(body.joinDate) : null,
    contractEndDate: typeof body.contractEndDate === 'string' && body.contractEndDate ? new Date(body.contractEndDate) : null,
    salary: body.salary != null ? toNumber(body.salary) : 0,
    leaveDate: null,
    active: body.active !== false,
    passwordHash: hashPassword(String(body.password)),
  };

  if (dbSupportsEmploymentColumns) {
    createData.employmentType = employmentType;
  }

  if (dbSupportsEmploymentColumns) {
    createData.hourlyRate = body.hourlyRate != null && String(body.hourlyRate).length > 0 ? toNumber(body.hourlyRate) : null;
  }

  const created = await prisma.staff.create({ data: createData });

  return NextResponse.json({
    id: created.id,
    fullName: created.fullName,
    username: created.username,
    email: created.email,
    phone: created.phone,
    role: mapRole(created.role),
    employmentType: mapEmploymentType(created.employmentType ?? 'FULL_TIME'),
    joinDate: created.joinDate?.toISOString().slice(0, 10) ?? null,
    contractEndDate: created.contractEndDate?.toISOString().slice(0, 10) ?? null,
    salary: Number(created.salary),
    hourlyRate: created.hourlyRate != null ? Number(created.hourlyRate) : null,
    leaveDate: created.leaveDate?.toISOString().slice(0, 10) ?? null,
    leaveDays: [],
    timeEntries: [],
    active: created.active,
  }, { status: 201 });
}
