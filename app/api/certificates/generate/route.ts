import { NextRequest, NextResponse } from 'next/server';
import { getTemplateFileName, renderCertificateDocx } from '@/lib/certificate';
import type { CertificateFormData } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body: CertificateFormData = await request.json();

    if (!body.studentName || !body.receivedAt) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const subjectLabel = body.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh';
    const templateFileName = getTemplateFileName(subjectLabel, body.size);
    const buffer = renderCertificateDocx(templateFileName, {
      ...body,
      level: body.size === 'large' ? body.level ?? 'I' : body.level,
    });

    const downloadName = `Giay_khen_${body.studentName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')}.docx`;

    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating certificate DOCX:', error);
    return NextResponse.json({ message: 'Error generating certificate', error: String(error) }, { status: 500 });
  }
}
