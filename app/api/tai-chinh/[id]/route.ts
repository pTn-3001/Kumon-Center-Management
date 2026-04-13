import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, toNumber } from '@/lib/api-helpers';

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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const updated = await prisma.finance.update({
    where: { id: toNumber(params.id) },
    data: {
      type: body.type !== undefined ? toFinanceType(body.type) : undefined,
      amount: body.amount !== undefined ? toNumber(body.amount) : undefined,
      spentAt: body.spentAt !== undefined ? parseDateInput(body.spentAt) : undefined,
      proofImage: body.proofImage !== undefined ? (body.proofImage ? String(body.proofImage) : null) : undefined,
      note: body.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    },
  });

  return NextResponse.json({
    ...updated,
    amount: Number(updated.amount),
    spentAt: updated.spentAt.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    type: fromFinanceType(updated.type),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.finance.delete({ where: { id: toNumber(params.id) } });
  return NextResponse.json({ message: 'Đã xóa khoản chi' });
}
