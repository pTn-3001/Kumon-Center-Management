import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function fromStudentStatus(value: string) {
  if (value === 'DROPPED') return 'Thôi học';
  if (value === 'TRIAL') return 'Học thử';
  if (value === 'EXPIRED') return 'Hết hạn';
  return 'Chính thức';
}

function fromClassShift(value: string) {
  if (value === 'SHIFT_2') return 'Ca 2';
  if (value === 'SHIFT_3') return 'Ca 3';
  if (value === 'SHIFT_4') return 'Ca 4';
  if (value === 'SHIFT_5') return 'Ca 5';
  return 'Ca 1';
}

function parseStudyDays(studyDays: string) {
  const serializedMatches = Array.from(studyDays.matchAll(/(T[2-7])\s*\((Ca\s[1-5])\)/g));
  if (serializedMatches.length > 0) {
    return serializedMatches.map((match) => ({
      weekday: match[1],
      shiftLabel: match[2],
    }));
  }

  return Array.from(new Set((studyDays.match(/T[2-7]/g) ?? []) as Array<'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7'>))
    .map((weekday) => ({
      weekday,
      shiftLabel: null as string | null,
    }));
}

function matchesEnrollmentToGroup(enrollment: any, group: any) {
  if (enrollment.subjectCode !== group.subjectCode) return false;
  if (enrollment.classGroupId === group.id) return true;

  const weekday = group.weekday;
  const shiftLabel = fromClassShift(group.classShift);
  const dayWithShift = `${weekday}(${shiftLabel})`;

  if (typeof enrollment.studyDays === 'string') {
    const parsedStudyDays = parseStudyDays(enrollment.studyDays);
    if (parsedStudyDays.some((item) => item.weekday === weekday && (item.shiftLabel === null || item.shiftLabel === shiftLabel))) {
      return true;
    }

    if (enrollment.studyDays.includes(dayWithShift)) {
      return true;
    }
  }

  return false;
}

function getDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMondayInfo(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(y, m - 1, d + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const mY = monday.getFullYear();
  const mM = String(monday.getMonth() + 1).padStart(2, '0');
  const mD = String(monday.getDate()).padStart(2, '0');
  const mondayKey = `${mY}-${mM}-${mD}`;

  const sY = sunday.getFullYear();
  const sM = String(sunday.getMonth() + 1).padStart(2, '0');
  const sD = String(sunday.getDate()).padStart(2, '0');

  return {
    key: mondayKey,
    startDate: `${mD}/${mM}/${mY}`,
    endDate: `${sD}/${sM}/${sY}`,
    label: `Tuần ${mD}/${mM} - ${sD}/${sM}/${sY}`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const [classGroups, students, attendances] = await Promise.all([
      prisma.classGroup.findMany({
        where: { centerId: DEFAULT_CENTER_ID },
        select: {
          id: true,
          label: true,
          subjectCode: true,
          weekday: true,
          classShift: true,
        },
      }),
      prisma.student.findMany({
        where: {
          centerId: DEFAULT_CENTER_ID,
          status: {
            in: ['OFFICIAL', 'TRIAL'],
          },
        },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          status: true,
          leaves: {
            select: {
              startedAt: true,
              endedAt: true,
            },
            orderBy: { startedAt: 'desc' },
          },
          enrollments: {
            select: {
              id: true,
              subjectCode: true,
              classGroupId: true,
              studyDays: true,
              classShift: true,
              startDate: true,
              endDate: true,
              reenrollDate: true,
              classGroup: {
                select: {
                  id: true,
                  label: true,
                  subjectCode: true,
                  weekday: true,
                  classShift: true,
                },
              },
            },
            orderBy: { startDate: 'desc' },
          },
        },
      }),
      prisma.attendance.findMany({
        where: {
          student: {
            centerId: DEFAULT_CENTER_ID,
            status: {
              in: ['OFFICIAL', 'TRIAL'],
            },
          },
          status: 'PRESENT',
        },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          studentId: true,
          classGroupId: true,
          date: true,
        },
      }),
    ]);

    const classGroupById = new Map<number, { id: number; label: string; subjectCode: string }>(
      classGroups.map((cg: any) => [cg.id, { id: cg.id, label: cg.label, subjectCode: cg.subjectCode }])
    );

    // Group attendances by studentId
    const attendancesByStudent = new Map<number, Array<{
      id: number;
      studentId: number;
      classGroupId: number;
      date: Date;
      classGroup: { id: number; label: string; subjectCode: string } | null;
    }>>();
    for (const att of attendances) {
      const list = attendancesByStudent.get(att.studentId) ?? [];
      list.push({
        ...att,
        classGroup: classGroupById.get(att.classGroupId) ?? null,
      });
      attendancesByStudent.set(att.studentId, list);
    }

    const results = students.map((student: (typeof students)[number]) => {
      // 1. Xác định lớp học hiển thị (classDisplay)
      const classLabelSet = new Set<string>();

      // Lấy từ các buổi học sinh đã đi học điểm danh
      const studentAttsAll = attendancesByStudent.get(student.id) ?? [];
      for (const att of studentAttsAll) {
        if (att.classGroup?.label) {
          classLabelSet.add(att.classGroup.label);
        }
      }

      // Lấy từ các enrollments của học sinh
      const activeEnrollments = (student.enrollments || []).filter(
        (e: any) => !e.endDate || new Date(e.endDate) >= new Date()
      );
      const enrollmentsToProcess = activeEnrollments.length > 0 ? activeEnrollments : (student.enrollments || []);

      for (const e of enrollmentsToProcess) {
        const subjectName = e.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh';

        if (e.classGroup?.label) {
          classLabelSet.add(e.classGroup.label);
          continue;
        }

        if (e.classGroupId) {
          const g = classGroups.find((cg: any) => cg.id === e.classGroupId);
          if (g?.label) {
            classLabelSet.add(g.label);
            continue;
          }
        }

        // Tìm trong classGroups có sẵn theo ngày học & ca học
        let matched = false;
        for (const group of classGroups) {
          if (matchesEnrollmentToGroup(e, group)) {
            classLabelSet.add(group.label);
            matched = true;
          }
        }

        if (!matched) {
          if (e.studyDays) {
            const shiftText = fromClassShift(e.classShift);
            classLabelSet.add(`${subjectName} (${e.studyDays} - ${shiftText})`);
          } else {
            classLabelSet.add(subjectName);
          }
        }
      }

      const classDisplay = classLabelSet.size > 0 ? Array.from(classLabelSet).join(', ') : 'Chưa xếp lớp';

      // 2. Nếu học viên từng có đợt nghỉ học (leave) hoặc reenrollDate,
      // các buổi học trước ngày quay lại sẽ được reset về 0 (chỉ tính từ ngày bắt đầu đợt học hiện tại)
      let resetCutoffDate: Date | null = null;
      for (const e of student.enrollments) {
        if (e.reenrollDate && (!resetCutoffDate || e.reenrollDate > resetCutoffDate)) {
          resetCutoffDate = e.reenrollDate;
        }
      }
      if (student.leaves && student.leaves.length > 0) {
        const latestLeave = student.leaves[0];
        const leaveEnd = latestLeave.endedAt || latestLeave.startedAt;
        if (leaveEnd && (!resetCutoffDate || leaveEnd > resetCutoffDate)) {
          resetCutoffDate = leaveEnd;
        }
      }

      const studentAtts = studentAttsAll.filter((att) => {
        if (!resetCutoffDate) return true;
        return new Date(att.date) >= resetCutoffDate;
      });

      // 3. Group by calendar date YYYY-MM-DD (1 day max 1 point even if multiple subjects)
      const dayMap = new Map<string, Array<{ classLabel: string; time: string }>>();
      for (const att of studentAtts) {
        const dayKey = getDayKey(new Date(att.date));
        const list = dayMap.get(dayKey) ?? [];
        list.push({
          classLabel: att.classGroup?.label ?? '',
          time: new Date(att.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        });
        dayMap.set(dayKey, list);
      }

      // 4. Group unique calendar dates by Monday-to-Sunday week
      const weekMap = new Map<
        string,
        {
          key: string;
          label: string;
          startDate: string;
          endDate: string;
          days: Array<{ date: string; details: Array<{ classLabel: string; time: string }> }>;
        }
      >();

      dayMap.forEach((details, dayKey) => {
        const weekInfo = getMondayInfo(dayKey);
        const existing = weekMap.get(weekInfo.key) ?? {
          key: weekInfo.key,
          label: weekInfo.label,
          startDate: weekInfo.startDate,
          endDate: weekInfo.endDate,
          days: [],
        };
        existing.days.push({ date: dayKey, details });
        weekMap.set(weekInfo.key, existing);
      });

      // Sort weeks chronologically
      const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => a.key.localeCompare(b.key));

      // 5. Phân chia lịch sử các tuần theo từng chu kỳ phiếu (Mỗi chu kỳ 10 điểm)
      type CycleItem = {
        cycleNumber: number;
        label: string;
        isCompleted: boolean;
        points: number;
        weeks: Array<{
          weekKey: string;
          weekLabel: string;
          startDate: string;
          endDate: string;
          attendedDaysCount: number;
          days: Array<{
            formattedDate: string;
            rawDate: string;
            details: Array<{ classLabel: string; time: string }>;
          }>;
          pointsEarned: number;
          cumulativePoints: number;
        }>;
      };

      const cycles: CycleItem[] = [];
      let activeCycle: CycleItem = {
        cycleNumber: 1,
        label: 'Phiếu 1',
        isCompleted: false,
        points: 0,
        weeks: [],
      };

      let runningTotalAll = 0;
      const allWeeksBreakdown: CycleItem['weeks'] = [];

      for (const week of sortedWeeks) {
        week.days.sort((a, b) => a.date.localeCompare(b.date));
        const attendedDaysCount = week.days.length;
        const pointsEarned = Math.min(2, attendedDaysCount);
        runningTotalAll += pointsEarned;

        const formattedDays = week.days.map((d) => {
          const [y, m, day] = d.date.split('-');
          return {
            formattedDate: `${day}/${m}/${y}`,
            rawDate: d.date,
            details: d.details,
          };
        });

        // Toàn bộ lịch sử từ trước đến nay
        allWeeksBreakdown.push({
          weekKey: week.key,
          weekLabel: week.label,
          startDate: week.startDate,
          endDate: week.endDate,
          attendedDaysCount,
          days: formattedDays,
          pointsEarned,
          cumulativePoints: runningTotalAll,
        });

        // Phân bổ vào chu kỳ phiếu hiện tại
        const remainingToFill = 10 - activeCycle.points;
        const pointsInThisCycle = Math.min(pointsEarned, remainingToFill);
        activeCycle.points += pointsInThisCycle;

        activeCycle.weeks.push({
          weekKey: week.key,
          weekLabel: week.label,
          startDate: week.startDate,
          endDate: week.endDate,
          attendedDaysCount,
          days: formattedDays,
          pointsEarned: pointsInThisCycle,
          cumulativePoints: activeCycle.points,
        });

        if (activeCycle.points >= 10) {
          activeCycle.isCompleted = true;
          activeCycle.label = `Phiếu ${activeCycle.cycleNumber} (Hoàn thành 10/10)`;
          cycles.push(activeCycle);

          const overflowPoints = pointsEarned - pointsInThisCycle;
          activeCycle = {
            cycleNumber: activeCycle.cycleNumber + 1,
            label: `Phiếu ${activeCycle.cycleNumber + 1}`,
            isCompleted: false,
            points: overflowPoints,
            weeks: [],
          };

          if (overflowPoints > 0) {
            activeCycle.weeks.push({
              weekKey: week.key,
              weekLabel: week.label,
              startDate: week.startDate,
              endDate: week.endDate,
              attendedDaysCount,
              days: formattedDays,
              pointsEarned: overflowPoints,
              cumulativePoints: overflowPoints,
            });
          }
        }
      }

      if (!cycles.includes(activeCycle)) {
        cycles.push(activeCycle);
      }

      const totalPoints = runningTotalAll;
      const completedCards = Math.floor(totalPoints / 10);
      const currentPoints = totalPoints % 10;
      const justCompleted10 = totalPoints > 0 && totalPoints % 10 === 0;

      // Lấy danh sách tuần của phiếu gần nhất vừa hoàn thành (10/10)
      const completedCycles = cycles.filter((c) => c.isCompleted);
      const latestCompletedCycle = completedCycles.length > 0 ? completedCycles[completedCycles.length - 1] : null;

      return {
        id: student.id,
        fullName: student.fullName,
        status: fromStudentStatus(student.status),
        classDisplay,
        totalPoints,
        completedCards,
        currentPoints,
        justCompleted10,
        cycles,
        currentCycleWeeks: activeCycle.weeks,
        latestCompletedCycleWeeks: latestCompletedCycle?.weeks ?? [],
        weeklyBreakdown: allWeeksBreakdown,
      };
    });

    return NextResponse.json({
      students: results,
    });
  } catch (error) {
    console.error('Failed to load chuyen-can data:', error);
    return NextResponse.json({ message: 'Không thể tải dữ liệu chuyên cần' }, { status: 500 });
  }
}
