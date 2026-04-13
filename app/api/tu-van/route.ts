import { NextRequest, NextResponse } from 'next/server';
import type { Appointment, Lead } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CENTER_ID, ensureDefaultCenter } from '@/lib/api-helpers';

export const runtime = 'nodejs';

function mapLeadStatus(value: string) {
  if (value === 'CONTACTED') return 'Đang liên hệ';
  if (value === 'INTERESTED') return 'Có thể liên hệ lại';
  if (value === 'SCHEDULED') return 'Đã đặt hẹn';
  if (value === 'ATTENDED') return 'Đang liên hệ';
  if (value === 'CONVERTED') return 'Đã đăng ký';
  if (value === 'LOST') return 'Không tiềm năng';
  return 'Mới';
}

function mapLeadSource(value: string) {
  if (value === 'WEBSITE') return 'Website';
  if (value === 'PHONE') return 'Điện thoại';
  if (value === 'REFERRAL') return 'Giới thiệu';
  if (value === 'TIKTOK') return 'Website';
  if (value === 'WALK_IN') return 'Điện thoại';
  return 'Facebook';
}

function mapAppointmentStatus(value: string) {
  if (value === 'DONE') return 'Hoàn thành';
  if (value === 'RESCHEDULED') return 'Hẹn lại';
  if (value === 'CANCELED') return 'Không đến';
  return 'Chờ đến';
}

function toLeadSource(value: unknown) {
  if (value === 'Website') return 'TIKTOK';
  if (value === 'Điện thoại') return 'WALK_IN';
  if (value === 'Tiktok') return 'TIKTOK';
  if (value === 'Trực tiếp') return 'WALK_IN';
  if (value === 'Giới thiệu') return 'REFERRAL';
  return 'FACEBOOK';
}

export async function GET() {
  const [leads, appointments]: [Lead[], Appointment[]] = await Promise.all([
    prisma.lead.findMany({
      where: { centerId: DEFAULT_CENTER_ID },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.appointment.findMany({
      where: { lead: { centerId: DEFAULT_CENTER_ID } },
      orderBy: { scheduledAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    leads: leads.map((lead: Lead) => ({
      id: lead.id,
      centerId: lead.centerId,
      fullName: lead.fullName,
      parentPhone: lead.phone,
      parentName: lead.parentName ?? 'Chua cap nhat',
      status: mapLeadStatus(lead.status),
      source: mapLeadSource(lead.source),
      preferredSubjects: lead.preferredSubjects,
      note: lead.note,
      convertedStudentId: lead.convertedStudentId,
      createdAt: lead.createdAt.toISOString(),
    })),
    appointments: appointments.map((appointment: Appointment) => ({
      id: appointment.id,
      leadId: appointment.leadId,
      scheduledAt: appointment.scheduledAt.toISOString(),
      status: mapAppointmentStatus(appointment.status),
      note: appointment.note,
      createdAt: appointment.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const center = await ensureDefaultCenter();

  if (!body.fullName || !body.parentPhone || !body.source) {
    return NextResponse.json({ message: 'Thiếu thông tin lead' }, { status: 400 });
  }

  const preferredSubjects = Array.isArray(body.preferredSubjects) && body.preferredSubjects.length > 0
    ? body.preferredSubjects.filter((item: unknown) => item === 'MATH' || item === 'EFL')
    : ['MATH'];

  const created = await prisma.lead.create({
    data: {
      centerId: center.id,
      fullName: String(body.fullName),
      phone: String(body.parentPhone),
      parentName: typeof body.parentName === 'string' && body.parentName.length > 0 ? body.parentName : null,
      source: toLeadSource(body.source),
      status: 'NEW',
      preferredSubjects,
      note: typeof body.note === 'string' && body.note.length > 0 ? body.note : null,
    },
  });

  return NextResponse.json({
    id: created.id,
    centerId: created.centerId,
    fullName: created.fullName,
    parentPhone: created.phone,
    parentName: created.parentName ?? 'Chua cap nhat',
    status: mapLeadStatus(created.status),
    source: mapLeadSource(created.source),
    preferredSubjects: created.preferredSubjects,
    note: created.note,
    convertedStudentId: created.convertedStudentId,
    createdAt: created.createdAt.toISOString(),
  }, { status: 201 });
}
