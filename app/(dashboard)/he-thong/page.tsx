"use client";

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, UserPlus, UsersRound, KeyRound, X, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { formatCurrency, formatNumberWithDots, parseNumberFromInput } from '@/lib/utils';
import type { StaffRole } from '@/types';

type StaffEmploymentType = 'Full-time' | 'Part-time';

type StaffTimeEntry = {
  id: number;
  workDate: string;
  clockIn: string;
  clockOut: string | null;
  note: string | null;
};

type StaffItem = {
  id: number;
  fullName: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  role: StaffRole;
  employmentType: StaffEmploymentType;
  joinDate?: string | null;
  contractEndDate?: string | null;
  salary: number;
  hourlyRate?: number | null;
  leaveDate?: string | null;
  leaveDays?: string[];
  timeEntries?: StaffTimeEntry[];
  active: boolean;
};

type SalaryFinanceItem = {
  type: string;
  note: string | null;
  spentAt: string;
};

const permissions: Record<StaffRole, string[]> = {
  Admin: ['Dashboard', 'Học viên', 'Lớp học', 'Học thuật', 'Kho', 'Tư vấn & CRM', 'Tài chính', 'In giấy khen','Hệ thống'],
  'Giáo viên': ['Học viên', 'Lớp học', 'Học thuật'],
  'Trợ giảng': ['Học viên', 'Lớp học', 'Học thuật'],
  'Tư vấn': ['Tư vấn & CRM', 'In giấy khen', 'Kho', 'Lớp học', 'Học viên'],
};

function isDateInRange(dateText: string, startText?: string | null, endText?: string | null) {
  const target = new Date(dateText);
  if (Number.isNaN(target.getTime())) return false;

  if (startText) {
    const start = new Date(startText);
    if (!Number.isNaN(start.getTime()) && target < start) return false;
  }

  if (endText) {
    const end = new Date(endText);
    if (!Number.isNaN(end.getTime()) && target > end) return false;
  }

  return true;
}

function getLeaveDaysInContractPeriod(leaveDays: string[] | undefined, joinDate?: string | null, contractEndDate?: string | null) {
  return (leaveDays ?? []).filter((date) => isDateInRange(date, joinDate, contractEndDate));
}

function isPartTimeStaff(staff: StaffItem) {
  return staff.employmentType === 'Part-time' || (staff.hourlyRate ?? 0) > 0;
}

