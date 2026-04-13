import { addDays, endOfDay, startOfDay } from 'date-fns';
import { prisma } from '@/lib/prisma';

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

export async function ensureLowStockNotifications(centerId: number) {
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
    const used = usageByBatch.get(batch.id) ?? 0;
    const remaining = batch.quantity - used;
    const worksheetType = batch.codeRange?.startsWith('AT-') || batch.level?.startsWith('AT-')
      ? 'Bài kiểm tra kết thúc trình độ'
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

  await Promise.all(
    Array.from(stockByKey.values())
      .filter((item) => item.stock < 15)
      .map((item) =>
        createNotification({
          centerId,
          type: 'LOW_STOCK',
          title: 'Cảnh báo tồn kho worksheet thấp',
          message: `${item.subjectCode} - ${item.worksheetType} - ${item.codeRange} (Level ${item.level}) còn ${item.stock} worksheet.`,
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
