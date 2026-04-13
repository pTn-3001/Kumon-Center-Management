import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, runtime, toNumber } from '../../_helpers';

export { runtime };

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();

  const updated = await prisma.worksheetUsage.update({
    where: { id: toNumber(id) },
    data: {
      batchId: body.batchId !== undefined ? toNumber(body.batchId) : undefined,
      studentId: body.studentId !== undefined ? (body.studentId === null || body.studentId === '' ? null : toNumber(body.studentId)) : undefined,
      quantity: body.quantity !== undefined ? toNumber(body.quantity) : undefined,
      usedAt: body.usedAt ? parseDateInput(body.usedAt) : undefined,
      preparedBy: body.preparedBy !== undefined ? (body.preparedBy ? String(body.preparedBy) : null) : undefined,
      note: body.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    batchId: updated.batchId,
    studentId: updated.studentId,
    quantity: updated.quantity,
    usedAt: updated.usedAt.toISOString(),
    preparedBy: updated.preparedBy,
    note: updated.note,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  await prisma.worksheetUsage.delete({ where: { id: toNumber(id) } });
  return NextResponse.json({ message: 'Đã xóa worksheet usage' });
}
