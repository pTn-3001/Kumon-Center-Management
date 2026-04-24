import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CertificateStudentSuggestion } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StudentRow = {
  id: number;
  fullName: string;
  enrollments: Array<{
    subjectCode: 'MATH' | 'EFL';
    currentLevel: string | null;
  }>;
  certificates: Array<{
    level: string | null;
    subjectCode: 'MATH' | 'EFL';
  }>;
};

export async function GET() {
  const students: StudentRow[] = await prisma.student.findMany({
    where: {
      status: { in: ['OFFICIAL', 'TRIAL'] },
    },
    orderBy: { fullName: 'asc' },
    include: {
      enrollments: {
        where: { endDate: null },
        select: { subjectCode: true, currentLevel: true },
      },
      certificates: {
        orderBy: { receivedAt: 'desc' },
        take: 1,
      },
    },
  });

  const suggestions: CertificateStudentSuggestion[] = students.map((student: StudentRow) => ({
    id: student.id,
    fullName: student.fullName,
    currentLevels: {
      MATH: student.enrollments.find((item) => item.subjectCode === 'MATH')?.currentLevel ?? null,
      EFL: student.enrollments.find((item) => item.subjectCode === 'EFL')?.currentLevel ?? null,
    },
    latestLevel: student.certificates[0]?.level ?? null,
    latestSubject: student.certificates[0]?.subjectCode ?? null,
  }));

  return NextResponse.json(suggestions);
}
