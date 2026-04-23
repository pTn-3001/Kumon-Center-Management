import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

function toAppointmentStatus(value: unknown) {
  if (value === 'Hoàn thành') return 'DONE';
  if (value === 'Hẹn lại') return 'RESCHEDULED';
  if (value === 'Không đến') return 'CANCELED';
  return 'WAITING';
}

function mapAppointmentStatus(value: string) {
  if (value === 'DONE') return 'Hoàn thành';
  if (value === 'RESCHEDULED') return 'Hẹn lại';
  if (value === 'CANCELED') return 'Không đến';
  return 'Chờ đến';
}

function leadStatusFromAppointmentStatus(value: 'WAITING' | 'DONE' | 'RESCHEDULED' | 'CANCELED') {
  if (value === 'WAITING') return 'SCHEDULED';
  if (value === 'DONE') return 'CONTACTED';
  if (value === 'RESCHEDULED') return 'INTERESTED';
  return 'INTERESTED';
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.leadId || !body.scheduledAt) {
    return NextResponse.json({ message: 'Thiếu thông tin lịch hẹn' }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdAppointment = await tx.appointment.create({
      data: {
        leadId: Number(body.leadId),
        scheduledAt: new Date(body.scheduledAt),
        status: toAppointmentStatus(body.status),
        note: typeof body.note === 'string' ? body.note : null,
      },
    });

    const lead = await tx.lead.findUnique({ where: { id: Number(body.leadId) }, select: { status: true } });
    if (lead && lead.status !== 'CONVERTED') {
      await tx.lead.update({
        where: { id: Number(body.leadId) },
        data: { status: leadStatusFromAppointmentStatus(createdAppointment.status) },
      });
    }

    return createdAppointment;
  });

  const lead = await prisma.lead.findUnique({ where: { id: created.leadId }, select: { fullName: true } });
  await createNotification({
    centerId: DEFAULT_CENTER_ID,
    type: 'APPOINTMENT_NEW',
    title: 'Có lịch hẹn mới',
    message: `${lead?.fullName ?? 'Học viên'} có lịch hẹn mới vào ${created.scheduledAt.toLocaleDateString('vi-VN', {  day: '2-digit',  month: '2-digit', year: 'numeric', })}.`,
    targetRoles: ['ADMIN', 'CONSULTANT'],
    eventKey: `APPOINTMENT_NEW_${created.id}`,
  });

  return NextResponse.json({
    id: created.id,
    leadId: created.leadId,
    scheduledAt: created.scheduledAt.toISOString(),
    status: mapAppointmentStatus(created.status),
    note: created.note,
    createdAt: created.createdAt.toISOString(),
  }, { status: 201 });
}
