"use client";

import { useCallback, useEffect, useState } from 'react';
import { Award, Printer, FileDown, Sparkles, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CertificateForm } from '@/components/certificate/certificate-form';
import { formatDate } from '@/lib/utils';
import { getSubjectLabel } from '@/lib/kumon';
import type { CertificateRecord } from '@/types';

export default function CertificatePage() {
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthLabel = `tháng ${month}/${year}`;

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/certificates?month=${month}&year=${year}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setCertificates(data);
      }
    } catch (error) {
      console.error('Failed to fetch certificates', error);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa giấy khen này không?')) {
      return;
    }

    const response = await fetch(`/api/certificates?id=${id}`, { method: 'DELETE' });
    if (response.ok) {
      await fetchCertificates();
      return;
    }

    const error = await response.json();
    alert(error.message || 'Không thể xóa giấy khen');
  };

  const handleExportReport = () => {
    if (certificates.length === 0) {
      alert('Không có dữ liệu giấy khen trong tháng để xuất báo cáo.');
      return;
    }

    const groupedByStudentAndSubject = new Map<string, {
      studentName: string;
      subjectLabel: string;
      levels: Set<string>;
    }>();

    certificates.forEach((certificate: CertificateRecord) => {
      const subjectLabel = getSubjectLabel(certificate.subjectCode);
      const key = `${certificate.studentName}__${certificate.subjectCode}`;
      const current = groupedByStudentAndSubject.get(key) ?? {
        studentName: certificate.studentName,
        subjectLabel,
        levels: new Set<string>(),
      };

      if (certificate.level && certificate.level.trim().length > 0) {
        current.levels.add(certificate.level.trim());
      }

      groupedByStudentAndSubject.set(key, current);
    });

    const rows = Array.from(groupedByStudentAndSubject.values())
      .sort((a, b) => {
        const studentCompare = a.studentName.localeCompare(b.studentName, 'vi');
        if (studentCompare !== 0) {
          return studentCompare;
        }

        return a.subjectLabel.localeCompare(b.subjectLabel, 'vi');
      })
      .map((item, index) => ({
        'Số thứ tự': index + 1,
        'Họ tên học viên': item.studentName,
        'Môn học': item.subjectLabel,
        'Trình độ': item.levels.size > 0 ? Array.from(item.levels).join(', ') : '-',
      }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao cao giay khen');
    XLSX.writeFile(workbook, `bao-cao-giay-khen-${month}-${year}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card overflow-hidden">
          <CardHeader className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-kumon-500/10 px-3 py-1 text-xs font-semibold text-kumon-700">
              <Sparkles className="h-3.5 w-3.5" />
              Workflow giấy khen đầy đủ
            </div>
            <div>
              <CardTitle className="display-font text-3xl">In giấy khen</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Đồng bộ với toàn bộ template giấy khen Kumon.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4 text-kumon-600" />
                Mẫu giấy khen
              </div>
              <p className="mt-3 text-2xl font-bold">4 templates</p>
              <p className="text-sm text-muted-foreground">Math/EFL · cỡ nhỏ/cỡ lớn</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileDown className="h-4 w-4 text-kumon-600" />
                Tải xuống
              </div>
              <p className="mt-3 text-2xl font-bold">DOCX</p>
              <p className="text-sm text-muted-foreground">Xuất theo template cũ</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Printer className="h-4 w-4 text-kumon-600" />
                In nhanh
              </div>
              <p className="mt-3 text-2xl font-bold">PDF</p>
              <p className="text-sm text-muted-foreground">Preview và print qua LibreOffice</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Quy trình</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>1. Nhập học viên, môn học, cỡ giấy khen và trình độ.</p>
            <p>2. Xem trước PDF hoặc tải DOCX trực tiếp.</p>
            <p>3. In nhanh qua PDF và lưu lịch sử giấy khen vào database.</p>
            <p>4. Danh sách bên dưới cập nhật sau mỗi lần tạo.</p>
          </CardContent>
        </Card>
      </section>

      <CertificateForm onSaved={fetchCertificates} />

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Danh sách giấy khen trong tháng</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Hiển thị toàn bộ giấy khen {monthLabel}.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{loading ? 'Đang tải...' : `${certificates.length} bản ghi`}</Badge>
            <Button onClick={handleExportReport}>
              <FileDown className="mr-2 h-4 w-4" />
              Xuất báo cáo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Học viên</TableHead>
                <TableHead>Môn</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Trình độ</TableHead>
                <TableHead>Ngày nhận</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((certificate) => (
                <TableRow key={certificate.id}>
                  <TableCell className="font-semibold text-slate-950">{certificate.studentName}</TableCell>
                  <TableCell>{getSubjectLabel(certificate.subjectCode)}</TableCell>
                  <TableCell>
                    <Badge variant={certificate.size === 'small' ? 'secondary' : 'default'}>
                      {certificate.size === 'small' ? 'Cỡ nhỏ' : 'Cỡ lớn'}
                    </Badge>
                  </TableCell>
                  <TableCell>{certificate.level ?? '-'}</TableCell>
                  <TableCell>{formatDate(certificate.receivedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(certificate.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
