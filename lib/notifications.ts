import { addDays, endOfDay, startOfDay } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getShiftTimeRange, getSubjectLabel } from '@/lib/kumon';
import type { ClassShift, Weekday } from '@/types';

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

function hasNotificationModel() {
  return Boolean((prisma as any).notification);
}

export type NotificationRole = 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'CONSULTANT';

export function roleToNotificationCode(role: string): NotificationRole {
  if (role === 'Giáo viên') return 'TEACHER';
  if (role === 'Trợ giảng') return 'ASSISTANT';
  if (role === 'Tư vấn') return 'CONSULTANT';
  return 'ADMIN';
}

export async function createNotification(params: {
  centerId: number;
  type: string;
  title: string;
  message: string;
  targetRoles?: NotificationRole[];
  eventKey?: string;
}) {
  if (!hasNotificationModel()) {
    return;
  }

  const payload = {
    centerId: params.centerId,
    type: params.type,
    title: params.title,
    message: params.message,
    targetRoles: params.targetRoles ?? [],
  };

  if (params.eventKey) {
    await prisma.notification.upsert({
      where: { eventKey: params.eventKey },
      update: payload,
      create: { ...payload, eventKey: params.eventKey },
    });
    return;
  }

  await prisma.notification.create({ data: payload });
}

export async function ensureAppointmentReminderNotifications(centerId: number) {
  if (!hasNotificationModel()) {
    return;
  }

  const tomorrow = addDays(new Date(), 1);
  const from = startOfDay(tomorrow);
  const to = endOfDay(tomorrow);

  const appointments = await prisma.appointment.findMany({
    where: { lead: { centerId }, scheduledAt: { gte: from, lte: to } },
    include: { lead: { select: { fullName: true } } },
  });

  type ReminderAppointment = (typeof appointments)[number];

  await Promise.all(
    appointments.map((appointment: ReminderAppointment) =>
      createNotification({
        centerId,
        type: 'APPOINTMENT_REMINDER',
        title: 'Nhắc lịch hẹn ngày mai',
        message: `${appointment.lead.fullName} có lịch hẹn vào ngày mai.`,
        targetRoles: ['ADMIN', 'CONSULTANT'],
        eventKey: `APPOINTMENT_REMINDER_${appointment.id}_${from.toISOString().slice(0, 10)}`,
      })
    )
  );
}

function weekdayFromDate(date: Date): Weekday | null {
  const day = date.getDay();
  if (day === 0) return null;
  return (`T${day + 1}`) as Weekday;
}

function getVietnamNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: VIETNAM_TIMEZONE }));
}

