import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureCenter, parseDateInput, runtime, toNumber } from '../_helpers';

export { runtime };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const studentId = toNumber(body.studentId);

  if (!studentId || !body.subjectCode || !body.level) {
    return NextResponse.json({ message: 'Thiếu thông tin bài thi' }, { status: 400 });
  }

  await ensureCenter();

  const created = await prisma.assessmentRecord.create({
    data: {
      studentId,
      subjectCode: body.subjectCode,
      level: String(body.level),
      correctAnswers: toNumber(body.correctAnswers, 0),
      totalQuestions: toNumber(body.totalQuestions, 100),
      actualMinutes: toNumber(body.actualMinutes, 0),
      standardMinutes: toNumber(body.standardMinutes, 0),
      groupNo: toNumber(body.groupNo, 1),
      testDate: parseDateInput(body.testDate),
    },
  });

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
