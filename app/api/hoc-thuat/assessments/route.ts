import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureCenter, parseDateInput, runtime, toNumber } from '../_helpers';
import { ensureLowStockNotifications } from '@/lib/notifications';

export { runtime };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const studentId = toNumber(body.studentId);
  const skipWorksheetTracking = body.skipWorksheetTracking === true;

  if (!studentId || !body.subjectCode || !body.level) {
    return NextResponse.json({ message: 'Thiếu thông tin bài thi' }, { status: 400 });
  }

  await ensureCenter();

  const normalizedWorksheetCode = String(body.level).trim().toUpperCase();
  const testDate = parseDateInput(body.testDate);

  const created = await prisma.assessmentRecord.create({
    data: {
      studentId,
      subjectCode: body.subjectCode,
      level: normalizedWorksheetCode,
      correctAnswers: toNumber(body.correctAnswers, 0),
      totalQuestions: toNumber(body.totalQuestions, 100),
      actualMinutes: toNumber(body.actualMinutes, 0),
      standardMinutes: toNumber(body.standardMinutes, 0),
      groupNo: toNumber(body.groupNo, 1),
      testDate,
    },
  });

  // Only track worksheet usage if not from worksheet log page
  if (!skipWorksheetTracking) {
    let stockBatch = await prisma.worksheetBatch.findFirst({
      where: {
        centerId: DEFAULT_CENTER_ID,
        subjectCode: body.subjectCode,
        level: normalizedWorksheetCode,
        codeRange: normalizedWorksheetCode,
      },
      orderBy: { receivedAt: 'desc' },
    });

    if (!stockBatch) {
      stockBatch = await prisma.worksheetBatch.create({
        data: {
          centerId: DEFAULT_CENTER_ID,
          subjectCode: body.subjectCode,
          level: normalizedWorksheetCode,
          codeRange: normalizedWorksheetCode,
          quantity: 0,
          receivedAt: testDate,
          note: '[WS_STOCK_TRACKING] auto-created from assessment',
        },
      });
    }

    await prisma.worksheetUsage.create({
      data: {
        batchId: stockBatch.id,
        studentId,
        quantity: 1,
        usedAt: testDate,
        preparedBy: null,
        note: `[WS_ASSESSMENT]${normalizedWorksheetCode}`,
      },
    });

    await ensureLowStockNotifications(DEFAULT_CENTER_ID);
  }

  return NextResponse.json({
    id: created.id,
    studentId: created.studentId,
    subjectCode: created.subjectCode,
    level: created.level,
    correctAnswers: created.correctAnswers,
    totalQuestions: created.totalQuestions,
    actualMinutes: created.actualMinutes,
    standardMinutes: created.standardMinutes,
    groupNo: created.groupNo,
    testDate: created.testDate.toISOString(),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}
