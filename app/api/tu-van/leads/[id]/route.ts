import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

function toLeadStatus(value: unknown) {
  if (value === 'Đang liên hệ') return 'CONTACTED';
  if (value === 'Đã liên hệ') return 'CONTACTED';
  if (value === 'Có thể liên hệ lại') return 'INTERESTED';
  if (value === 'Quan tâm') return 'INTERESTED';
  if (value === 'Đã đặt hẹn') return 'SCHEDULED';
  if (value === 'Đặt lịch') return 'SCHEDULED';
  if (value === 'Đến hẹn') return 'ATTENDED';
  if (value === 'Đã đăng ký') return 'CONVERTED';
  if (value === 'Không tiềm năng') return 'LOST';
  return 'NEW';
}

function mapLeadSource(value: string) {
  if (value === 'WEBSITE') return 'Website';
  if (value === 'PHONE') return 'Điện thoại';
  if (value === 'REFERRAL') return 'Giới thiệu';
  if (value === 'TIKTOK') return 'Website';
  if (value === 'WALK_IN') return 'Điện thoại';
  return 'Facebook';
}

function toLeadSource(value: unknown) {
  if (value === 'Website') return 'TIKTOK';
  if (value === 'Điện thoại') return 'WALK_IN';
  if (value === 'Giới thiệu') return 'REFERRAL';
  if (value === 'Tiktok') return 'TIKTOK';
  if (value === 'Trực tiếp') return 'WALK_IN';
  return 'FACEBOOK';
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const lead = await prisma.lead.findUnique({ where: { id: Number(params.id) } });

  if (!lead) {
    return NextResponse.json({ message: 'Không tìm thấy lead' }, { status: 404 });
  }

  return NextResponse.json({
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
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json();

  const updated = await prisma.lead.update({
    where: { id: Number(params.id) },
    data: {
      fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
      parentName: typeof body.parentName === 'string' ? body.parentName : undefined,
      phone: typeof body.parentPhone === 'string' ? body.parentPhone : undefined,
      note: typeof body.note === 'string' ? body.note : undefined,
      status: body.status ? toLeadStatus(body.status) : undefined,
      source: body.source ? toLeadSource(body.source) : undefined,
      convertedStudentId: typeof body.convertedStudentId === 'number' ? body.convertedStudentId : undefined,
      preferredSubjects: Array.isArray(body.preferredSubjects) ? body.preferredSubjects : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    centerId: updated.centerId,
    fullName: updated.fullName,
    parentPhone: updated.phone,
    parentName: updated.parentName ?? 'Chua cap nhat',
    status: mapLeadStatus(updated.status),
    source: mapLeadSource(updated.source),
    preferredSubjects: updated.preferredSubjects,
    note: updated.note,
    convertedStudentId: updated.convertedStudentId,
    createdAt: updated.createdAt.toISOString(),
  });
}
