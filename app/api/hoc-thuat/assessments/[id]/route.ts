import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateInput, runtime, toNumber } from '../../_helpers';

export { runtime };

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();

  const updated = await prisma.assessmentRecord.update({
    where: { id: toNumber(id) },
    data: {
      studentId: body.studentId !== undefined ? toNumber(body.studentId) : undefined,
      subjectCode: body.subjectCode,
      level: body.level,
      correctAnswers: body.correctAnswers !== undefined ? toNumber(body.correctAnswers) : undefined,
      totalQuestions: body.totalQuestions !== undefined ? toNumber(body.totalQuestions) : undefined,
      actualMinutes: body.actualMinutes !== undefined ? toNumber(body.actualMinutes) : undefined,
      standardMinutes: body.standardMinutes !== undefined ? toNumber(body.standardMinutes) : undefined,
      groupNo: body.groupNo !== undefined ? toNumber(body.groupNo) : undefined,
      testDate: body.testDate ? parseDateInput(body.testDate) : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    studentId: updated.studentId,
    subjectCode: updated.subjectCode,
    level: updated.level,
    correctAnswers: updated.correctAnswers,
    totalQuestions: updated.totalQuestions,
    actualMinutes: updated.actualMinutes,
    standardMinutes: updated.standardMinutes,
    groupNo: updated.groupNo,
    testDate: updated.testDate.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  await prisma.assessmentRecord.delete({ where: { id: toNumber(id) } });
  return NextResponse.json({ message: 'Đã xóa bài thi' });
}
