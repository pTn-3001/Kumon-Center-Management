"use client";

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CertificateStudentSuggestion, SubjectCode } from '@/types';
import { EFL_LEVELS, MATH_LEVELS } from '@/lib/kumon';
import { formatDate, formatDateInput } from '@/lib/utils';

const certificateSchema = z.object({
  studentName: z.string().min(1, 'Nhập họ tên học viên'),
  subjectCode: z.enum(['MATH', 'EFL']),
  size: z.enum(['small', 'large']),
  level: z.string().optional(),
  receivedAt: z.string().min(1, 'Nhập ngày nhận giấy khen'),
});

type CertificateFormValues = z.infer<typeof certificateSchema>;

interface CertificateFormProps {
  onSaved: () => Promise<void>;
}

export function CertificateForm({ onSaved }: CertificateFormProps) {
  const [students, setStudents] = useState<CertificateStudentSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm<CertificateFormValues>({
    resolver: zodResolver(certificateSchema),
    defaultValues: {
      studentName: '',
      subjectCode: 'MATH',
      size: 'small',
      level: '',
      receivedAt: formatDate(new Date()),
    },
  });

  const subjectCode = form.watch('subjectCode');
  const size = form.watch('size');
  const studentName = form.watch('studentName');
  const levelOptions = subjectCode === 'MATH' ? MATH_LEVELS : EFL_LEVELS;

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const response = await fetch('/api/students');
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const fallbackText = contentType.includes('application/json')
            ? ((await response.json()) as { message?: string }).message || ''
            : (await response.text()).slice(0, 120);
          throw new Error(fallbackText || `Không thể tải gợi ý học viên (${response.status})`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          setStudents(data);
        } else {
          throw new Error('Dữ liệu gợi ý học viên không hợp lệ');
        }
      } catch (error) {
        console.error('Unable to fetch students for certificate autocomplete', error);
      }
    };

    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const keyword = studentName.toLowerCase();
    return students
      .filter((student) => {
        const nameMatches = student.fullName.toLowerCase().includes(keyword);
        const subjectMatches = !student.latestSubject || student.latestSubject === subjectCode;
        return keyword.length > 0 && nameMatches && subjectMatches;
      })
      .slice(0, 6);
  }, [students, subjectCode, studentName]);

  const submitCertificate = async (action: 'preview' | 'download' | 'print') => {
    const isValid = await form.trigger();
    if (!isValid) return;

    const values = form.getValues();
    const payload = {
      studentName: values.studentName,
      subjectCode: values.subjectCode,
      size: values.size,
      level: values.size === 'small' ? values.level : undefined,
      receivedAt: values.receivedAt,
    };

    setLoading(true);
    try {
      if (action === 'download' || action === 'print') {
        const saveResponse = await fetch('/api/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!saveResponse.ok) {
          const error = await saveResponse.json();
          throw new Error(error.message || 'Không thể lưu giấy khen');
        }

        await onSaved();
      }

      if (action === 'preview' || action === 'print') {
        const response = await fetch('/api/certificates/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Không thể tạo file PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        if (action === 'preview') {
          const previewWindow = window.open(url, '_blank');
          if (!previewWindow) {
            alert('Vui lòng cho phép popup để xem trước giấy khen');
          }
        } else {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = url;
          document.body.appendChild(iframe);

          iframe.onload = () => {
            setTimeout(() => {
              try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
              } catch (error) {
                console.error('Print fallback error', error);
                const printWindow = window.open(url, '_blank');
                printWindow?.addEventListener('load', () => printWindow.print());
              }
            }, 1000);
          };
        }
      } else {
        const response = await fetch('/api/certificates/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Không thể tạo file DOCX');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Giay_khen_${values.studentName.replace(/\s/g, '_')}.docx`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }

      if (action === 'download' || action === 'print') {
        form.reset({
          studentName: '',
          subjectCode: values.subjectCode,
          size: values.size,
          level: values.level,
          receivedAt: formatDate(new Date()),
        });
      }
    } catch (error: any) {
      alert(error?.message || 'Có lỗi xảy ra khi tạo giấy khen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="display-font text-2xl">Tạo giấy khen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Môn học</Label>
            <Controller
              control={form.control}
              name="subjectCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => {
                  field.onChange(value as SubjectCode);
                  form.setValue('level', '');
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATH">Toán</SelectItem>
                    <SelectItem value="EFL">Tiếng Anh</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Loại giấy khen</Label>
            <Controller
              control={form.control}
              name="size"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => field.onChange(value as 'small' | 'large')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Cỡ nhỏ</SelectItem>
                    <SelectItem value="large">Cỡ lớn</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Họ tên học viên</Label>
          <div className="relative">
            <Input
              value={studentName}
              onChange={(event) => {
                form.setValue('studentName', event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              placeholder="Nhập tên học viên..."
            />
            {showSuggestions && filteredStudents.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-2xl border bg-white p-1 shadow-soft">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={() => {
                      form.setValue('studentName', student.fullName);
                      const currentLevelForSubject = student.currentLevels?.[subjectCode] ?? null;
                      if (currentLevelForSubject && size === 'small') {
                        form.setValue('level', currentLevelForSubject);
                      }
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="font-medium text-slate-950">{student.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {student.currentLevels?.[subjectCode]
                        ? `Trình độ hiện tại (${subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh'}): ${student.currentLevels?.[subjectCode]}`
                        : 'Chưa có trình độ hiện tại'}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {form.formState.errors.studentName ? <p className="text-sm text-destructive">{form.formState.errors.studentName.message}</p> : null}
        </div>

        {size === 'small' ? (
          <div className="space-y-2">
            <Label>Trình độ</Label>
            <Controller
              control={form.control}
              name="level"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trình độ..." />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOptions.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {subjectCode === 'MATH' ? 'Toán: 6A → O' : 'Tiếng Anh: 7A → O'}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Ngày nhận giấy khen</Label>
          <Input
            value={form.watch('receivedAt')}
            onChange={(event) => form.setValue('receivedAt', formatDateInput(event.target.value))}
            placeholder="dd-mm-yyyy"
            maxLength={10}
          />
          {form.formState.errors.receivedAt ? <p className="text-sm text-destructive">{form.formState.errors.receivedAt.message}</p> : null}
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          <Button type="button" variant="outline" className="flex-1" disabled={loading} onClick={() => submitCertificate('preview')}>
            <Eye className="mr-2 h-4 w-4" />
            Xem trước
          </Button>
          <Button type="button" className="flex-1" disabled={loading} onClick={() => submitCertificate('download')}>
            <FileDown className="mr-2 h-4 w-4" />
            Tải xuống
          </Button>
          <Button type="button" variant="secondary" className="flex-1" disabled={loading} onClick={() => submitCertificate('print')}>
            <Printer className="mr-2 h-4 w-4" />
            In
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
