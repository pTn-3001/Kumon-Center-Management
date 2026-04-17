import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';
import { AUTH_COOKIE_NAME, getStaffSessionFromToken } from '@/lib/auth';
import {
  ensureAppointmentReminderNotifications,
  ensurePreClassAttendanceReminderNotifications,
  roleToNotificationCode,
} from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function hasNotificationModel() {
  return Boolean((prisma as any).notification) && Boolean((prisma as any).notificationRead);
}

export async function GET(request: NextRequest) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await ensureAppointmentReminderNotifications(DEFAULT_CENTER_ID);
  await ensurePreClassAttendanceReminderNotifications(DEFAULT_CENTER_ID);

  if (!hasNotificationModel()) {
    return NextResponse.json({ unreadCount: 0, items: [] });
  }

  const roleCode = roleToNotificationCode(session.role);

  const notifications = await prisma.notification.findMany({
    where: {
      centerId: DEFAULT_CENTER_ID,
      OR: [
        { targetRoles: { isEmpty: true } },
        { targetRoles: { has: roleCode } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      reads: {
        where: { staffId: session.id },
        select: { id: true },
      },
    },
  });

  type NotificationWithRead = (typeof notifications)[number];

  const items = notifications.map((item: NotificationWithRead) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    createdAt: item.createdAt.toISOString(),
    read: item.reads.length > 0,
  }));

  return NextResponse.json({
    unreadCount: items.filter((item: (typeof items)[number]) => !item.read).length,
    items,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getStaffSessionFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const roleCode = roleToNotificationCode(session.role);

  if (!hasNotificationModel()) {
    return NextResponse.json({ success: true });
  }

  const notifications = await prisma.notification.findMany({
    where: {
      centerId: DEFAULT_CENTER_ID,
      OR: [
        { targetRoles: { isEmpty: true } },
        { targetRoles: { has: roleCode } },
      ],
    },
    select: { id: true },
  });

  if (notifications.length === 0) {
    return NextResponse.json({ success: true });
  }

  await prisma.notificationRead.createMany({
    data: notifications.map((item: (typeof notifications)[number]) => ({
      notificationId: item.id,
      staffId: session.id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ success: true });
}
