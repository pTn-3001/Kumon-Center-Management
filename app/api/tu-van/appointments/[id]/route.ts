import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json();
  const appointmentId = Number(params.id);

  if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
    return NextResponse.json({ message: 'Lịch hẹn không hợp lệ' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updatedAppointment = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status: body.status ? toAppointmentStatus(body.status) : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
      },
    });

    const lead = await tx.lead.findUnique({ where: { id: updatedAppointment.leadId }, select: { status: true } });
    if (lead && lead.status !== 'CONVERTED') {
      await tx.lead.update({
        where: { id: updatedAppointment.leadId },
        data: { status: leadStatusFromAppointmentStatus(updatedAppointment.status) },
      });
    }

    return updatedAppointment;
  });

  return NextResponse.json({
    id: updated.id,
    leadId: updated.leadId,
    scheduledAt: updated.scheduledAt.toISOString(),
    status: mapAppointmentStatus(updated.status),
    note: updated.note,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}
