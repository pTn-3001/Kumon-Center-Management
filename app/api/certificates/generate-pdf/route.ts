import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import PizZip from 'pizzip';
import { getTemplateFileName, renderCertificateDocx } from '@/lib/certificate';
import type { CertificateFormData } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const tempDir = path.join(process.cwd(), 'temp');
  let tempDocxPath = '';
  let tempPdfPath = '';

  try {
    const body: CertificateFormData = await request.json();
    const subjectLabel = body.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh';
    const templateFileName = getTemplateFileName(subjectLabel, body.size);
    const buffer = renderCertificateDocx(templateFileName, {
      ...body,
      level: body.size === 'large' ? body.level ?? 'I' : body.level,
    });

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const randomName = randomBytes(8).toString('hex');
    tempDocxPath = path.join(tempDir, `cert_${randomName}.docx`);
    fs.writeFileSync(tempDocxPath, buffer);

    const possiblePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'soffice',
    ];

    let libreOfficePath = '';
    for (const candidate of possiblePaths) {
      if (candidate === 'soffice' || fs.existsSync(candidate)) {
        libreOfficePath = candidate;
        break;
      }
    }

    if (!libreOfficePath) {
      return NextResponse.json({
        message: 'LibreOffice not found. Please install LibreOffice.',
        checkedPaths: possiblePaths,
      }, { status: 500 });
    }

    const cmd = `"${libreOfficePath}" --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;
    execSync(cmd, { timeout: 30000, windowsHide: true, encoding: 'utf8' });

    tempPdfPath = path.join(tempDir, `cert_${randomName}.pdf`);
    if (!fs.existsSync(tempPdfPath)) {
      return NextResponse.json({ message: 'PDF conversion failed - file not created' }, { status: 500 });
    }

    const pdfBuffer = fs.readFileSync(tempPdfPath);
    const downloadName = `Giay_khen_${body.studentName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ message: 'Error generating PDF', error: String(error) }, { status: 500 });
  } finally {
    try {
      if (tempDocxPath && fs.existsSync(tempDocxPath)) {
        fs.unlinkSync(tempDocxPath);
      }
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }
  }
}
