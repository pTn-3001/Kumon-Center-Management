import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CertificateFormData } from '@/types';
import { parseVietnameseDateInput } from '@/lib/utils';
import { getNextLevel } from '@/lib/certificate';
import type { SubjectCode } from '@/types';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
const DEFAULT_CENTER_ID = 1;

type CertificateRecordRow = {
  id: number;
  studentName: string;
  subjectCode: SubjectCode;
  size: 'SMALL' | 'LARGE';
  level: string | null;
  receivedAt: Date;
  createdAt: Date;
};

function formatYearRange(year: number) {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  };
}

function formatMonthRange(year: number, month: number) {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const subject = searchParams.get('subject');
    const numericYear = year ? Number(year) : null;
    const numericMonth = month && month !== 'all' ? Number(month) : null;

    const where: Prisma.CertificateRecordWhereInput = {
      centerId: DEFAULT_CENTER_ID,
    };

    if (subject && subject !== 'all') {
      where.subjectCode = subject as SubjectCode;
    }

    if (numericYear && Number.isFinite(numericYear) && numericMonth && Number.isFinite(numericMonth)) {
      const { start, end } = formatMonthRange(numericYear, numericMonth);
      where.receivedAt = { gte: start, lt: end };
    } else if (numericYear && Number.isFinite(numericYear)) {
      const { start, end } = formatYearRange(numericYear);
      where.receivedAt = { gte: start, lt: end };
    }

    const certificates: CertificateRecordRow[] = await prisma.certificateRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(where.receivedAt ? {} : { take: 50 }),
    });

    return NextResponse.json(
      certificates.map((item: CertificateRecordRow) => ({
        id: item.id,
        studentName: item.studentName,
        subjectCode: item.subjectCode,
        size: item.size.toLowerCase(),
        level: item.level,
        receivedAt: item.receivedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Error fetching certificates:', error);
    return NextResponse.json({ message: 'Không thể tải danh sách giấy khen' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body: CertificateFormData = await request.json();

  if (!body.studentName || !body.subjectCode || !body.size || !body.receivedAt) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const center = await prisma.center.upsert({
    where: { id: DEFAULT_CENTER_ID },
    create: { id: DEFAULT_CENTER_ID, code: 'KUMON-DIAN', name: 'Kumon Dĩ An' },
    update: {},
  });

  const certificateLevel = body.size === 'large' && !body.level ? 'I' : (body.level || 'I');
  const nextLevel = getNextLevel(certificateLevel, body.subjectCode);
  const receivedAt = parseVietnameseDateInput(body.receivedAt);

  const existingStudent = await prisma.student.findFirst({
    where: {
      centerId: center.id,
      fullName: body.studentName,
    },
    include: {
      enrollments: true,
    },
  });

  const hasActiveEnrollment = existingStudent?.enrollments.some(
    (e: { endDate: Date | null; reenrollDate: Date | null }) => !e.endDate || (e.reenrollDate && e.reenrollDate > e.endDate)
  );

  if (!existingStudent || (!['OFFICIAL', 'TRIAL'].includes(existingStudent.status) && !hasActiveEnrollment)) {
    return NextResponse.json({ message: 'Chỉ có thể in giấy khen cho học viên chính thức hoặc học thử' }, { status: 400 });
  }

  const student = existingStudent;

  await prisma.certificateRecord.create({
    data: {
      centerId: center.id,
      studentId: student.id,
      studentName: body.studentName,
      subjectCode: body.subjectCode,
      size: body.size.toUpperCase() as 'SMALL' | 'LARGE',
      level: certificateLevel,
      receivedAt,
    },
  });

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      subjectCode: body.subjectCode,
    },
    select: { id: true },
  });

  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: { currentLevel: nextLevel },
    });
  }

  return NextResponse.json({
    message: 'Certificate created successfully',
    nextLevel,
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Certificate ID is required' }, { status: 400 });
    }

    const deleted = await prisma.certificateRecord.deleteMany({
      where: {
        id: Number(id),
        centerId: DEFAULT_CENTER_ID,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ message: 'Certificate not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    return NextResponse.json({ message: 'Không thể xóa giấy khen' }, { status: 500 });
  }
}
