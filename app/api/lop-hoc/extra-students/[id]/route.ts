import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/api-helpers';

export const runtime = 'nodejs';

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.personalSchedule.delete({ where: { id: toNumber(params.id) } });
  return NextResponse.json({ message: 'Đã xóa học viên học thêm trong tuần' });
}
