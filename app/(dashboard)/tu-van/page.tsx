"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Plus, CalendarPlus2, Funnel, PhoneCall, GraduationCap, Edit3, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentDialog } from '@/components/consulting/appointment-dialog';
import { formatDateTime } from '@/lib/utils';
import { AppointmentStatus, Lead, LeadSource, LeadStatus } from '@/types';

const leadStatusOrder: LeadStatus[] = ['Mới', 'Đang liên hệ', 'Đã đặt hẹn', 'Đã đăng ký', 'Có thể liên hệ lại', 'Không tiềm năng'];
const leadSourceOrder: LeadSource[] = ['Facebook', 'Website', 'Điện thoại', 'Giới thiệu'];
const appointmentStatusOrder: AppointmentStatus[] = ['Chờ đến', 'Hoàn thành', 'Hẹn lại', 'Không đến'];

type AppointmentItem = {
  id: number;
  leadId: number;
  scheduledAt: string;
  status: AppointmentStatus;
  note?: string;
};

const filterSchema = z.object({
  search: z.string().default(''),
  status: z.string().default('all'),
  source: z.string().default('all'),
});

function toDateOnly(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getLeadStatusBadgeClass(status: LeadStatus) {
  if (status === 'Mới') return 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300';
  if (status === 'Đang liên hệ') return 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-300';
  if (status === 'Đã đặt hẹn') return 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-300';
  if (status === 'Đã đăng ký') return 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-300';
  if (status === 'Có thể liên hệ lại') return 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300';
  return 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-300';
}

function getLeadSourceBadgeClass(source: LeadSource) {
  if (source === 'Facebook') return 'bg-[#1877f2]/10 text-[#1877f2] ring-1 ring-inset ring-[#1877f2]/30';
  if (source === 'Website') return 'bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300';
  if (source === 'Điện thoại') return 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-300';
  return 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-300';
}

function getAppointmentStatusBadgeClass(status: AppointmentStatus) {
  if (status === 'Chờ đến') return 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300';
  if (status === 'Hoàn thành') return 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-300';
  if (status === 'Hẹn lại') return 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300';
  return 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-300';
}

export default function ConsultingPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadEditOpen, setLeadEditOpen] = useState(false);
  const [savingLeadEdit, setSavingLeadEdit] = useState(false);
  const [leadEditForm, setLeadEditForm] = useState({
    fullName: '',
    parentPhone: '',
    parentName: '',
    source: 'Facebook' as LeadSource,
    status: 'Mới' as LeadStatus,
    note: '',
  });
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const [appointmentEditOpen, setAppointmentEditOpen] = useState(false);
  const [savingAppointmentEdit, setSavingAppointmentEdit] = useState(false);
  const [appointmentEditForm, setAppointmentEditForm] = useState({
    scheduledAt: '',
    status: 'Chờ đến' as AppointmentStatus,
    note: '',
  });
  const [newLead, setNewLead] = useState({
    fullName: '',
    parentPhone: '',
    parentName: '',
    source: 'Facebook' as LeadSource,
    preferredSubjects: ['MATH'] as Array<'MATH' | 'EFL'>,
    note: '',
  });

  const loadData = async () => {
    setError('');
    try {
      const response = await fetch('/api/tu-van', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Khong the tai du lieu tu van');
      }

      const payload = (await response.json()) as {
        leads: Lead[];
        appointments: AppointmentItem[];
      };

      setLeads(payload.leads || []);
      setAppointments(payload.appointments || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Co loi khi tai du lieu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredLeads = useMemo(() => {
    const parsed = filterSchema.parse({ search, status: statusFilter, source: sourceFilter });
    return leads.filter((lead) => {
      const matchesSearch =
        parsed.search.length === 0 ||
        lead.fullName.toLowerCase().includes(parsed.search.toLowerCase()) ||
        lead.parentPhone.includes(parsed.search) ||
        (lead.parentName ?? '').toLowerCase().includes(parsed.search.toLowerCase());

      const matchesStatus = parsed.status === 'all' || lead.status === parsed.status;
      const matchesSource = parsed.source === 'all' || lead.source === parsed.source;

      return matchesSearch && matchesStatus && matchesSource;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leads, search, sourceFilter, statusFilter]);

  const statusChart = leadStatusOrder.map((status) => ({
    status,
    count: leads.filter((lead) => lead.status === status).length,
  }));

  const sourceChart = leadSourceOrder.map((source) => ({
    source,
    count: leads.filter((lead) => lead.source === source).length,
  }));

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((item) => appointmentStatusFilter === 'all' || item.status === appointmentStatusFilter)
      .filter((item) => appointmentDateFilter.length === 0 || toDateOnly(item.scheduledAt) === appointmentDateFilter)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }, [appointmentDateFilter, appointmentStatusFilter, appointments]);

  const selectedLeadFromList = useMemo(
    () => filteredLeads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? null,
    [filteredLeads, selectedLeadId]
  );

  useEffect(() => {
    if (filteredLeads.length === 0) {
      setSelectedLeadId(null);
      return;
    }

    const exists = selectedLeadId !== null && filteredLeads.some((lead) => lead.id === selectedLeadId);
    if (!exists) {
      setSelectedLeadId(filteredLeads[0].id);
    }
  }, [filteredLeads, selectedLeadId]);

  const openAppointment = (lead: Lead) => {
    setSelectedLead(lead);
    setAppointmentOpen(true);
  };

  const openRegistration = (lead: Lead) => {
    router.push(`/hoc-vien?tab=nhap-hoc&leadId=${lead.id}`);
  };

  const openLeadEdit = (lead: Lead) => {
    setLeadEditForm({
      fullName: lead.fullName,
      parentPhone: lead.parentPhone,
      parentName: lead.parentName ?? '',
      source: lead.source,
      status: lead.status,
      note: lead.note ?? '',
    });
    setLeadEditOpen(true);
  };

  const submitLeadEdit = async () => {
    if (!selectedLeadFromList) return;

    setSavingLeadEdit(true);
    try {
      const response = await fetch(`/api/tu-van/leads/${selectedLeadFromList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadEditForm),
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật tư vấn');
      }

      setLeadEditOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi cập nhật tư vấn');
    } finally {
      setSavingLeadEdit(false);
    }
  };

  const handleAppointmentSave = async (payload: { scheduledAt: string; status: AppointmentStatus; note?: string }) => {
    if (!selectedLead) return;

    try {
      const createAppointmentRes = await fetch('/api/tu-van/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          scheduledAt: payload.scheduledAt,
          status: payload.status,
          note: payload.note,
        }),
      });

      if (!createAppointmentRes.ok) {
        throw new Error('Không thể lưu lịch hẹn');
      }

      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Co loi khi luu lich hen');
    }
  };

  const openAppointmentEdit = (appointment: AppointmentItem) => {
    setEditingAppointment(appointment);
    setAppointmentEditForm({
      scheduledAt: appointment.scheduledAt.slice(0, 16),
      status: appointment.status,
      note: appointment.note ?? '',
    });
    setAppointmentEditOpen(true);
  };

  const submitAppointmentEdit = async () => {
    if (!editingAppointment) return;

    setSavingAppointmentEdit(true);
    try {
      const response = await fetch(`/api/tu-van/appointments/${editingAppointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: appointmentEditForm.scheduledAt,
          status: appointmentEditForm.status,
          note: appointmentEditForm.note,
        }),
      });

      if (!response.ok) {
        throw new Error('Khong the cap nhat lich hen');
      }

      setAppointmentEditOpen(false);
      setEditingAppointment(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Co loi khi cap nhat lich hen');
    } finally {
      setSavingAppointmentEdit(false);
    }
  };

  const toggleSubject = (subject: 'MATH' | 'EFL') => {
    setNewLead((current) => {
      const exists = current.preferredSubjects.includes(subject);
      if (exists) {
        const next = current.preferredSubjects.filter((item) => item !== subject);
        return { ...current, preferredSubjects: next.length > 0 ? next : ['MATH'] };
      }

      return { ...current, preferredSubjects: [...current.preferredSubjects, subject] };
    });
  };

  const submitNewLead = async () => {
    if (!newLead.fullName || !newLead.parentPhone) {
      setError('Vui lòng nhập họ tên và số điện thoại của phụ huynh');
      return;
    }

    setCreatingLead(true);
    try {
      const response = await fetch('/api/tu-van', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });

      if (!response.ok) {
        throw new Error('Không thể tạo tư vấn mới');
      }

      setLeadDialogOpen(false);
      setNewLead({
        fullName: '',
        parentPhone: '',
        parentName: '',
        source: 'Facebook',
        preferredSubjects: ['MATH'],
        note: '',
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi tạo tư vấn mới');
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Tư vấn & CRM</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Bảng, biểu đồ, lịch hẹn, và đăng ký học từ tư vấn.</p>
            </div>
            <Badge variant="secondary">{leads.length} tư vấn</Badge>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Theo trạng thái</p>
                <Funnel className="h-4 w-4 text-kumon-600" />
              </div>
              <div className="space-y-3">
                {statusChart.map((item) => (
                  <div key={item.status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{item.status}</span>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-kumon-500" style={{ width: `${Math.max(item.count * 12, 8)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Theo nguồn</p>
                <PhoneCall className="h-4 w-4 text-amber-600" />
              </div>
              <div className="space-y-3">
                {sourceChart.map((item) => (
                  <div key={item.source}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{item.source}</span>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.max(item.count * 18, 8)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Chỉ số nhanh</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">Lịch hẹn chờ đến</p>
                <p className="mt-1 text-3xl font-bold text-emerald-900">{appointments.filter((item) => item.status === 'Chờ đến').length}</p>
              </div>
              <div className="rounded-2xl border bg-amber-50 p-4">
                <p className="text-sm text-amber-700">Tư vấn đã đăng ký</p>
                <p className="mt-1 text-3xl font-bold text-amber-900">{leads.filter((lead) => lead.status === 'Đã đăng ký').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Danh sách tư vấn</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Sắp xếp mặc định theo ngày mới nhất.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4 xl:w-[980px]">
            <div className="relative">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, SĐT, phụ huynh..." className="pl-10" />
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {leadStatusOrder.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Nguồn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nguồn</SelectItem>
                {leadSourceOrder.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setLeadDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm tư vấn
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {loading ? <p className="mb-3 text-sm text-muted-foreground">Đang tải dữ liệu...</p> : null}
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-2xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Học viên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedLeadFromList?.id === lead.id ? 'bg-slate-100/70' : ''}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-950">{lead.fullName}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <HoverTooltip content={lead.parentPhone}>
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                                aria-label="Xem số điện thoại phụ huynh"
                              >
                                <PhoneCall className="h-3 w-3" />
                              </span>
                            </HoverTooltip>
                            {lead.parentName ?? 'Chưa có phụ huynh'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getLeadStatusBadgeClass(lead.status)}>{lead.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getLeadSourceBadgeClass(lead.source)}>{lead.source}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(lead.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Card className="border bg-white xl:sticky xl:top-24">
              <CardHeader>
                <CardTitle>Chi tiết tư vấn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLeadFromList ? (
                  <>
                    <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
                      <p className="text-lg font-semibold text-slate-950">{selectedLeadFromList.fullName}</p>
                      <p className="mt-1 text-muted-foreground">Phụ huynh: {selectedLeadFromList.parentName ?? '-'}</p>
                      <p className="text-muted-foreground">SĐT: {selectedLeadFromList.parentPhone}</p>
                      <p className="text-muted-foreground">Tạo lúc: {formatDateTime(selectedLeadFromList.createdAt)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className={getLeadStatusBadgeClass(selectedLeadFromList.status)}>{selectedLeadFromList.status}</Badge>
                        <Badge className={getLeadSourceBadgeClass(selectedLeadFromList.source)}>{selectedLeadFromList.source}</Badge>
                      </div>
                      <p className="mt-3 text-muted-foreground">Ghi chú: {selectedLeadFromList.note || '-'}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Button variant="outline" onClick={() => openLeadEdit(selectedLeadFromList)}>
                        <Edit3 className="mr-2 h-4 w-4" />Chỉnh sửa
                      </Button>
                      <Button variant="outline" onClick={() => openAppointment(selectedLeadFromList)}>
                        <CalendarPlus2 className="mr-2 h-4 w-4" />Lên lịch hẹn
                      </Button>
                      <Button onClick={() => openRegistration(selectedLeadFromList)}>
                        <GraduationCap className="mr-2 h-4 w-4" />Đăng ký học
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Chọn một học viên từ bảng bên trái để xem chi tiết.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <CardTitle>Toàn bộ lịch hẹn</CardTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:w-[520px]">
            <Input type="date" value={appointmentDateFilter} onChange={(event) => setAppointmentDateFilter(event.target.value)} />
            <Select value={appointmentStatusFilter} onValueChange={setAppointmentStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Trạng thái lịch hẹn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {appointmentStatusOrder.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Học viên</TableHead>
                <TableHead>Ngày hẹn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appointment) => {
                const linkedLead = leads.find((lead) => lead.id === appointment.leadId);
                return (
                  <TableRow key={appointment.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openAppointmentEdit(appointment)}>
                    <TableCell className="font-medium">{linkedLead?.fullName ?? 'Tư vấn đã xóa'}</TableCell>
                    <TableCell>{formatDateTime(appointment.scheduledAt)}</TableCell>
                    <TableCell>
                      <Badge className={getAppointmentStatusBadgeClass(appointment.status)}>{appointment.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate text-muted-foreground">{appointment.note || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); openAppointmentEdit(appointment); }}>
                        <Edit3 className="mr-2 h-4 w-4" />Chỉnh sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AppointmentDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        lead={selectedLead}
        onSave={handleAppointmentSave}
      />

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm tư vấn mới</DialogTitle>
            <DialogDescription>Thông tin sẽ được lưu vào CRM và hiện ngay trong danh sách.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Họ tên học viên</Label>
              <Input value={newLead.fullName} onChange={(event) => setNewLead((current) => ({ ...current, fullName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>SĐT phụ huynh</Label>
              <Input value={newLead.parentPhone} onChange={(event) => setNewLead((current) => ({ ...current, parentPhone: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tên phụ huynh</Label>
              <Input value={newLead.parentName} onChange={(event) => setNewLead((current) => ({ ...current, parentName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nguồn</Label>
              <Select value={newLead.source} onValueChange={(value) => setNewLead((current) => ({ ...current, source: value as LeadSource }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leadSourceOrder.map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Môn quan tâm</Label>
              <div className="flex gap-2">
                <Button type="button" variant={newLead.preferredSubjects.includes('MATH') ? 'default' : 'outline'} onClick={() => toggleSubject('MATH')}>
                  Toán
                </Button>
                <Button type="button" variant={newLead.preferredSubjects.includes('EFL') ? 'default' : 'outline'} onClick={() => toggleSubject('EFL')}>
                  Tiếng Anh
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú</Label>
              <Input value={newLead.note} onChange={(event) => setNewLead((current) => ({ ...current, note: event.target.value }))} placeholder="Nhu cầu học, mục tiêu, khung giờ ưu tiên..." />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeadDialogOpen(false)}>Hủy</Button>
            <Button type="button" onClick={submitNewLead} disabled={creatingLead}>{creatingLead ? 'Đang lưu...' : 'Lưu tư vấn'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leadEditOpen} onOpenChange={setLeadEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa</DialogTitle>
            <DialogDescription>Cập nhật thông tin, nguồn và trạng thái tư vấn.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Họ tên học viên</Label>
              <Input value={leadEditForm.fullName} onChange={(event) => setLeadEditForm((current) => ({ ...current, fullName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>SĐT phụ huynh</Label>
              <Input value={leadEditForm.parentPhone} onChange={(event) => setLeadEditForm((current) => ({ ...current, parentPhone: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tên phụ huynh</Label>
              <Input value={leadEditForm.parentName} onChange={(event) => setLeadEditForm((current) => ({ ...current, parentName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nguồn</Label>
              <Select value={leadEditForm.source} onValueChange={(value) => setLeadEditForm((current) => ({ ...current, source: value as LeadSource }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadSourceOrder.map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={leadEditForm.status} onValueChange={(value) => setLeadEditForm((current) => ({ ...current, status: value as LeadStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadStatusOrder.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú</Label>
              <Textarea value={leadEditForm.note} onChange={(event) => setLeadEditForm((current) => ({ ...current, note: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeadEditOpen(false)}>Hủy</Button>
            <Button type="button" onClick={() => void submitLeadEdit()} disabled={savingLeadEdit}>{savingLeadEdit ? 'Đang lưu...' : 'Lưu chỉnh sửa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={appointmentEditOpen} onOpenChange={setAppointmentEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa lịch hẹn</DialogTitle>
            <DialogDescription>Cập nhật ngày hẹn, trạng thái và ghi chú.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngày hẹn</Label>
              <Input
                type="datetime-local"
                value={appointmentEditForm.scheduledAt}
                onChange={(event) => setAppointmentEditForm((current) => ({ ...current, scheduledAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                value={appointmentEditForm.status}
                onValueChange={(value) => setAppointmentEditForm((current) => ({ ...current, status: value as AppointmentStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {appointmentStatusOrder.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={appointmentEditForm.note}
                onChange={(event) => setAppointmentEditForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Nội dung trao đổi, lưu ý, tình trạng liên hệ..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAppointmentEditOpen(false)}>Hủy</Button>
            <Button type="button" onClick={() => void submitAppointmentEdit()} disabled={savingAppointmentEdit}>
              {savingAppointmentEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
