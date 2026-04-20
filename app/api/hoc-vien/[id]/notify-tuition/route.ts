import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, toNumber } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const studentId = toNumber(params.id);

  if (!studentId) {
    return NextResponse.json({ message: 'ID học viên không hợp lệ' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({} as { months?: string[]; totalAmount?: number }));
  const months = Array.isArray(body.months) ? body.months.filter((item) => typeof item === 'string' && /^\d{4}-\d{2}$/.test(item)) : [];
  const totalAmount = Number(body.totalAmount ?? 0);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true },
  });

  if (!student) {
    return NextResponse.json({ message: 'Không tìm thấy học viên' }, { status: 404 });
  }

  const monthLabel = months.length > 0
    ? months.map((month) => {
        const [year, mm] = month.split('-');
        return `${Number(mm)}/${year}`;
      }).join(', ')
    : 'không xác định';

  await createNotification({
    centerId: DEFAULT_CENTER_ID,
    type: 'TUITION_COLLECTED',
    title: 'Đã thu học phí',
    message: `Ghi nhận thu học phí học viên ${student.fullName} tháng ${monthLabel}: ${totalAmount.toLocaleString('vi-VN')}đ.`,
    eventKey: `TUITION_COLLECTED_${student.id}_${months.join('_')}`,
    targetRoles: ['ADMIN', 'CONSULTANT'],
  });

  return NextResponse.json({ success: true });
}
