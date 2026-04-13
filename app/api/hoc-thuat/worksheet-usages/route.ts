import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureCenter, parseDateInput, runtime, toNumber } from '../_helpers';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';
import { ensureLowStockNotifications, ensureWorksheetLoanReminders } from '@/lib/notifications';

export { runtime };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const batchId = toNumber(body.batchId);

  if (!batchId || !body.quantity) {
    return NextResponse.json({ message: 'Thiếu thông tin worksheet usage' }, { status: 400 });
  }

  await ensureCenter();

  const created = await prisma.worksheetUsage.create({
    data: {
      batchId,
      studentId: body.studentId ? toNumber(body.studentId) : null,
      quantity: toNumber(body.quantity, 0),
      usedAt: parseDateInput(body.usedAt),
      preparedBy: body.preparedBy ? String(body.preparedBy) : null,
      note: body.note ? String(body.note) : null,
    },
  });

  await ensureLowStockNotifications(DEFAULT_CENTER_ID);
  await ensureWorksheetLoanReminders(DEFAULT_CENTER_ID);

  return NextResponse.json({
    id: created.id,
    batchId: created.batchId,
    studentId: created.studentId,
    quantity: created.quantity,
    usedAt: created.usedAt.toISOString(),
    preparedBy: created.preparedBy,
    note: created.note,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}
