import { NextRequest, NextResponse } from 'next/server';
import { formatDate } from '@/lib/utils';
import type { CertificateFormData } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body: CertificateFormData = await request.json();
    const subjectLabel = body.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh';
    const levelLine = body.size === 'small' ? `<div class="level">${body.level ?? ''}</div>` : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Giấy khen - ${body.studentName}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      background: white;
      position: relative;
      padding: 40mm 25mm;
    }
    .certificate {
      border: 3px solid #d4af37;
      padding: 30px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(135deg, #fefefe 0%, #f9f9f9 100%);
    }
    .header { text-align: center; margin-bottom: 30px; }
    .title {
      font-size: 36px; font-weight: bold; color: #d4af37; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 3px;
    }
    .subtitle { font-size: 18px; color: #666; font-style: italic; }
    .content {
      flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; font-size: 20px; line-height: 2;
    }
    .student-name { font-size: 32px; font-weight: bold; color: #2c3e50; margin: 20px 0; text-transform: uppercase; }
    .level { font-size: 28px; font-weight: bold; color: #e74c3c; margin: 15px 0; }
    .date { font-size: 18px; margin-top: 30px; font-style: italic; }
    .footer { text-align: center; margin-top: 40px; }
    .signature { font-size: 16px; font-weight: bold; margin-top: 60px; }
    .print-button {
      position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; z-index: 1000;
    }
    .print-button:hover { background: #2980b9; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">In giấy khen</button>
  <div class="certificate">
    <div class="header">
      <div class="title">Giấy Khen</div>
      <div class="subtitle">Certificate of Achievement</div>
    </div>
    <div class="content">
      <p>Trung tâm Kumon xin chúc mừng em</p>
      <div class="student-name">${body.studentName}</div>
      ${body.size === 'small' ? `
        <p>Đã hoàn thành xuất sắc trình độ</p>
        ${levelLine}
        <p>môn ${subjectLabel} với kết quả đạt yêu cầu</p>
      ` : `
        <p>Đã hoàn thành xuất sắc</p>
        <p>môn ${subjectLabel} với kết quả đạt yêu cầu</p>
      `}
      <div class="date">Ngày trao: ${formatDate(body.receivedAt)}</div>
    </div>
    <div class="footer">
      <div class="signature">Giám đốc Trung tâm</div>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json({ message: 'Error generating preview', error: String(error) }, { status: 500 });
  }
}
