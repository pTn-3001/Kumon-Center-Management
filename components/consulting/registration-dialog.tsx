"use client";

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Lead, SubjectCode } from '@/types';

const registrationSchema = z.object({
  fullName: z.string().min(2, 'Nhập họ tên'),
  parentPhone: z.string().min(9, 'Nhập số điện thoại phụ huynh'),
  parentName: z.string().min(2, 'Nhập tên phụ huynh'),
  subjects: z.array(z.enum(['MATH', 'EFL'])).min(1, 'Chọn ít nhất một môn'),
  enrollmentType: z.enum(['2 buổi/tuần', 'Hàng ngày']),
  studyDays: z.string().min(1, 'Chọn ngày học'),
  classShift: z.enum(['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5']),
  admissionDate: z.string().min(1, 'Chọn ngày nhập học'),
  note: z.string().optional(),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (payload: RegistrationFormValues) => void;
}

const studyDayOptions = [
  { value: 'T2-T6', label: 'T2-T6 · 16:15 - 18:15' },
  { value: 'T3-T7', label: 'T3-T7 · 16:15 / T7 · 09:00' },
  { value: 'T2-T4', label: 'T2-T4 · 16:15 - 17:15' },
  { value: 'T5-T7', label: 'T5-T7 · 16:15 / T7 · 09:00' },
];

export function RegistrationDialog({ open, onOpenChange, lead, onSave }: RegistrationDialogProps) {
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: '',
      parentPhone: '',
      parentName: '',
      subjects: ['MATH'],
      enrollmentType: '2 buổi/tuần',
      studyDays: 'T2-T6',
      classShift: 'Ca 1',
      admissionDate: '',
      note: '',
    },
  });

  useEffect(() => {
    if (!open) return;

    const today = new Date();
    form.reset({
      fullName: lead?.fullName ?? '',
      parentPhone: lead?.parentPhone ?? '',
      parentName: lead?.parentName ?? '',
      subjects: lead?.preferredSubjects?.length ? lead.preferredSubjects : ['MATH'],
      enrollmentType: '2 buổi/tuần',
      studyDays: 'T2-T6',
      classShift: 'Ca 1',
      admissionDate: today.toISOString().slice(0, 10),
      note: lead ? `Chuyển đổi từ lead ${lead.fullName}` : '',
    });
  }, [lead, form, open]);

  const submit = form.handleSubmit((values: RegistrationFormValues) => {
    onSave(values);
    onOpenChange(false);
  });

  const subjectOptions: Array<{ code: SubjectCode; label: string }> = [
    { code: 'MATH', label: 'Toán' },
    { code: 'EFL', label: 'Tiếng Anh' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Đăng ký học</DialogTitle>
          <DialogDescription>Chọn môn học, ngày học và ca học theo logic Kumon.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Họ tên học viên</Label>
              <Input id="fullName" {...form.register('fullName')} />
              {form.formState.errors.fullName ? <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentPhone">SĐT phụ huynh</Label>
              <Input id="parentPhone" {...form.register('parentPhone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentName">Họ tên phụ huynh</Label>
              <Input id="parentName" {...form.register('parentName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admissionDate">Ngày nhập học</Label>
              <Input id="admissionDate" type="date" {...form.register('admissionDate')} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Môn học</Label>
            <Controller
              control={form.control}
              name="subjects"
              render={({ field }) => (
                <div className="flex flex-wrap gap-3">
                  {subjectOptions.map((subject) => {
                    const checked = field.value.includes(subject.code);
                    return (
                      <label key={subject.code} className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            if (value) {
                              field.onChange([...field.value, subject.code]);
                            } else {
                              field.onChange(field.value.filter((item) => item !== subject.code));
                            }
                          }}
                        />
                        {subject.label}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {form.formState.errors.subjects ? <p className="text-sm text-destructive">{form.formState.errors.subjects.message}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Loại đăng ký</Label>
              <Select value={form.watch('enrollmentType')} onValueChange={(value: string) => form.setValue('enrollmentType', value as '2 buổi/tuần' | 'Hàng ngày')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2 buổi/tuần">2 buổi/tuần</SelectItem>
                  <SelectItem value="Hàng ngày">Hàng ngày</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày học</Label>
              <Select value={form.watch('studyDays')} onValueChange={(value: string) => form.setValue('studyDays', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {studyDayOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ca học</Label>
              <Select value={form.watch('classShift')} onValueChange={(value: string) => form.setValue('classShift', value as RegistrationFormValues['classShift'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ca 1">Ca 1</SelectItem>
                  <SelectItem value="Ca 2">Ca 2</SelectItem>
                  <SelectItem value="Ca 3">Ca 3</SelectItem>
                  <SelectItem value="Ca 4">Ca 4</SelectItem>
                  <SelectItem value="Ca 5">Ca 5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Input id="note" {...form.register('note')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit">Tạo hồ sơ học viên</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
