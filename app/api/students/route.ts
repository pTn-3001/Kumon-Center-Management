import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';
import type { CertificateStudentSuggestion } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const students = await prisma.student.findMany({
    where: {
      centerId: DEFAULT_CENTER_ID,
      OR: [
        { status: { in: ['OFFICIAL', 'TRIAL'] } },
        { status: { notIn: ['DROPPED', 'EXPIRED'] } },
        { enrollments: { some: {} } },
      ],
    },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      enrollments: {
        select: {
          subjectCode: true,
          currentLevel: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: 'desc' },
      },
      certificates: {
        orderBy: { receivedAt: 'desc' },
        select: {
          level: true,
          subjectCode: true,
        },
      },
    },
  });

  const suggestions: CertificateStudentSuggestion[] = students.map((student: (typeof students)[number]) => {
    const mathEnrollment = student.enrollments.find((e: (typeof student.enrollments)[number]) => e.subjectCode === 'MATH');
    const eflEnrollment = student.enrollments.find((e: (typeof student.enrollments)[number]) => e.subjectCode === 'EFL');

    const latestCert = student.certificates[0] ?? null;

    return {
      id: student.id,
      fullName: student.fullName,
      currentLevels: {
        MATH: mathEnrollment?.currentLevel ?? null,
        EFL: eflEnrollment?.currentLevel ?? null,
      },
      latestLevel: latestCert?.level ?? null,
      latestSubject: latestCert?.subjectCode ?? null,
    };
  });

  return NextResponse.json(suggestions);
}
