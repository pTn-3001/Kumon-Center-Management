import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID } from '@/lib/api-helpers';
import type { SubjectCode } from '@/types';

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

function isSubjectCode(value: string): value is SubjectCode {
  return value === 'MATH' || value === 'EFL';
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json();
  const appointmentId = Number(params.id);

  if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
    return NextResponse.json({ message: 'Lịch hẹn không hợp lệ' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Encode worksheet selections into note with special marker
    let noteToSave = typeof body.note === 'string' ? body.note : undefined;
    if (body.selectedWorksheets && typeof body.selectedWorksheets === 'object') {
      const worksheetEntries = Object.entries(body.selectedWorksheets) as Array<[string, string]>;
      const selections = worksheetEntries
        .filter(([subjectCode, level]) => level && subjectCode)
        .map(([subjectCode, level]) => `${subjectCode}:${String(level).trim().toUpperCase()}`)
        .join(',');
      if (selections) {
        noteToSave = `${noteToSave || ''}[|WS_SEL|${selections}]`;
      }
    }

    const updatedAppointment = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status: body.status ? toAppointmentStatus(body.status) : undefined,
        note: noteToSave,
      },
    });

    const lead = await tx.lead.findUnique({ where: { id: updatedAppointment.leadId }, select: { status: true } });
    if (lead && lead.status !== 'CONVERTED') {
      await tx.lead.update({
        where: { id: updatedAppointment.leadId },
        data: { status: leadStatusFromAppointmentStatus(updatedAppointment.status) },
      });
    }

    // Create worksheet usage records if worksheets are selected
    if (body.selectedWorksheets && typeof body.selectedWorksheets === 'object') {
      const worksheetEntries = Object.entries(body.selectedWorksheets) as Array<[string, string]>;
      
      for (const [subjectCode, level] of worksheetEntries) {
        if (!level || !subjectCode) continue;
        if (!isSubjectCode(subjectCode)) continue;

        const normalizedSubjectCode = subjectCode;

        // Find or create worksheet batch for stock tracking
        let stockBatch = await tx.worksheetBatch.findFirst({
          where: {
            centerId: DEFAULT_CENTER_ID,
            subjectCode: normalizedSubjectCode,
            level: String(level).trim().toUpperCase(),
            codeRange: String(level).trim().toUpperCase(),
          },
          orderBy: { receivedAt: 'desc' },
        });

        if (!stockBatch) {
          stockBatch = await tx.worksheetBatch.create({
            data: {
              centerId: DEFAULT_CENTER_ID,
              subjectCode: normalizedSubjectCode,
              level: String(level).trim().toUpperCase(),
              codeRange: String(level).trim().toUpperCase(),
              quantity: 0,
              receivedAt: new Date(body.scheduledAt || new Date()),
              note: '[WS_STOCK_TRACKING] auto-created from appointment',
            },
          });
        }

        // Create usage record with appointment reference
        await tx.worksheetUsage.create({
          data: {
            batchId: stockBatch.id,
            studentId: null,
            quantity: 1,
            usedAt: new Date(body.scheduledAt || new Date()),
            preparedBy: null,
            note: `[WS_APPOINTMENT_DT]${String(level).trim().toUpperCase()}`,
          },
        });
      }
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