function getVietnamDateKey(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

function getVietnamDayBounds(date: Date) {
  const dateKey = getVietnamDateKey(date);
  const from = new Date(`${dateKey}T00:00:00+07:00`);
  const to = new Date(`${dateKey}T23:59:59.999+07:00`);
  return { from, to, dateKey };
}

function normalizeClassShift(value: string): ClassShift | null {
  if (value === 'SHIFT_1' || value === 'Ca 1') return 'Ca 1';
  if (value === 'SHIFT_2' || value === 'Ca 2') return 'Ca 2';
  if (value === 'SHIFT_3' || value === 'Ca 3') return 'Ca 3';
  if (value === 'SHIFT_4' || value === 'Ca 4') return 'Ca 4';
  if (value === 'SHIFT_5' || value === 'Ca 5') return 'Ca 5';
  return null;
}

function getWeekdayLabel(weekday: Weekday) {
  if (weekday === 'T2') return 'Thứ Hai';
  if (weekday === 'T3') return 'Thứ Ba';
  if (weekday === 'T4') return 'Thứ Tư';
  if (weekday === 'T5') return 'Thứ Năm';
  if (weekday === 'T6') return 'Thứ Sáu';
  return 'Thứ Bảy';
}

function getShiftFromStudyDays(studyDays: string, weekday: Weekday): ClassShift | null {
  const match = new RegExp(`${weekday}\\s*\\((Ca\\s[1-5])\\)`).exec(studyDays);
  if (!match?.[1]) {
    return null;
  }

  return normalizeClassShift(match[1]);
}

function getShiftStartAt(date: Date, weekday: Weekday, classShiftCode: string) {
  const classShift = normalizeClassShift(classShiftCode);
  if (!classShift) {
    return null;
  }

  const timeRange = getShiftTimeRange(weekday, classShift);
  if (!timeRange) {
    return null;
  }

  const startText = timeRange.split('-')[0]?.trim() ?? '';
  const [hourText, minuteText] = startText.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const at = new Date(date);
  at.setHours(hour, minute, 0, 0);
  return at;
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

export async function ensurePreClassAttendanceReminderNotifications(centerId: number) {
  if (!hasNotificationModel()) {
    return;
  }

  const now = getVietnamNow();
  const weekday = weekdayFromDate(now);
  if (!weekday) {
    return;
  }

  const todayClassGroups = await prisma.classGroup.findMany({
    where: { centerId, weekday },
    select: { id: true, subjectCode: true, classShift: true, label: true, weekday: true },
  });

  type TodayClassGroupRow = (typeof todayClassGroups)[number];

  const enrollments = await prisma.enrollment.findMany({
    where: {
      student: { centerId },
    },
    select: {
      studentId: true,
      classGroupId: true,
      subjectCode: true,
      studyDays: true,
      classShift: true,
      endDate: true,
      reenrollDate: true,
      student: { select: { fullName: true } },
    },
  });

  type PreClassEnrollmentRow = (typeof enrollments)[number] & {
    resolvedClassShift: ClassShift;
    resolvedClassGroupId: number | null;
    resolvedClassLabel: string;
  };

  const activeCandidates = enrollments
    .filter((enrollment: (typeof enrollments)[number]) => isEnrollmentActiveNow(enrollment))
    .map((enrollment: (typeof enrollments)[number]) => {
      const shiftFromStudyDays = getShiftFromStudyDays(enrollment.studyDays, weekday);
      const resolvedClassShift = shiftFromStudyDays ?? normalizeClassShift(String(enrollment.classShift));
      if (!resolvedClassShift) {
        return null;
      }

      const matchedClassGroup = todayClassGroups.find((group: TodayClassGroupRow) => (
        group.subjectCode === enrollment.subjectCode &&
        normalizeClassShift(String(group.classShift)) === resolvedClassShift
      ));

      const shiftRange = getShiftTimeRange(weekday, resolvedClassShift);
      const fallbackLabel = `${getSubjectLabel(enrollment.subjectCode)} - ${getWeekdayLabel(weekday)} - ${resolvedClassShift}: ${shiftRange}`;

      return {
        ...enrollment,
        resolvedClassShift,
        resolvedClassGroupId: matchedClassGroup?.id ?? null,
        resolvedClassLabel: matchedClassGroup?.label ?? fallbackLabel,
      };
    })
    .filter((item: PreClassEnrollmentRow | null): item is PreClassEnrollmentRow => Boolean(item));

  if (activeCandidates.length === 0) {
    return;
  }

  const reminderCandidates = activeCandidates.filter((enrollment: PreClassEnrollmentRow) => {
    const shiftStartAt = getShiftStartAt(now, weekday, enrollment.resolvedClassShift);
    if (!shiftStartAt) {
      return false;
    }

    const passedMinutes = Math.floor((now.getTime() - shiftStartAt.getTime()) / 60000);
    return passedMinutes >= 15;
  });

  if (reminderCandidates.length === 0) {
    return;
  }

  const { from: todayFrom, to: todayTo, dateKey: todayKey } = getVietnamDayBounds(now);
  const classGroupIds = Array.from(new Set(reminderCandidates.map((item: PreClassEnrollmentRow) => item.resolvedClassGroupId).filter((value: number | null): value is number => Boolean(value))));
  const studentIds = Array.from(new Set(reminderCandidates.map((item: PreClassEnrollmentRow) => item.studentId)));

  const attendances = await prisma.attendance.findMany({
    where: {
      ...(classGroupIds.length > 0 ? { classGroupId: { in: classGroupIds } } : {}),
      studentId: { in: studentIds },
      date: { gte: todayFrom, lte: todayTo },
      status: 'PRESENT',
    },
    select: { classGroupId: true, studentId: true },
  });

  type AttendancePresenceRow = (typeof attendances)[number];

  const presentSet = new Set(attendances.map((item: AttendancePresenceRow) => `${item.classGroupId}-${item.studentId}`));
  await Promise.all(
    reminderCandidates
      .filter((item: PreClassEnrollmentRow) => {
        if (item.resolvedClassGroupId) {
          return !presentSet.has(`${item.resolvedClassGroupId}-${item.studentId}`);
        }

        const hasAnyPresentToday = attendances.some((attendance: AttendancePresenceRow) => attendance.studentId === item.studentId);
        return !hasAnyPresentToday;
      })
      .map((item: PreClassEnrollmentRow) => {
        const normalizedShift = item.resolvedClassShift;
        if (!normalizedShift) {
          return null;
        }

        const shiftRange = getShiftTimeRange(weekday, normalizedShift);
        if (!shiftRange) {
          return null;
        }

        return createNotification({
          centerId,
          type: 'POST_CLASS_ATTENDANCE_REMINDER',
          title: 'Nhắc nhở điểm danh',
          message: `${item.student.fullName} chưa điểm danh ${item.resolvedClassLabel}.`,
          targetRoles: ['ADMIN', 'CONSULTANT'],
          eventKey: `POST_CLASS_ATTENDANCE_${item.resolvedClassGroupId ?? `${item.subjectCode}_${weekday}_${normalizedShift}`}_${item.studentId}_${todayKey}`,
        });
      })
      .filter((item: Promise<void> | null): item is Promise<void> => Boolean(item))
  );
}

export async function ensureLowStockNotifications(centerId: number) {
  // Ignore internal assignment tracking batches; they are not real warehouse stock.
  const isTrackingBatch = (batch: { level: string; codeRange: string; note: string | null }) => {
    return (
      batch.level === 'ASSIGNMENT' ||
      batch.codeRange.startsWith('TRACK-') ||
      Boolean(batch.note?.includes('[WS_ASSIGNMENT_BATCH]'))
    );
  };

  const [batches, usages] = await Promise.all([
    prisma.worksheetBatch.findMany({
      where: { centerId },
      select: { id: true, subjectCode: true, level: true, codeRange: true, quantity: true, note: true },
    }),
    prisma.worksheetUsage.findMany({
      where: { batch: { centerId } },
      select: { batchId: true, quantity: true },
    }),
  ]);

  type WorksheetUsageItem = (typeof usages)[number];
  type WorksheetBatchItem = (typeof batches)[number];

  const usageByBatch = new Map<number, number>();
  usages.forEach((usage: WorksheetUsageItem) => {
    usageByBatch.set(usage.batchId, (usageByBatch.get(usage.batchId) ?? 0) + usage.quantity);
  });

  const stockByKey = new Map<string, { subjectCode: string; level: string; codeRange: string; worksheetType: string; stock: number }>();
  batches.forEach((batch: WorksheetBatchItem) => {
    if (isTrackingBatch(batch)) {
      return;
    }

    const used = usageByBatch.get(batch.id) ?? 0;
    const remaining = batch.quantity - used;
    const worksheetType = batch.codeRange?.startsWith('AT-') || batch.level?.startsWith('AT-')
      ? 'Bài kiểm tra kết thúc trình độ'
      : batch.codeRange?.startsWith('DT-') || batch.level?.startsWith('DT-')
        ? 'Bài kiểm tra đầu vào'
      : batch.note?.includes('[WS_WRITING_BATCH]')
        ? 'Kỹ năng viết'
        : 'Worksheet thường';
    const key = `${batch.subjectCode}-${batch.level}-${batch.codeRange}-${worksheetType}`;
    const current = stockByKey.get(key) ?? {
      subjectCode: batch.subjectCode,
      level: batch.level,
      codeRange: batch.codeRange,
      worksheetType,
      stock: 0,
    };
    current.stock += remaining;
    stockByKey.set(key, current);
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  if (hasNotificationModel()) {
    await prisma.notification.deleteMany({
      where: {
        centerId,
        type: 'LOW_STOCK',
        OR: [
          { message: { contains: 'TRACK-' } },
          { message: { contains: 'Level ASSIGNMENT' } },
        ],
      },
    });
  }

  await Promise.all(
    Array.from(stockByKey.values())
      .filter((item) => item.stock < 15)
      .map((item) =>
        createNotification({
          centerId,
          type: 'LOW_STOCK',
          title: 'Cảnh báo tồn kho worksheet thấp',
          message: `${item.subjectCode} - ${item.worksheetType} - ${item.codeRange} còn ${item.stock} worksheet.`,
          targetRoles: ['ADMIN', 'CONSULTANT'],
          eventKey: `LOW_STOCK_${item.subjectCode}_${item.level}_${item.codeRange}_${todayKey}`,
        })
      )
  );
}

export async function ensureWorksheetLoanReminders(centerId: number) {
  const usages = await prisma.worksheetUsage.findMany({
    where: {
      batch: { centerId },
      note: { contains: '[WS_LOAN]' },
    },
    include: {
      batch: {
        select: {
          subjectCode: true,
          level: true,
          codeRange: true,
        },
      },
    },
    orderBy: { usedAt: 'desc' },
    take: 300,
  });

  const returnUsages = await prisma.worksheetUsage.findMany({
    where: {
      batch: { centerId },
      note: { contains: '[WS_RETURN]' },
    },
    select: { note: true },
    take: 300,
  });

  const returnedLoanIds = new Set<number>();
  returnUsages.forEach((usage: (typeof returnUsages)[number]) => {
    const match = /loanUsageId=(\d+)/.exec(usage.note ?? '');
    if (!match) return;
    returnedLoanIds.add(Number(match[1]));
  });

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  await Promise.all(
    usages
      .filter((usage: (typeof usages)[number]) => !returnedLoanIds.has(usage.id))
      .map((usage: (typeof usages)[number]) => {
        const dueDateText = /dueDate=(\d{4}-\d{2}-\d{2})/.exec(usage.note ?? '')?.[1] ?? null;
        const borrowCenter = /borrowCenter=([^;]+)/.exec(usage.note ?? '')?.[1] ?? 'đơn vị mượn';
        if (!dueDateText) return null;

        const dueDate = new Date(dueDateText);
        if (Number.isNaN(dueDate.getTime()) || dueDate > now) {
          return null;
        }

        return createNotification({
          centerId,
          type: 'WORKSHEET_RETURN_REMINDER',
          title: 'Nhắc đòi trả worksheet đã cho mượn',
          message: `Worksheet ${usage.batch.codeRange} (${usage.batch.subjectCode} - ${usage.batch.level}) đã quá hạn trả từ ${dueDateText} tại ${borrowCenter}.`,
          targetRoles: ['ADMIN', 'CONSULTANT'],
          eventKey: `WS_LOAN_REMINDER_${usage.id}_${todayKey}`,
        });
      })
      .filter((item: Promise<void> | null): item is Promise<void> => Boolean(item))
  );
}
