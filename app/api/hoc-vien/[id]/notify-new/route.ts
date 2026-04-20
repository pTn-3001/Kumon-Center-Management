import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, toNumber } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const studentId = toNumber(params.id);

  if (!studentId) {
    return NextResponse.json({ message: 'ID học viên không hợp lệ' }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, admissionDate: true },
  });

  if (!student) {
    return NextResponse.json({ message: 'Không tìm thấy học viên' }, { status: 404 });
  }

  await createNotification({
    centerId: DEFAULT_CENTER_ID,
    type: 'NEW_STUDENT',
    title: 'Học viên mới đăng ký',
    message: `${student.fullName} vừa đăng ký học mới (ngày nhập học ${student.admissionDate.toLocaleDateString('vi-VN')}).`,
    eventKey: `NEW_STUDENT_${student.id}`,
  });

  return NextResponse.json({ success: true });
}