export default function SystemPage() {
  const [staffs, setStaffs] = useState<StaffItem[]>([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('Tư vấn');
  const [employmentType, setEmploymentType] = useState<StaffEmploymentType>('Full-time');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractEndDate, setContractEndDate] = useState('');
  const [salary, setSalary] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [error, setError] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [leavePickerDate, setLeavePickerDate] = useState(new Date().toISOString().slice(0, 10));
  const [pendingLeaveDates, setPendingLeaveDates] = useState<string[]>([]);
  const [editingStaff, setEditingStaff] = useState(false);
  const [staffEditForm, setStaffEditForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    role: 'Tư vấn' as StaffRole,
    employmentType: 'Full-time' as StaffEmploymentType,
    joinDate: '',
    contractEndDate: '',
    salary: '',
    hourlyRate: '',
    password: '',
  });
  const [timeEntryForm, setTimeEntryForm] = useState({
    workDate: new Date().toISOString().slice(0, 10),
    clockInTime: '08:00',
    clockOutTime: '17:00',
    note: '',
  });
  const [paidSalaryMonthKeys, setPaidSalaryMonthKeys] = useState<Set<string>>(new Set());
  const [portalReady, setPortalReady] = useState(false);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const getCurrentMonthLeaveDays = (leaveDays?: string[]) => {
    return (leaveDays ?? []).filter((date) => date.startsWith(currentMonthKey));
  };

  const selectedStaffContractLeaveDays = useMemo(() => {
    if (!selectedStaff) return [] as string[];
    return getLeaveDaysInContractPeriod(selectedStaff.leaveDays, selectedStaff.joinDate, selectedStaff.contractEndDate);
  }, [selectedStaff]);

  const selectedStaffCurrentMonthHours = useMemo(() => {
    if (!selectedStaff || !isPartTimeStaff(selectedStaff)) return 0;
    const prefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return (selectedStaff.timeEntries ?? [])
      .filter((entry) => entry.workDate.startsWith(prefix) && entry.clockOut)
      .reduce((sum, entry) => {
        const inTime = new Date(entry.clockIn).getTime();
        const outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : inTime;
        const hours = Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
        return sum + hours;
      }, 0);
  }, [selectedStaff]);

  const selectedStaffCurrentMonthPaid = useMemo(() => {
    if (!selectedStaff || !isPartTimeStaff(selectedStaff)) return false;
    return paidSalaryMonthKeys.has(`${selectedStaff.id}:${currentMonthKey}`);
  }, [currentMonthKey, paidSalaryMonthKeys, selectedStaff]);

  const loadStaffs = async () => {
    setError('');
    try {
      const response = await fetch('/api/he-thong/staff', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Khong the tai danh sach nhan su');
      }

      setStaffs((await response.json()) as StaffItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Co loi khi tai nhan su');
    }
  };

  const loadPaidSalaryMonths = async () => {
    try {
      const response = await fetch('/api/tai-chinh', { cache: 'no-store' });
      if (!response.ok) return;

      const items = (await response.json()) as SalaryFinanceItem[];
      const nextKeys = new Set<string>();

      items.forEach((item) => {
        if (item.type !== 'Lương') return;
        const match = /\[SALARY\]\s*staffId=(\d+)/.exec(item.note ?? '');
        const staffId = match?.[1];
        const monthKey = item.spentAt?.slice(0, 7);
        if (!staffId || !monthKey) return;
        nextKeys.add(`${staffId}:${monthKey}`);
      });

      setPaidSalaryMonthKeys(nextKeys);
    } catch {
      // Silent fail: salary-payment lock is supplemental UX data.
    }
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    void Promise.all([loadStaffs(), loadPaidSalaryMonths()]);
  }, []);

  const stats = useMemo(() => ({
    admins: staffs.filter((staff) => staff.role === 'Admin').length,
    active: staffs.filter((staff) => staff.active).length,
    consultants: staffs.filter((staff) => staff.role === 'Tư vấn').length,
  }), [staffs]);

  const addStaff = async () => {
    if (!fullName || !username || !password) return;
    if (employmentType === 'Full-time' && !salary) return;
    if (employmentType === 'Part-time' && !hourlyRate) return;
    try {
      const response = await fetch('/api/he-thong/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          email,
          phone,
          password,
          role,
          employmentType,
          joinDate,
          contractEndDate: contractEndDate || null,
          salary: parseNumberFromInput(salary),
          hourlyRate: employmentType === 'Part-time' ? parseNumberFromInput(hourlyRate) : null,
          active: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Khong the tao nhan su');
      }

      setFullName('');
      setUsername('');
      setEmail('');
      setPhone('');
      setPassword('');
      setEmploymentType('Full-time');
      setJoinDate(new Date().toISOString().slice(0, 10));
      setContractEndDate('');
      setSalary('');
      setHourlyRate('');
      await loadStaffs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Co loi khi tao nhan su');
    }
  };

  const openStaffPanel = (staffId: number) => {
    void loadPaidSalaryMonths();
    const target = staffs.find((item) => item.id === staffId) ?? null;
    setSelectedStaff(target);
    setEditingStaff(false);
    if (target) {
      setStaffEditForm({
        fullName: target.fullName,
        username: target.username ?? '',
        email: target.email ?? '',
        phone: target.phone ?? '',
        role: target.role,
        employmentType: target.employmentType,
        joinDate: target.joinDate ?? '',
        contractEndDate: target.contractEndDate ?? '',
        salary: formatNumberWithDots(target.salary),
        hourlyRate: target.hourlyRate != null ? formatNumberWithDots(target.hourlyRate) : '',
        password: '',
      });
    }
    setPendingLeaveDates([]);
    setLeavePickerDate(new Date().toISOString().slice(0, 10));
  };

  const closeStaffPanel = () => {
    setSelectedStaff(null);
    setEditingStaff(false);
    setPendingLeaveDates([]);
  };

  const submitStaffEdit = async () => {
    if (!selectedStaff) return;

    const response = await fetch(`/api/he-thong/staff/${selectedStaff.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: staffEditForm.fullName,
        username: staffEditForm.username,
        email: staffEditForm.email || null,
        phone: staffEditForm.phone || null,
        role: staffEditForm.role,
        employmentType: staffEditForm.employmentType,
        joinDate: staffEditForm.joinDate || null,
        contractEndDate: staffEditForm.contractEndDate || null,
        salary: staffEditForm.employmentType === 'Full-time' ? parseNumberFromInput(staffEditForm.salary) : 0,
        hourlyRate: staffEditForm.hourlyRate ? parseNumberFromInput(staffEditForm.hourlyRate) : null,
        password: staffEditForm.password || undefined,
      }),
    });

    if (!response.ok) {
      setError('Không thể cập nhật thông tin nhân sự');
      return;
    }

    const updated = (await response.json()) as {
      id: number;
      fullName: string;
      username?: string | null;
      email?: string | null;
      phone?: string | null;
      role: StaffRole;
      employmentType: StaffEmploymentType;
      joinDate?: string | null;
      contractEndDate?: string | null;
      salary: number;
      hourlyRate?: number | null;
      leaveDate?: string | null;
      active: boolean;
    };

    setStaffs((current) => current.map((staff) => (
      staff.id === updated.id
        ? {
          ...staff,
          fullName: updated.fullName,
          username: updated.username ?? null,
          email: updated.email ?? null,
          phone: updated.phone ?? null,
          role: updated.role,
          employmentType: updated.employmentType,
          joinDate: updated.joinDate ?? null,
          contractEndDate: updated.contractEndDate ?? null,
          salary: updated.salary,
          hourlyRate: updated.hourlyRate ?? null,
          active: updated.active,
        }
        : staff
    )));
    setSelectedStaff((current) => current ? {
      ...current,
      fullName: updated.fullName,
      username: updated.username ?? null,
      email: updated.email ?? null,
      phone: updated.phone ?? null,
      role: updated.role,
      employmentType: updated.employmentType,
      joinDate: updated.joinDate ?? null,
      contractEndDate: updated.contractEndDate ?? null,
      salary: updated.salary,
      hourlyRate: updated.hourlyRate ?? null,
      active: updated.active,
    } : current);
    setEditingStaff(false);
    setStaffEditForm((current) => ({ ...current, password: '' }));
  };

  const addPendingLeaveDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(leavePickerDate)) return;
    setPendingLeaveDates((current) => current.includes(leavePickerDate) ? current : [...current, leavePickerDate].sort());
  };

  const removePendingLeaveDate = (date: string) => {
    setPendingLeaveDates((current) => current.filter((item) => item !== date));
  };

  const submitLeaveDates = async () => {
    if (!selectedStaff || pendingLeaveDates.length === 0) return;
    const response = await fetch(`/api/he-thong/staff/${selectedStaff.id}/leave-days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates: pendingLeaveDates }),
    });

    if (!response.ok) {
      setError('Không thể lưu ngày nghỉ phép');
      return;
    }

    const payload = (await response.json()) as { leaveDays?: string[] };
    const nextLeaveDays = payload.leaveDays ?? [];

    setStaffs((current) => current.map((staff) => (
      staff.id === selectedStaff.id
        ? { ...staff, leaveDays: nextLeaveDays, leaveDate: nextLeaveDays[0] ?? null }
        : staff
    )));
    setSelectedStaff((current) => current ? { ...current, leaveDays: nextLeaveDays, leaveDate: nextLeaveDays[0] ?? null } : current);
    setPendingLeaveDates([]);
  };

  const deleteLeaveDate = async (date: string) => {
    if (!selectedStaff) return;
    const response = await fetch(`/api/he-thong/staff/${selectedStaff.id}/leave-days`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });

    if (!response.ok) {
      setError('Không thể xóa ngày nghỉ phép');
      return;
    }

    const payload = (await response.json()) as { leaveDays?: string[] };
    const nextLeaveDays = payload.leaveDays ?? [];

    setStaffs((current) => current.map((staff) => (
      staff.id === selectedStaff.id
        ? { ...staff, leaveDays: nextLeaveDays, leaveDate: nextLeaveDays[0] ?? null }
        : staff
    )));
    setSelectedStaff((current) => current ? { ...current, leaveDays: nextLeaveDays, leaveDate: nextLeaveDays[0] ?? null } : current);
  };

  const toggleStaffActive = async () => {
    if (!selectedStaff) return;
    const nextActive = !selectedStaff.active;

    const response = await fetch(`/api/he-thong/staff/${selectedStaff.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: nextActive }),
    });

    if (!response.ok) {
      setError('Không thể cập nhật trạng thái tài khoản');
      return;
    }

    setStaffs((current) => current.map((staff) => (
      staff.id === selectedStaff.id ? { ...staff, active: nextActive } : staff
    )));
    setSelectedStaff((current) => current ? { ...current, active: nextActive } : current);
  };

  const addTimeEntry = async () => {
    if (!selectedStaff || !isPartTimeStaff(selectedStaff)) return;

    const response = await fetch(`/api/he-thong/staff/${selectedStaff.id}/time-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timeEntryForm),
    });

    if (!response.ok) {
      setError('Không thể lưu giờ vào/ra');
      return;
    }

    const created = (await response.json()) as StaffTimeEntry;
    setStaffs((current) => current.map((staff) => (
      staff.id === selectedStaff.id
        ? { ...staff, timeEntries: [created, ...(staff.timeEntries ?? [])] }
        : staff
    )));
    setSelectedStaff((current) => current ? { ...current, timeEntries: [created, ...(current.timeEntries ?? [])] } : current);
  };

  const deleteTimeEntry = async (entryId: number) => {
    if (!selectedStaff) return;

    const response = await fetch(`/api/he-thong/staff/${selectedStaff.id}/time-entries`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId }),
    });

    if (!response.ok) {
      setError('Không thể xóa bản ghi chấm công');
      return;
    }

    setStaffs((current) => current.map((staff) => (
      staff.id === selectedStaff.id
        ? { ...staff, timeEntries: (staff.timeEntries ?? []).filter((item) => item.id !== entryId) }
        : staff
    )));
    setSelectedStaff((current) => current ? { ...current, timeEntries: (current.timeEntries ?? []).filter((item) => item.id !== entryId) } : current);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Tài khoản Admin</p><p className="mt-2 text-3xl font-bold">{stats.admins}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Nhân sự hiện tại</p><p className="mt-2 text-3xl font-bold">{stats.active}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Tư vấn</p><p className="mt-2 text-3xl font-bold">{stats.consultants}</p></CardContent></Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.5fr_0.75fr]">
        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b bg-white/50">
            <CardTitle>Quản lý tài khoản nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Loại nhân sự</TableHead>
                  <TableHead>Lương</TableHead>
                  <TableHead>Ngày vào làm</TableHead>
                  <TableHead>Ngày kết thúc HĐ</TableHead>
                  <TableHead>Ngày nghỉ phép</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffs.map((staff) => (
                  <TableRow key={staff.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openStaffPanel(staff.id)}>
                    <TableCell className="font-medium">{staff.fullName}</TableCell>
                    <TableCell>{staff.username ?? '-'}</TableCell>
                    <TableCell>
                      {staff.email ? (
                        <HoverTooltip content={staff.email}>
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                            aria-label="Xem email"
                          >
                            <Mail className="h-4 w-4" />
                          </span>
                        </HoverTooltip>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {staff.phone ? (
                        <HoverTooltip content={staff.phone}>
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                            aria-label="Xem số điện thoại"
                          >
                            <Phone className="h-4 w-4" />
                          </span>
                        </HoverTooltip>
                      ) : '-'}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{staff.role}</Badge></TableCell>
                    <TableCell><Badge variant={isPartTimeStaff(staff) ? 'warning' : 'default'}>{isPartTimeStaff(staff) ? 'Part-time' : 'Full-time'}</Badge></TableCell>
                    <TableCell>{isPartTimeStaff(staff) ? `${formatCurrency(staff.hourlyRate ?? 0)}/giờ` : formatCurrency(staff.salary)}</TableCell>
                    <TableCell>{staff.joinDate ?? '-'}</TableCell>
                    <TableCell>{staff.contractEndDate ?? '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getCurrentMonthLeaveDays(staff.leaveDays).length ? `${getCurrentMonthLeaveDays(staff.leaveDays).length} ngày` : '-'}
                    </TableCell>
                    <TableCell><Badge variant={staff.active ? 'success' : 'destructive'}>{staff.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card h-fit w-full max-w-[760px] justify-self-start border border-kumon-200/70 2xl:justify-self-end">
          <CardHeader className="border-b bg-gradient-to-r from-kumon-50 to-white">
            <CardTitle>Thêm tài khoản nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Họ tên</Label>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Loại nhân sự</Label>
                <Select value={employmentType} onValueChange={(value) => setEmploymentType(value as StaffEmploymentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Username đăng nhập</Label>
                <Input value={username} onChange={(event) => setUsername(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SĐT</Label>
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <Select value={role} onValueChange={(value) => setRole(value as StaffRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Giáo viên">Giáo viên</SelectItem>
                    <SelectItem value="Trợ giảng">Trợ giảng</SelectItem>
                    <SelectItem value="Tư vấn">Tư vấn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {employmentType === 'Part-time' ? (
                <div className="space-y-2">
                  <Label>Lương theo giờ</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(formatNumberWithDots(event.target.value))}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Lương cơ bản</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={salary}
                    onChange={(event) => setSalary(formatNumberWithDots(event.target.value))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Ngày vào làm</Label>
                <Input type="date" value={joinDate} onChange={(event) => setJoinDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ngày kết thúc hợp đồng</Label>
                <Input type="date" value={contractEndDate} onChange={(event) => setContractEndDate(event.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={addStaff}><UserPlus className="mr-2 h-4 w-4" />Tạo tài khoản</Button>
          </CardContent>
        </Card>
      </section>

      {portalReady && selectedStaff ? createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[90] bg-slate-900/25" onClick={closeStaffPanel} aria-label="Đóng" />
          <aside className="fixed inset-y-0 right-0 z-[100] h-dvh w-full max-w-md overflow-y-auto border-l bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg uppercase tracking-[0.2em] text-slate-500">Chi tiết nhân sự</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">{selectedStaff.fullName}</h3>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={closeStaffPanel}><X className="h-4 w-4" /></Button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              {editingStaff ? (
                <div className="rounded-2xl border p-4">
                  <p className="font-semibold text-slate-900">Chỉnh sửa nhân sự</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Họ tên</Label>
                      <Input value={staffEditForm.fullName} onChange={(event) => setStaffEditForm((current) => ({ ...current, fullName: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Loại nhân sự</Label>
                      <Select value={staffEditForm.employmentType} onValueChange={(value) => setStaffEditForm((current) => ({ ...current, employmentType: value as StaffEmploymentType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[220]">
                          <SelectItem value="Full-time">Full-time</SelectItem>
                          <SelectItem value="Part-time">Part-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Username</Label>
                      <Input value={staffEditForm.username} onChange={(event) => setStaffEditForm((current) => ({ ...current, username: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Mật khẩu mới</Label>
                      <Input type="password" value={staffEditForm.password} onChange={(event) => setStaffEditForm((current) => ({ ...current, password: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input value={staffEditForm.email} onChange={(event) => setStaffEditForm((current) => ({ ...current, email: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>SĐT</Label>
                      <Input value={staffEditForm.phone} onChange={(event) => setStaffEditForm((current) => ({ ...current, phone: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Vai trò</Label>
                      <Select value={staffEditForm.role} onValueChange={(value) => setStaffEditForm((current) => ({ ...current, role: value as StaffRole }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[220]">
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Giáo viên">Giáo viên</SelectItem>
                          <SelectItem value="Trợ giảng">Trợ giảng</SelectItem>
                          <SelectItem value="Tư vấn">Tư vấn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {staffEditForm.employmentType === 'Part-time' ? (
                      <div className="space-y-1">
                        <Label>Lương theo giờ</Label>
                        <Input
                          value={staffEditForm.hourlyRate}
                          onChange={(event) => setStaffEditForm((current) => ({ ...current, hourlyRate: formatNumberWithDots(event.target.value) }))}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label>Lương cơ bản</Label>
                        <Input
                          value={staffEditForm.salary}
                          onChange={(event) => setStaffEditForm((current) => ({ ...current, salary: formatNumberWithDots(event.target.value) }))}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Ngày vào làm</Label>
                      <Input type="date" value={staffEditForm.joinDate} onChange={(event) => setStaffEditForm((current) => ({ ...current, joinDate: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Ngày kết thúc HĐ</Label>
                      <Input type="date" value={staffEditForm.contractEndDate} onChange={(event) => setStaffEditForm((current) => ({ ...current, contractEndDate: event.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" className="flex-1" onClick={() => void submitStaffEdit()}>Lưu chỉnh sửa</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingStaff(false)}>Hủy</Button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 rounded-2xl border bg-slate-50 p-4">
                <p><span className="font-medium">Username:</span> {selectedStaff.username ?? '-'}</p>
                <p><span className="font-medium">Vai trò:</span> {selectedStaff.role}</p>
                <p><span className="font-medium">Loại nhân sự:</span> {selectedStaff.employmentType}</p>
                <p><span className="font-medium">Email:</span> {selectedStaff.email ?? '-'}</p>
                <p><span className="font-medium">SĐT:</span> {selectedStaff.phone ?? '-'}</p>
                {isPartTimeStaff(selectedStaff)
                  ? <p><span className="font-medium">Lương theo giờ:</span> {formatCurrency(selectedStaff.hourlyRate ?? 0)}/giờ</p>
                  : <p><span className="font-medium">Lương tháng:</span> {formatCurrency(selectedStaff.salary)}</p>}
                <p><span className="font-medium">Ngày vào làm:</span> {selectedStaff.joinDate ?? '-'}</p>
                <p><span className="font-medium">Ngày kết thúc HĐ:</span> {selectedStaff.contractEndDate ?? '-'}</p>
                <p>
                  <span className="font-medium">Nghỉ phép trong năm hợp đồng:</span>{' '}
                  {selectedStaffContractLeaveDays.length > 0 ? `${selectedStaffContractLeaveDays.length} ngày` : '-'}
                </p>
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={() => setEditingStaff(true)}>
                Chỉnh sửa nhân sự
              </Button>

              <div className="rounded-2xl border p-4">
                <p className="font-semibold text-slate-900">Chọn ngày nghỉ phép</p>
                <div className="mt-3 flex items-center gap-2">
                  <Input type="date" value={leavePickerDate} onChange={(event) => setLeavePickerDate(event.target.value)} />
                  <Button type="button" variant="outline" onClick={addPendingLeaveDate}>Thêm</Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingLeaveDates.map((date) => (
                    <span key={date} className="inline-flex items-center gap-1 rounded-full bg-kumon-100 px-2 py-1 text-xs text-kumon-800">
                      {date}
                      <button type="button" onClick={() => removePendingLeaveDate(date)} className="text-kumon-900">×</button>
                    </span>
                  ))}
                </div>

                <Button type="button" className="mt-3 w-full" disabled={pendingLeaveDates.length === 0} onClick={submitLeaveDates}>
                  Chọn ngày nghỉ
                </Button>

                <Button type="button" className="mt-2 w-full" variant={selectedStaff.active ? 'destructive' : 'default'} onClick={() => void toggleStaffActive()}>
                  {selectedStaff.active ? 'Khóa tài khoản' : 'Bật lại tài khoản'}
                </Button>
              </div>

              <div className="rounded-2xl border p-4">
                <p className="font-semibold text-slate-900">Các ngày nghỉ phép trong năm hợp đồng</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedStaffContractLeaveDays.map((date) => (
                    <span key={date} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {date}
                      <button type="button" onClick={() => void deleteLeaveDate(date)} className="text-red-600">×</button>
                    </span>
                  ))}
                  {selectedStaffContractLeaveDays.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có ngày nghỉ phép trong năm hợp đồng.</p> : null}
                </div>
              </div>

              {isPartTimeStaff(selectedStaff) && !selectedStaffCurrentMonthPaid ? (
                <div className="rounded-2xl border p-4">
                  <p className="font-semibold text-slate-900">Điểm danh giờ vào/ra (part-time)</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tổng giờ tháng hiện tại: {selectedStaffCurrentMonthHours.toFixed(2)} giờ</p>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Ngày làm</Label>
                      <Input type="date" value={timeEntryForm.workDate} onChange={(event) => setTimeEntryForm((current) => ({ ...current, workDate: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Ghi chú</Label>
                      <Input value={timeEntryForm.note} onChange={(event) => setTimeEntryForm((current) => ({ ...current, note: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Giờ vào</Label>
                      <Input type="time" value={timeEntryForm.clockInTime} onChange={(event) => setTimeEntryForm((current) => ({ ...current, clockInTime: event.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Giờ ra</Label>
                      <Input type="time" value={timeEntryForm.clockOutTime} onChange={(event) => setTimeEntryForm((current) => ({ ...current, clockOutTime: event.target.value }))} />
                    </div>
                  </div>

                  <Button type="button" className="mt-3 w-full" onClick={() => void addTimeEntry()}>Lưu chấm công</Button>

                  <div className="mt-3 space-y-2">
                    {(selectedStaff.timeEntries ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-lg border bg-slate-50 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>{entry.workDate}: {new Date(entry.clockIn).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                          <button type="button" className="text-red-600" onClick={() => void deleteTimeEntry(entry.id)}>xóa</button>
                        </div>
                        {entry.note ? <p className="mt-1 text-muted-foreground">{entry.note}</p> : null}
                      </div>
                    ))}
                    {(selectedStaff.timeEntries ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Chưa có bản ghi chấm công giờ.</p> : null}
                  </div>
                </div>
              ) : null}

              {isPartTimeStaff(selectedStaff) && selectedStaffCurrentMonthPaid ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Đã chốt lương part-time tháng hiện tại. Chấm công sẽ tự mở lại ở chu kỳ tháng mới.
                </div>
              ) : null}
            </div>
          </aside>
        </>,
        document.body
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {Object.entries(permissions).map(([roleName, items]) => (
          <Card key={roleName} className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-kumon-600" />{roleName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm">
                  <ShieldCheck className="h-4 w-4 text-kumon-600" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
