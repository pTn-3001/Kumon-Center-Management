import { NextResponse } from 'next/server';
import type { CertificateRecord, Finance } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';

export const runtime = 'nodejs';

type DashboardEnrollmentSnapshot = {
  registrationType: 'OFFICIAL' | 'TRIAL';
  subjectCode: 'MATH' | 'EFL';
  startDate: Date;
  reenrollDate: Date | null;
  endDate: Date | null;
};

type DashboardStudentStatusSnapshot = {
  status: 'OFFICIAL' | 'TRIAL' | 'EXPIRED' | 'DROPPED';
  enrollments: Array<{
    endDate: Date | null;
    reenrollDate: Date | null;
  }>;
};

function monthLabel(date: Date) {
  return `T${date.getMonth() + 1}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function formatSubject(value: string) {
  return value;
}

function formatSize(value: string) {
  return value === 'SMALL' ? 'small' : 'large';
}

function isRevenue(item: { note: string | null }) {
  const note = item.note || '';
  return note.startsWith('[TUITION]') || note.startsWith('[ADMISSION_FEE]');
}

function sumFinance(items: Array<{ amount: number; note: string | null }>, tuition: boolean) {
  return items
    .filter((item) => {
      return tuition ? isRevenue(item) : !isRevenue(item);
    })
    .reduce((total, item) => total + Number(item.amount), 0);
}

function countEnrollmentsBySnapshot(
  enrollments: DashboardEnrollmentSnapshot[],
  registrationType: 'OFFICIAL' | 'TRIAL',
  monthEnd: Date,
) {
  return enrollments.filter(
    (enrollment) => {
      if (enrollment.registrationType !== registrationType) {
        return false;
      }

      const effectiveStart =
        enrollment.reenrollDate && enrollment.endDate && enrollment.reenrollDate > enrollment.endDate
          ? enrollment.reenrollDate
          : enrollment.startDate;

      return (
        effectiveStart < monthEnd &&
        (!enrollment.endDate ||
          enrollment.endDate >= monthEnd ||
          (enrollment.reenrollDate ? enrollment.reenrollDate < monthEnd : false))
      );
    }
  ).length;
}

function countDroppedEnrollmentsBySnapshot(
  enrollments: DashboardEnrollmentSnapshot[],
  monthEnd: Date,
) {
  return enrollments.filter(
    (enrollment) =>
      enrollment.endDate &&
      enrollment.endDate < monthEnd &&
      (!enrollment.reenrollDate || enrollment.reenrollDate >= monthEnd)
  ).length;
}

function countSubjectEnrollmentsBySnapshot(
  enrollments: DashboardEnrollmentSnapshot[],
  subjectCode: 'MATH' | 'EFL',
  monthEnd: Date,
) {
  return enrollments.filter(
    (enrollment) => {
      if (enrollment.subjectCode !== subjectCode) {
        return false;
      }

      const effectiveStart =
        enrollment.reenrollDate && enrollment.endDate && enrollment.reenrollDate > enrollment.endDate
          ? enrollment.reenrollDate
          : enrollment.startDate;

      return (
        effectiveStart < monthEnd &&
        (!enrollment.endDate ||
          enrollment.endDate >= monthEnd ||
          (enrollment.reenrollDate ? enrollment.reenrollDate < monthEnd : false))
      );
    }
  ).length;
}

function isEnrollmentActiveNow(enrollment: { endDate: Date | null; reenrollDate: Date | null }) {
  if (!enrollment.endDate) {
    return true;
  }

  if (!enrollment.reenrollDate) {
    return false;
  }

  return enrollment.reenrollDate.getTime() > enrollment.endDate.getTime();
}

function buildMonthlyPoint(
  label: string,
  monthEnd: Date,
  monthFinance: Array<{ amount: number; note: string | null }>,
  enrollments: DashboardEnrollmentSnapshot[],
) {
  return {
    month: label,
    activeStudents: countEnrollmentsBySnapshot(enrollments, 'OFFICIAL', monthEnd),
    trialStudents: countEnrollmentsBySnapshot(enrollments, 'TRIAL', monthEnd),
    droppedStudents: countDroppedEnrollmentsBySnapshot(enrollments, monthEnd),
    mathStudents: countSubjectEnrollmentsBySnapshot(enrollments, 'MATH', monthEnd),
    eflStudents: countSubjectEnrollmentsBySnapshot(enrollments, 'EFL', monthEnd),
    revenue: sumFinance(monthFinance, true),
    expense: sumFinance(monthFinance, false),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const compareMode = searchParams.get('compareMode') === 'years-by-month' ? 'years-by-month' : 'months-in-year';
  const now = new Date();
  const selectedYear = Number(searchParams.get('year')) || now.getFullYear();
  const selectedMonth = Number(searchParams.get('month')) || now.getMonth() + 1;

  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { label: monthLabel(d), start: startOfMonth(d), end: endOfMonth(d) };
  });

  let enrollments: DashboardEnrollmentSnapshot[] = [];
  try {
    enrollments = (await prisma.enrollment.findMany({
      where: { student: { centerId: DEFAULT_CENTER_ID } },
      select: { registrationType: true, subjectCode: true, startDate: true, reenrollDate: true, endDate: true },
    })) as DashboardEnrollmentSnapshot[];
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('Unknown field `reenrollDate`')) {
      throw error;
    }

    const legacyEnrollments: Array<{
      registrationType: 'OFFICIAL' | 'TRIAL';
      subjectCode: 'MATH' | 'EFL';
      startDate: Date;
      endDate: Date | null;
    }> = await prisma.enrollment.findMany({
      where: { student: { centerId: DEFAULT_CENTER_ID } },
      select: { registrationType: true, subjectCode: true, startDate: true, endDate: true },
    });
    enrollments = legacyEnrollments.map((item) => ({ ...item, reenrollDate: null })) as DashboardEnrollmentSnapshot[];
  }

  const [leadsCount, certificates, finance, attendanceCount, activeStaffCount, studentStatusSnapshot]: [
    number,
    Array<Pick<CertificateRecord, 'id' | 'studentName' | 'subjectCode' | 'size' | 'level'>>,
    Array<Pick<Finance, 'id' | 'type' | 'amount' | 'spentAt' | 'note'>>,
    number,
    number,
    DashboardStudentStatusSnapshot[],
  ] = await Promise.all([
    prisma.lead.count({ where: { centerId: DEFAULT_CENTER_ID } }),
    prisma.certificateRecord.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, studentName: true, subjectCode: true, size: true, level: true },
    }),
    prisma.finance.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { spentAt: 'desc' },
      select: { id: true, type: true, amount: true, spentAt: true, note: true },
    }),
    prisma.attendance.count({
      where: {
        classGroup: { centerId: DEFAULT_CENTER_ID },
        date: { gte: startOfMonth(now), lt: endOfMonth(now) },
      },
    }),
    prisma.staff.count({ where: { centerId: DEFAULT_CENTER_ID, active: true } }),
    prisma.student.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      select: {
        status: true,
        enrollments: {
          select: {
            endDate: true,
            reenrollDate: true,
          },
        },
      },
    }) as Promise<DashboardStudentStatusSnapshot[]>,
  ]);

  const officialEnrollmentCount = studentStatusSnapshot
    .filter((student) => student.status === 'OFFICIAL')
    .reduce(
      (total, student) => total + student.enrollments.filter((enrollment) => isEnrollmentActiveNow(enrollment)).length,
      0,
    );

  const trialEnrollmentCount = studentStatusSnapshot
    .filter((student) => student.status === 'TRIAL' || student.status === 'EXPIRED')
    .reduce(
      (total, student) => total + student.enrollments.filter((enrollment) => isEnrollmentActiveNow(enrollment)).length,
      0,
    );

  const monthlyStats = months.map((month) => {
    const inMonthFinance = finance
      .filter((item: Pick<Finance, 'id' | 'type' | 'amount' | 'spentAt' | 'note'>) => item.spentAt >= month.start && item.spentAt < month.end)
      .map((item) => ({ amount: Number(item.amount), note: item.note }));

    return {
      ...buildMonthlyPoint(month.label, month.end, inMonthFinance, enrollments),
      totalLessons: attendanceCount,
    };
  });

  const financeByMonth = new Map<string, Array<{ amount: number; note: string | null }>>();
  finance.forEach((item) => {
    const key = `${item.spentAt.getFullYear()}-${String(item.spentAt.getMonth() + 1).padStart(2, '0')}`;
    const current = financeByMonth.get(key) ?? [];
    current.push({ amount: Number(item.amount), note: item.note });
    financeByMonth.set(key, current);
  });

  const enrollmentYears = enrollments.map((item) => item.startDate.getFullYear());
  const financeYears = finance.map((item) => item.spentAt.getFullYear());
  const baseYears = [...enrollmentYears, ...financeYears, now.getFullYear()];
  const minYear = Math.min(...baseYears);
  const maxYear = Math.max(...baseYears);
  const availableYears = Array.from({ length: maxYear - minYear + 1 }, (_, idx) => minYear + idx).reverse();

  const compareStats = compareMode === 'months-in-year'
    ? Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
      const monthEnd = new Date(selectedYear, month, 1);
      const monthFinance = financeByMonth.get(key) ?? [];
      return buildMonthlyPoint(`T${month}`, monthEnd, monthFinance, enrollments);
    })
    : availableYears.map((year) => {
      const key = `${year}-${String(selectedMonth).padStart(2, '0')}`;
      const monthEnd = new Date(year, selectedMonth, 1);
      const monthFinance = financeByMonth.get(key) ?? [];
      return buildMonthlyPoint(String(year), monthEnd, monthFinance, enrollments);
    });

  const latestMonth = monthlyStats[monthlyStats.length - 1] || {
    month: monthLabel(now),
    activeStudents: 0,
    trialStudents: 0,
    droppedStudents: 0,
    totalLessons: 0,
    revenue: 0,
    expense: 0,
  };

  return NextResponse.json({
    monthlyStats,
    compareStats,
    compareMeta: {
      mode: compareMode,
      selectedYear,
      selectedMonth,
      availableYears,
    },
    stats: {
      activeStudents: officialEnrollmentCount,
      trialStudents: trialEnrollmentCount,
      leads: leadsCount,
      monthlyRevenue: latestMonth.revenue,
      conversionRate: leadsCount > 0 ? Math.round((officialEnrollmentCount / leadsCount) * 100) : 0,
      activeStaffCount,
      monthlyLessons: attendanceCount,
    },
    certificates: certificates.map((item: Pick<CertificateRecord, 'id' | 'studentName' | 'subjectCode' | 'size' | 'level'>) => ({
      id: item.id,
      studentName: item.studentName,
      subjectCode: formatSubject(item.subjectCode),
      size: formatSize(item.size),
      level: item.level,
    })),
    recentRevenue: finance
      .filter((item: Pick<Finance, 'id' | 'type' | 'amount' | 'spentAt' | 'note'>) => isRevenue(item))
      .slice(0, 4)
      .map((item: Pick<Finance, 'id' | 'type' | 'amount' | 'spentAt' | 'note'>) => ({
        id: item.id,
        amount: Number(item.amount),
        spentAt: item.spentAt.toISOString(),
        note: item.note,
      })),
    finance: finance.slice(0, 3).map((item: Pick<Finance, 'id' | 'type' | 'amount' | 'spentAt' | 'note'>) => ({
      id: item.id,
      type: item.type,
      amount: Number(item.amount),
      spentAt: item.spentAt.toISOString(),
    })),
  });
}
