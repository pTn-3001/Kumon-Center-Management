import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import angularParser from 'angular-expressions';
import type { CertificateFormData } from '@/types';
import { formatDate, parseVietnameseDateInput, sanitizeFileName } from '@/lib/utils';
import { getCertificateLevels } from '@/lib/kumon';

export function getTemplateFileName(subject: 'Toán' | 'Tiếng Anh', size: 'small' | 'large') {
  return size === 'small'
    ? subject === 'Toán'
      ? 'math_cert_small.docx'
      : 'efl_cert_small.docx'
    : subject === 'Toán'
      ? 'math_cert_large.docx'
      : 'efl_cert_large.docx';
}

export function getNextLevel(currentLevel: string, subjectCode: 'MATH' | 'EFL') {
  const levels = getCertificateLevels(subjectCode) as readonly string[];
  const currentIndex = levels.indexOf(currentLevel);

  if (currentIndex === -1 || currentIndex >= levels.length - 1) {
    return currentLevel;
  }

  return levels[currentIndex + 1];
}

export function getTemplateData(formData: CertificateFormData) {
  return {
    FullName: formData.studentName,
    Level: formData.level ?? '',
    DateOfAward: formatDate(parseVietnameseDateInput(formData.receivedAt)),
  };
}

function customParser(tag: string) {
  const normalizedTag = tag.replace(/[«»]/g, '').trim();
  return {
    get: (scope: any) => angularParser.compile(normalizedTag)(scope),
  };
}

export function renderCertificateDocx(templateFileName: string, formData: CertificateFormData) {
  const templatePath = path.join(process.cwd(), 'templates', templateFileName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateFileName}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateContent);
  const templateData = getTemplateData(formData);

  const files = zip.file(/.*/);

  files.forEach((file: any) => {
    if (!file.name.match(/\.xml$/)) {
      return;
    }

    const fileContent = zip.file(file.name)?.asText();
    if (!fileContent) {
      return;
    }

    let content = fileContent;
    content = content.replace(/<\/w:t><\/w:r><w:r><w:rPr>.*?<\/w:rPr><w:t[^>]*>/g, '');
    content = content.replace(/<\/w:t><\/w:r><w:r><w:t[^>]*>/g, '');
    content = content.replace(/<\/w:t><w:t[^>]*>/g, '');
    content = content.replace(/<w:proofErr[^>]*\/>/g, '');
    content = content.replace(/<w:bookmarkStart[^>]*\/>/g, '');
    content = content.replace(/<w:bookmarkEnd[^>]*\/>/g, '');

    let previousContent;
    do {
      previousContent = content;
      content = content.replace(/<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>/g, '');
    } while (content !== previousContent);

    Object.keys(templateData).forEach((key) => {
      const value = templateData[key as keyof typeof templateData];
      const patterns = [
        `«${key}»`,
        `<<${key}>>`,
        `{${key}}`,
        `{{${key}}}`,
        `&lt;&lt;${key}&gt;&gt;`,
        `&#171;${key}&#187;`,
      ];

      patterns.forEach((pattern) => {
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        content = content.replace(new RegExp(escapedPattern, 'gi'), String(value));
      });

      const flexiblePattern = new RegExp(`«[^>»]*(?:<[^>]+>[^<»]*)*${key}[^<»]*(?:<[^>]+>[^<»]*)*»`, 'gi');
      content = content.replace(flexiblePattern, String(value));
    });

    zip.file(file.name, content);
  });

  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      parser: customParser,
      nullGetter: () => '',
    });
    doc.render(templateData);
  } catch {
    // Keep fallback replacement above.
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function getCertificateDownloadName(studentName: string) {
  return `Giay_khen_${sanitizeFileName(studentName)}.docx`;
}

export function getCertificatePdfName(studentName: string) {
  return `Giay_khen_${sanitizeFileName(studentName)}.pdf`;
}
