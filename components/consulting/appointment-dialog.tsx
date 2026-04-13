"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Lead, AppointmentStatus } from '@/types';
import { formatDateTime } from '@/lib/utils';

const appointmentSchema = z.object({
  scheduledAt: z.string().min(1, 'Chọn ngày hẹn'),
  status: z.enum(['Chờ đến', 'Hoàn thành', 'Hẹn lại', 'Không đến']),
  note: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (payload: AppointmentFormValues) => void;
}

export function AppointmentDialog({ open, onOpenChange, lead, onSave }: AppointmentDialogProps) {
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      scheduledAt: '',
      status: 'Chờ đến',
      note: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    const nextSlot = new Date();
    nextSlot.setDate(nextSlot.getDate() + 1);
    nextSlot.setHours(14, 30, 0, 0);

    form.reset({
      scheduledAt: nextSlot.toISOString().slice(0, 16),
      status: 'Chờ đến',
      note: lead ? `Tư vấn cho ${lead.fullName}` : '',
    });
  }, [lead, form, open]);

  const submit = form.handleSubmit((values: AppointmentFormValues) => {
    onSave(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lên lịch hẹn</DialogTitle>
          <DialogDescription>Lịch hẹn được kế thừa từ tư vấn đã chọn.</DialogDescription>
        </DialogHeader>

        {lead ? (
          <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-slate-700">
            <div className="grid gap-2 sm:grid-cols-2">
              <p><span className="font-semibold">Học viên:</span> {lead.fullName}</p>
              <p><span className="font-semibold">Phụ huynh:</span> {lead.parentName ?? '-'}</p>
              <p><span className="font-semibold">SĐT phụ huynh:</span> {lead.parentPhone}</p>
              <p><span className="font-semibold">Nguồn:</span> {lead.source}</p>
            </div>
            <p className="mt-3 text-slate-500">Tư vấn tạo lúc {formatDateTime(lead.createdAt)}</p>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Ngày hẹn</Label>
              <Input id="scheduledAt" type="datetime-local" {...form.register('scheduledAt')} />
              {form.formState.errors.scheduledAt ? <p className="text-sm text-destructive">{form.formState.errors.scheduledAt.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={form.watch('status')} onValueChange={(value: string) => form.setValue('status', value as AppointmentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chờ đến">Chờ đến</SelectItem>
                  <SelectItem value="Hoàn thành">Hoàn thành</SelectItem>
                  <SelectItem value="Hẹn lại">Hẹn lại</SelectItem>
                  <SelectItem value="Không đến">Không đến</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Input id="note" placeholder="Nội dung tư vấn..." {...form.register('note')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit">Lưu lịch hẹn</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
