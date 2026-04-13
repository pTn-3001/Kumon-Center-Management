import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, runtime, toNumber } from '../../_helpers';

export { runtime };

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();

  const updated = await prisma.worksheetBatch.update({
    where: { id: toNumber(id) },
    data: {
      subjectCode: body.subjectCode,
      level: body.level,
      codeRange: body.codeRange,
      quantity: body.quantity !== undefined ? toNumber(body.quantity) : undefined,
      receivedAt: body.receivedAt ? parseDateInput(body.receivedAt) : undefined,
      note: body.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    centerId: updated.centerId,
    subjectCode: updated.subjectCode,
    level: updated.level,
    codeRange: updated.codeRange,
    quantity: updated.quantity,
    receivedAt: updated.receivedAt.toISOString(),
    note: updated.note,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  await prisma.worksheetBatch.delete({ where: { id: toNumber(id) } });
  return NextResponse.json({ message: 'Đã xóa worksheet batch' });
}
