import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureCenter, parseDateInput, runtime, toNumber } from '../_helpers';
import { createNotification, ensureLowStockNotifications } from '@/lib/notifications';

export { runtime };

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.subjectCode || !body.level || !body.codeRange) {
    return NextResponse.json({ message: 'Thiếu thông tin worksheet batch' }, { status: 400 });
  }

  await ensureCenter();

  const created = await prisma.worksheetBatch.create({
    data: {
      centerId: DEFAULT_CENTER_ID,
      subjectCode: body.subjectCode,
      level: String(body.level),
      codeRange: String(body.codeRange),
      quantity: toNumber(body.quantity, 0),
      receivedAt: parseDateInput(body.receivedAt),
      note: body.note ? String(body.note) : null,
    },
  });

  await createNotification({
    centerId: DEFAULT_CENTER_ID,
    type: 'WORKSHEET_IMPORT',
    title: 'Nhập worksheet mới',
    message: `${created.subjectCode} - Level ${created.level} (${created.codeRange}): nhập ${created.quantity} worksheet.`,
  });
  await ensureLowStockNotifications(DEFAULT_CENTER_ID);

  return NextResponse.json({
    id: created.id,
    centerId: created.centerId,
    subjectCode: created.subjectCode,
    level: created.level,
    codeRange: created.codeRange,
    quantity: created.quantity,
    receivedAt: created.receivedAt.toISOString(),
    note: created.note,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}
