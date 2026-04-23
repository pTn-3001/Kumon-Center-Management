import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureDefaultCenter, parseDateInput, toNumber } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

function toFinanceType(value: unknown) {
  if (value === 'Thuê mặt bằng') return 'RENT';
  if (value === 'Văn phòng phẩm') return 'SUPPLIES';
  if (value === 'Marketing') return 'MARKETING';
  if (value === 'Điện nước') return 'UTILITIES';
  if (value === 'Khấu hao') return 'DEPRECIATION';
  if (value === 'Khác') return 'OTHER';
  return 'SALARY';
}

function fromFinanceType(value: string) {
  if (value === 'RENT') return 'Thuê mặt bằng';
  if (value === 'SUPPLIES') return 'Văn phòng phẩm';
  if (value === 'MARKETING') return 'Marketing';
  if (value === 'UTILITIES') return 'Điện nước';
  if (value === 'DEPRECIATION') return 'Khấu hao';
  if (value === 'OTHER') return 'Khác';
  return 'Lương';
}

function parseTuitionMeta(note: string) {
  const studentIdMatch = /studentId=(\d+)/.exec(note);
  const monthMatch = /month=(\d{4})-(\d{2})/.exec(note);
  const studentId = studentIdMatch ? Number(studentIdMatch[1]) : null;
  const month = monthMatch ? Number(monthMatch[2]) : null;
  const year = monthMatch ? Number(monthMatch[1]) : null;
  return { studentId, month, year };
}

function parseSalaryMeta(note: string) {
  const payloadText = note.replace(/^\[SALARY\]\s*/, '');
  const separatorIndex = payloadText.indexOf(' | ');
  const metaText = separatorIndex >= 0 ? payloadText.slice(0, separatorIndex) : payloadText;
  const userNote = separatorIndex >= 0 ? payloadText.slice(separatorIndex + 3).trim() : '';

  const entries = metaText.split(';').map((segment) => {
    const equalIndex = segment.indexOf('=');
    if (equalIndex < 0) return null;
    const key = segment.slice(0, equalIndex).trim();
    const value = segment.slice(equalIndex + 1).trim();
    return key ? [key, value] : null;
  }).filter((item): item is [string, string] => Boolean(item));

  const map = Object.fromEntries(entries);
  return {
    staffId: map.staffId ? Number(map.staffId) : null,
    staffName: map.staffName ?? 'không xác định',
    employmentType: map.employmentType ?? 'Full-time',
    leaveDays: map.leaveDays ? Number(map.leaveDays) : 0,
    deductedDays: map.deductedDays ? Number(map.deductedDays) : 0,
    baseSalary: map.baseSalary ? Number(map.baseSalary) : 0,
    deduction: map.deduction ? Number(map.deduction) : 0,
    hourlyRate: map.hourlyRate ? Number(map.hourlyRate) : 0,
    hours: map.hours ? Number(map.hours) : 0,
    userNote,
  };
}

export async function GET() {
  const items: any[] = await prisma.finance.findMany({
    where: { centerId: DEFAULT_CENTER_ID },
    orderBy: { spentAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(items.map((item: any) => ({
    ...item,
    amount: Number(item.amount),
    spentAt: item.spentAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    type: fromFinanceType(item.type),
  })));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const center = await ensureDefaultCenter();

  if (!body.type || body.amount === undefined || !body.spentAt) {
    return NextResponse.json({ message: 'Thiếu thông tin tài chính' }, { status: 400 });
  }

  const created = await prisma.finance.create({
    data: {
      centerId: center.id,
      type: toFinanceType(body.type),
      amount: toNumber(body.amount),
      spentAt: parseDateInput(body.spentAt),
      proofImage: body.proofImage ? String(body.proofImage) : null,
      note: body.note ? String(body.note) : null,
    },
  });

  const note = created.note || '';
  const shouldNotify = !body.skipNotification;

  if (shouldNotify && note.startsWith('[SALARY]')) {
    const salaryMeta = parseSalaryMeta(note);
    const monthLabel = `${created.spentAt.getMonth() + 1}/${created.spentAt.getFullYear()}`;
    const amountText = `${Number(created.amount).toLocaleString('vi-VN')}đ`;
    const message = salaryMeta.employmentType === 'Part-time'
      ? `Chi lương Part-time cho ${salaryMeta.staffName} tháng ${monthLabel}: ${amountText} (${salaryMeta.hours.toFixed(2)} giờ x ${salaryMeta.hourlyRate.toLocaleString('vi-VN')}đ/giờ).${salaryMeta.userNote ? ` Ghi chú: ${salaryMeta.userNote}.` : ''}`
      : `Chi lương Full-time cho ${salaryMeta.staffName} tháng ${monthLabel}: thực nhận ${amountText} (lương gốc ${salaryMeta.baseSalary.toLocaleString('vi-VN')}đ, khấu trừ ${salaryMeta.deduction.toLocaleString('vi-VN')}đ, nghỉ ${salaryMeta.leaveDays} ngày, trừ ${salaryMeta.deductedDays} ngày).${salaryMeta.userNote ? ` Ghi chú: ${salaryMeta.userNote}.` : ''}`;

    await createNotification({
      centerId: DEFAULT_CENTER_ID,
      type: 'SALARY_PAID',
      title: 'Đã chi lương nhân sự',
      message,
      targetRoles: ['ADMIN', 'CONSULTANT'],
    });
  } else if (shouldNotify && note.startsWith('[TUITION]')) {
    const tuitionMeta = parseTuitionMeta(note);
    const student = tuitionMeta.studentId
      ? await prisma.student.findUnique({ where: { id: tuitionMeta.studentId }, select: { fullName: true } })
      : null;
    const monthLabel = tuitionMeta.month && tuitionMeta.year ? `${tuitionMeta.month}/${tuitionMeta.year}` : 'không xác định';

    await createNotification({
      centerId: DEFAULT_CENTER_ID,
      type: 'TUITION_COLLECTED',
      title: 'Đã thu học phí',
      message: `Ghi nhận thu học phí học viên ${student?.fullName ?? 'không xác định'} tháng ${monthLabel}: ${Number(created.amount).toLocaleString('vi-VN')}đ.`,
      targetRoles: ['ADMIN', 'CONSULTANT'],
    });
  } else if (shouldNotify && !note.startsWith('[ADMISSION_FEE]')) {
    await createNotification({
      centerId: DEFAULT_CENTER_ID,
      type: 'EXPENSE_CREATED',
      title: 'Phát sinh chi tiền',
      message: `Chi ${fromFinanceType(created.type)} ngày ${created.spentAt.toLocaleDateString('vi-VN', {  day: '2-digit',  month: '2-digit', year: 'numeric', })}: ${Number(created.amount).toLocaleString('vi-VN')}đ.`,
      targetRoles: ['ADMIN', 'CONSULTANT'],
    });
  }

  return NextResponse.json({
    ...created,
    amount: Number(created.amount),
    spentAt: created.spentAt.toISOString(),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    type: fromFinanceType(created.type),
  }, { status: 201 });
}
