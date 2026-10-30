"use client";

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { PlusCircle, Receipt, Trash2, Upload, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatNumberWithDots, parseNumberFromInput } from '@/lib/utils';
import type { FinanceType } from '@/types';

type ApiFinanceItem = {
  id: number;
  centerId: number;
  type: FinanceType;
  amount: number;
  spentAt: string;
  proofImage: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiFinancePayload = ApiFinanceItem[];

type ApiStaffItem = {
  id: number;
  fullName: string;
  employmentType: 'Full-time' | 'Part-time';
  salary: number;
  hourlyRate: number | null;
  joinDate: string | null;
  contractEndDate: string | null;
  leaveDate: string | null;
  leaveDays?: string[];
  timeEntries?: Array<{
    id: number;
    workDate: string;
    clockIn: string;
    clockOut: string | null;
  }>;
  active: boolean;
};

const expenseTypes: FinanceType[] = ['Lương', 'Thuê mặt bằng', 'Văn phòng phẩm', 'Marketing', 'Điện nước', 'Khấu hao', 'Khác'];

const emptyForm = {
  type: 'Lương' as FinanceType,
  amount: '',
  spentAt: new Date().toISOString().slice(0, 10),
  note: '',
  proofImage: '',
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

function getContractPeriodLeaveDays(staff: ApiStaffItem) {
  return (staff.leaveDays ?? []).filter((date) => isDateInRange(date, staff.joinDate, staff.contractEndDate));
}

function isPartTimeStaff(staff: ApiStaffItem) {
  return staff.employmentType === 'Part-time' || (staff.hourlyRate ?? 0) > 0;
}

function computeSalaryPayment(staff: ApiStaffItem) {
  if (isPartTimeStaff(staff)) {
    return {
      leaveDaysInContract: 0,
      deductedDays: 0,
      deductionAmount: 0,
      finalSalary: 0,
    };
  }

  const leaveDaysInContract = getContractPeriodLeaveDays(staff).length;
  const deductedDays = Math.max(leaveDaysInContract - 12, 0);
  const deductionAmount = Math.round((staff.salary / 26) * deductedDays);
  const finalSalary = Math.max(staff.salary - deductionAmount, 0);

  return {
    leaveDaysInContract,
    deductedDays,
    deductionAmount,
    finalSalary,
  };
}

function extractDisplayNote(note: string | null) {
  if (!note) return '';
  if (!note.startsWith('[SALARY]')) return note;

  const separatorIndex = note.indexOf(' | ');
  if (separatorIndex < 0) return '';
  return note.slice(separatorIndex + 3).trim();
}

function getPreviousMonthKey(baseDate: Date) {
  const previousMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
  return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
}

function formatSalaryMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `${Number(month)}/${year}`;
}

function getSalaryAmountForMonth(staff: ApiStaffItem, monthKey: string) {
  if (isPartTimeStaff(staff)) {
    const monthlyHours = (staff.timeEntries ?? [])
      .filter((entry) => entry.workDate.startsWith(monthKey) && entry.clockOut)
      .reduce((sum, entry) => {
        const inTime = new Date(entry.clockIn).getTime();
        const outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : inTime;
        return sum + Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
      }, 0);

    return Math.round(monthlyHours * (staff.hourlyRate ?? 0));
  }

  return computeSalaryPayment(staff).finalSalary;
}

function getSalaryDefaultNote(staffName: string, monthKey: string) {
  return `Tiền lương của ${staffName} tháng ${formatSalaryMonthLabel(monthKey)}`;
}

function extractSalaryPayMonth(note: string | null) {
  const match = /payMonth=(\d{4}-\d{2})/.exec(note ?? '');
  return match?.[1] ?? '';
}

function isRevenueItem(item: Pick<ApiFinanceItem, 'note'>) {
  const note = item.note ?? '';
  return note.startsWith('[TUITION]') || note.startsWith('[ADMISSION_FEE]');
}

function getFinanceItemMonthKey(item: Pick<ApiFinanceItem, 'spentAt' | 'note'>) {
  const note = item.note ?? '';
  if (note.startsWith('[TUITION]')) {
    const match = /month=(\d{4})-(\d{1,2})/.exec(note);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}`;
    }
  }
  const d = new Date(item.spentAt);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return item.spentAt.slice(0, 7);
}

let cachedFinancePayload: ApiFinancePayload | null = null;
let cachedStaffPayload: ApiStaffItem[] | null = null;

export default function FinancePage() {
  const today = useMemo(() => new Date(), []);
  const defaultSalaryMonth = useMemo(() => getPreviousMonthKey(today), [today]);
  const [items, setItems] = useState<ApiFinancePayload>(() => cachedFinancePayload ?? []);
  const [staffItems, setStaffItems] = useState<ApiStaffItem[]>(() => cachedStaffPayload ?? []);
  const [loading, setLoading] = useState(() => cachedFinancePayload === null);
  const [error, setError] = useState('');
  const [type, setType] = useState<FinanceType>('Lương');
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(defaultSalaryMonth);
  const [salaryNoteTouched, setSalaryNoteTouched] = useState(false);
  const [salaryAmountTouched, setSalaryAmountTouched] = useState(false);
  const [proofName, setProofName] = useState('');
  const [salaryStaffId, setSalaryStaffId] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formSalaryStaffId, setFormSalaryStaffId] = useState('');
  const [formSalaryMonth, setFormSalaryMonth] = useState(defaultSalaryMonth);
  const [formSalaryNoteTouched, setFormSalaryNoteTouched] = useState(false);
  const [formSalaryAmountTouched, setFormSalaryAmountTouched] = useState(false);
  const [expenseFilterPeriod, setExpenseFilterPeriod] = useState(today.toISOString().slice(0, 7));

  const loadStaffItems = async () => {
    const staffRes = await fetch('/api/he-thong/staff', { cache: 'no-store' });
    if (!staffRes.ok) return;
    const nextStaff = (await staffRes.json()) as ApiStaffItem[];
    cachedStaffPayload = nextStaff;
    setStaffItems(nextStaff);
  };

  useEffect(() => {
    const loadItems = async () => {
      try {
        const [financeRes, staffRes] = await Promise.all([
          fetch('/api/tai-chinh', { cache: 'no-store' }),
          fetch('/api/he-thong/staff', { cache: 'no-store' }),
        ]);

        if (!financeRes.ok) {
          throw new Error('Không thể tải dữ liệu tài chính');
        }
        const nextFinance = (await financeRes.json()) as ApiFinancePayload;
        cachedFinancePayload = nextFinance;
        setItems(nextFinance);

        if (staffRes.ok) {
          const nextStaff = (await staffRes.json()) as ApiStaffItem[];
          cachedStaffPayload = nextStaff;
          setStaffItems(nextStaff);
        }
      } catch (loadError) {
        if (!cachedFinancePayload) {
          setError(loadError instanceof Error ? loadError.message : 'Có lỗi xảy ra');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadItems();
  }, []);

  useEffect(() => {
    if (!editingId || form.type !== 'Lương') return;
    void loadStaffItems();
  }, [editingId, form.type]);

  useEffect(() => {
    if (type !== 'Lương') {
      return;
    }

    const selectedStaff = staffItems.find((candidate) => String(candidate.id) === salaryStaffId);
    if (selectedStaff) {
      if (!salaryAmountTouched) {
        setAmount(formatNumberWithDots(getSalaryAmountForMonth(selectedStaff, salaryMonth)));
      }

      if (!salaryNoteTouched || !note.trim()) {
        setNote(getSalaryDefaultNote(selectedStaff.fullName, salaryMonth));
      }
    }
  }, [note, salaryAmountTouched, salaryMonth, salaryNoteTouched, salaryStaffId, staffItems, type]);

  const currentMonthKey = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    [today]
  );

  const currentMonthItems = useMemo(
    () => items.filter((item) => getFinanceItemMonthKey(item) === currentMonthKey),
    [currentMonthKey, items]
  );

  const currentMonthExpenseItems = useMemo(() => currentMonthItems.filter((item) => !isRevenueItem(item)), [currentMonthItems]);

  const filteredExpenseItems = useMemo(() => {
    return items.filter((item) => {
      if (isRevenueItem(item)) {
        return false;
      }

      return getFinanceItemMonthKey(item) === expenseFilterPeriod;
    });
  }, [expenseFilterPeriod, items]);

  const summary = useMemo(() => {
    const totalExpense = currentMonthExpenseItems.reduce((sum, item) => sum + item.amount, 0);
    const totalRevenue = currentMonthItems.filter((item) => isRevenueItem(item)).reduce((sum, item) => sum + item.amount, 0);
    const balance = totalRevenue - totalExpense;
    const topCategory = currentMonthExpenseItems.length === 0
      ? 'Không có'
      : expenseTypes.reduce((best, current) => {
      const bestAmount = currentMonthExpenseItems.filter((item) => item.type === best).reduce((sum, item) => sum + item.amount, 0);
      const currentAmount = currentMonthExpenseItems.filter((item) => item.type === current).reduce((sum, item) => sum + item.amount, 0);
      return currentAmount > bestAmount ? current : best;
      }, expenseTypes[0]);

    return { totalExpense, totalRevenue, balance, topCategory };
  }, [currentMonthExpenseItems, currentMonthItems]);

  const contractStaffItems = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const toDateKey = (value: string | null) => value?.slice(0, 10) ?? null;

    return staffItems.filter((staff) => {
      if (!staff.active) return false;
      const joinDateKey = toDateKey(staff.joinDate);
      const contractEndDateKey = toDateKey(staff.contractEndDate);
      if (joinDateKey && joinDateKey > todayKey) return false;
      if (contractEndDateKey && contractEndDateKey < todayKey) return false;
      return true;
    });
  }, [staffItems]);

  const chartData = useMemo(() => {
    const monthMap = new Map<string, { month: string; revenue: number; expense: number }>();

    items.forEach((item) => {
      const monthKey = getFinanceItemMonthKey(item);
      const [yearText, monthText] = monthKey.split('-');
      const monthLabel = `T${Number(monthText)}/${yearText}`;
      const current = monthMap.get(monthKey) ?? { month: monthLabel, revenue: 0, expense: 0 };

      if (isRevenueItem(item)) {
        current.revenue += item.amount;
      } else {
        current.expense += item.amount;
      }

      monthMap.set(monthKey, current);
    });

    return Array.from(monthMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [items]);

  const salaryPreview = useMemo(() => {
    const selectedStaffId = editingId ? formSalaryStaffId : salaryStaffId;
    if ((editingId ? form.type : type) !== 'Lương' || !selectedStaffId) {
      return null;
    }

    const staff = contractStaffItems.find((candidate) => String(candidate.id) === selectedStaffId) ?? null;
    if (!staff) {
      return null;
    }

    const selectedMonthPrefix = editingId ? formSalaryMonth : salaryMonth;

    if (isPartTimeStaff(staff)) {
      const monthlyHours = (staff.timeEntries ?? [])
        .filter((entry) => entry.workDate.startsWith(selectedMonthPrefix) && entry.clockOut)
        .reduce((sum, entry) => {
          const inTime = new Date(entry.clockIn).getTime();
          const outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : inTime;
          return sum + Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
        }, 0);

      const hourlyRate = staff.hourlyRate ?? 0;
      const finalSalary = Math.round(monthlyHours * hourlyRate);
      return {
        staff,
        leaveDaysInContract: 0,
        deductedDays: 0,
        deductionAmount: 0,
        finalSalary,
        monthlyHours,
        hourlyRate,
      };
    }

    return {
      staff,
      ...computeSalaryPayment(staff),
      monthlyHours: 0,
      hourlyRate: 0,
    };
  }, [contractStaffItems, editingId, form.type, formSalaryMonth, formSalaryStaffId, salaryMonth, salaryStaffId, type]);

  async function refreshItems() {
    const response = await fetch('/api/tai-chinh', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu tài chính');
    }
    setItems((await response.json()) as ApiFinancePayload);
  }

  function startEdit(item: ApiFinanceItem) {
    const salaryStaffMatch = /\[SALARY\]\s*staffId=(\d+)/.exec(item.note ?? '');
    const matchedStaffId = salaryStaffMatch?.[1] ?? '';
    const displayNote = extractDisplayNote(item.note);
    const matchedSalaryMonth = extractSalaryPayMonth(item.note);
    const fallbackSalaryMonth = getPreviousMonthKey(new Date(item.spentAt));
    const resolvedSalaryMonth = matchedSalaryMonth || fallbackSalaryMonth;
    const resolvedDisplayNote = displayNote || getSalaryDefaultNote(staffItems.find((candidate) => String(candidate.id) === matchedStaffId)?.fullName ?? 'nhân viên', resolvedSalaryMonth);

    setEditingId(item.id);
    setForm({
      type: item.type,
      amount: formatNumberWithDots(item.amount),
      spentAt: item.spentAt.slice(0, 10),
      note: resolvedDisplayNote,
      proofImage: item.proofImage ?? '',
    });
    setType(item.type);
    setAmount(formatNumberWithDots(item.amount));
    setSpentAt(item.spentAt.slice(0, 10));
    setNote(resolvedDisplayNote);
    setProofName(item.proofImage ?? '');
    setFormSalaryStaffId(matchedStaffId);
    setFormSalaryMonth(resolvedSalaryMonth);
    setFormSalaryNoteTouched(displayNote !== getSalaryDefaultNote(staffItems.find((candidate) => String(candidate.id) === matchedStaffId)?.fullName ?? 'nhân viên', resolvedSalaryMonth));

    if (item.type === 'Lương' && matchedStaffId) {
      const staff = staffItems.find((candidate) => String(candidate.id) === matchedStaffId);
      if (staff) {
        const salaryPayment = computeSalaryPayment(staff);
        setForm((current) => ({ ...current, amount: formatNumberWithDots(salaryPayment.finalSalary) }));
      }
    }
  }

  async function submitFinance() {
    try {
      const isEditing = Boolean(editingId);
      const selectedType = isEditing ? form.type : type;
      const selectedSalaryStaffId = isEditing ? formSalaryStaffId : salaryStaffId;

      if (selectedType === 'Lương' && !selectedSalaryStaffId) {
        throw new Error('Vui lòng chọn nhân viên còn hợp đồng.');
      }

      const selectedStaff = selectedSalaryStaffId
        ? contractStaffItems.find((staff) => String(staff.id) === selectedSalaryStaffId) ?? null
        : null;

      const selectedSalaryMonth = isEditing ? formSalaryMonth : salaryMonth;
      const selectedSalaryStaff = selectedSalaryStaffId
        ? contractStaffItems.find((staff) => String(staff.id) === selectedSalaryStaffId) ?? null
        : null;

      const salaryPayment = selectedType === 'Lương' && selectedStaff
        ? computeSalaryPayment(selectedStaff)
        : null;

      const monthlyHours = selectedType === 'Lương' && selectedStaff && isPartTimeStaff(selectedStaff)
        ? (selectedStaff.timeEntries ?? [])
          .filter((entry) => entry.workDate.startsWith(selectedSalaryMonth) && entry.clockOut)
          .reduce((sum, entry) => {
            const inTime = new Date(entry.clockIn).getTime();
            const outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : inTime;
            return sum + Math.max((outTime - inTime) / (1000 * 60 * 60), 0);
          }, 0)
        : 0;
      const partTimeAmount = selectedType === 'Lương' && selectedStaff && isPartTimeStaff(selectedStaff)
        ? Math.round(monthlyHours * (selectedStaff.hourlyRate ?? 0))
        : null;

      const rawNote = isEditing ? form.note : note;
      const cleanNote = rawNote.replace(/\[SALARY\][^\n]*/g, '').trim();
      const noteBody = cleanNote || (selectedSalaryStaff ? getSalaryDefaultNote(selectedSalaryStaff.fullName, selectedSalaryMonth) : '');
      const salaryPrefix = selectedType === 'Lương' && selectedStaff
        ? `[SALARY] staffId=${selectedStaff.id};staffName=${selectedStaff.fullName};employmentType=${isPartTimeStaff(selectedStaff) ? 'Part-time' : 'Full-time'};payMonth=${selectedSalaryMonth};leaveDays=${salaryPayment?.leaveDaysInContract ?? 0};deductedDays=${salaryPayment?.deductedDays ?? 0};baseSalary=${selectedStaff.salary};deduction=${salaryPayment?.deductionAmount ?? 0};hourlyRate=${selectedStaff.hourlyRate ?? 0};hours=${monthlyHours.toFixed(2)}`
        : '';

      const normalizedNote = [salaryPrefix, noteBody].filter((part) => part.length > 0).join(' | ');

      const payload = {
        type: selectedType,
        amount: selectedType === 'Lương' && selectedStaff
          ? (isPartTimeStaff(selectedStaff) ? (partTimeAmount ?? 0) : (salaryPayment?.finalSalary ?? selectedStaff.salary))
          : parseNumberFromInput(isEditing ? form.amount : amount),
        spentAt: isEditing ? form.spentAt : spentAt,
        note: normalizedNote,
        proofImage: isEditing ? form.proofImage : (proofName ? `/mock/${proofName}` : null),
      };

      const response = await fetch(editingId ? `/api/tai-chinh/${editingId}` : '/api/tai-chinh', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Không thể lưu khoản chi');
      }

      setEditingId(null);
      setForm(emptyForm);
      setType('Lương');
      setAmount('');
      setSpentAt(new Date().toISOString().slice(0, 10));
      setNote('');
      setSalaryAmountTouched(false);
      setSalaryMonth(defaultSalaryMonth);
      setSalaryNoteTouched(false);
      setProofName('');
      setSalaryStaffId('');
      setFormSalaryStaffId('');
      setFormSalaryAmountTouched(false);
      setFormSalaryMonth(defaultSalaryMonth);
      setFormSalaryNoteTouched(false);
      await refreshItems();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể lưu khoản chi');
    }
  }

  async function deleteFinance(id: number) {
    const response = await fetch(`/api/tai-chinh/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Không thể xóa khoản chi');
    }
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
    await refreshItems();
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Đang tải dữ liệu tài chính...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng thu tháng" value={formatCurrency(summary.totalRevenue)} tone="emerald" />
        <MetricCard label="Tổng chi tháng" value={formatCurrency(summary.totalExpense)} tone="amber" />
        <MetricCard label="Cân đối tháng" value={formatCurrency(summary.balance)} tone="cyan" />
        <MetricCard label="Loại chi lớn nhất tháng" value={summary.topCategory} tone="slate" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Biểu đồ thu chi</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px] pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="revenue" stroke="#2ca39d" strokeWidth={3} dot={false} name="Tổng thu" />
                <Line type="monotone" dataKey="expense" stroke="#334155" strokeWidth={3} dot={false} name="Tổng chi" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{editingId ? 'Cập nhật khoản chi' : 'Chi tiền'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Loại chi</Label>
              <Select value={editingId ? form.type : type} onValueChange={(value) => {
                const nextType = value as FinanceType;
                if (editingId) {
                  setForm((current) => ({ ...current, type: nextType }));
                  if (nextType === 'Lương') {
                    setFormSalaryMonth(defaultSalaryMonth);
                    setFormSalaryNoteTouched(false);
                    setFormSalaryAmountTouched(false);
                    const staff = contractStaffItems.find((candidate) => String(candidate.id) === formSalaryStaffId);
                    if (staff) {
                      setForm((current) => ({
                        ...current,
                        amount: formatNumberWithDots(getSalaryAmountForMonth(staff, defaultSalaryMonth)),
                        note: getSalaryDefaultNote(staff.fullName, defaultSalaryMonth),
                      }));
                    }
                  }
                  return;
                }

                setType(nextType);
                if (nextType === 'Lương') {
                  setSalaryMonth(defaultSalaryMonth);
                  setSalaryNoteTouched(false);
                  setSalaryAmountTouched(false);
                  const staff = contractStaffItems.find((candidate) => String(candidate.id) === salaryStaffId);
                  if (staff) {
                    setAmount(formatNumberWithDots(getSalaryAmountForMonth(staff, defaultSalaryMonth)));
                    setNote(getSalaryDefaultNote(staff.fullName, defaultSalaryMonth));
                  }
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{expenseTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(editingId ? form.type : type) === 'Lương' ? (
              <div className="space-y-2">
                <Label>Tháng lương</Label>
                <Input
                  type="month"
                  value={editingId ? formSalaryMonth : salaryMonth}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (editingId) {
                      setFormSalaryMonth(nextValue);
                      const staff = contractStaffItems.find((candidate) => String(candidate.id) === formSalaryStaffId);
                      if (staff) {
                        setFormSalaryAmountTouched(false);
                        setFormSalaryNoteTouched(false);
                        setForm((current) => ({
                          ...current,
                          amount: formatNumberWithDots(getSalaryAmountForMonth(staff, nextValue)),
                          note: getSalaryDefaultNote(staff.fullName, nextValue),
                        }));
                      }
                      return;
                    }

                    setSalaryMonth(nextValue);
                    const staff = contractStaffItems.find((candidate) => String(candidate.id) === salaryStaffId);
                    if (staff) {
                      setSalaryAmountTouched(false);
                      setSalaryNoteTouched(false);
                      setAmount(formatNumberWithDots(getSalaryAmountForMonth(staff, nextValue)));
                      setNote(getSalaryDefaultNote(staff.fullName, nextValue));
                    }
                  }}
                />
              </div>
            ) : null}
            {(editingId ? form.type : type) === 'Lương' ? (
              <div className="space-y-2">
                <Label>Nhân viên (còn hợp đồng)</Label>
                <Select
                  value={editingId ? formSalaryStaffId : salaryStaffId}
                  onValueChange={(value) => {
                    const staff = contractStaffItems.find((candidate) => String(candidate.id) === value);
                    if (editingId) {
                      setFormSalaryStaffId(value);
                      if (staff) {
                        setFormSalaryAmountTouched(false);
                        setFormSalaryNoteTouched(false);
                        setForm((current) => ({
                          ...current,
                          amount: formatNumberWithDots(getSalaryAmountForMonth(staff, formSalaryMonth)),
                          note: getSalaryDefaultNote(staff.fullName, formSalaryMonth),
                        }));
                      }
                      return;
                    }
                    setSalaryStaffId(value);
                    if (staff) {
                      setSalaryAmountTouched(false);
                      setSalaryNoteTouched(false);
                      setAmount(formatNumberWithDots(getSalaryAmountForMonth(staff, salaryMonth)));
                      setNote(getSalaryDefaultNote(staff.fullName, salaryMonth));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                  <SelectContent>
                    {contractStaffItems.map((staff) => (
                      <SelectItem key={staff.id} value={String(staff.id)}>
                        {staff.fullName} - {isPartTimeStaff(staff) ? `Part-time (${formatCurrency(staff.hourlyRate ?? 0)}/giờ)` : `Full-time (${formatCurrency(staff.salary)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {salaryPreview ? (
              <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-700">
                {isPartTimeStaff(salaryPreview.staff) ? (
                  <>
                    <p>Loại: Part-time</p>
                    <p>Lương theo giờ: {formatCurrency(salaryPreview.hourlyRate)}/giờ</p>
                    <p>Tổng giờ tháng: {salaryPreview.monthlyHours.toFixed(2)} giờ</p>
                  </>
                ) : (
                  <>
                    <p>Lương gốc: {formatCurrency(salaryPreview.staff.salary)}</p>
                    <p>Ngày nghỉ trong năm hợp đồng: {salaryPreview.leaveDaysInContract} ngày</p>
                    <p>Số ngày bị trừ (từ ngày 13): {salaryPreview.deductedDays} ngày</p>
                    <p>Số tiền khấu trừ: {formatCurrency(salaryPreview.deductionAmount)}</p>
                  </>
                )}
                <p className="mt-1 font-semibold">Thực nhận: {formatCurrency(salaryPreview.finalSalary)}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Số tiền</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={editingId ? form.amount : amount}
                onChange={(event) => {
                  const formatted = formatNumberWithDots(event.target.value);
                  if (editingId) {
                    setFormSalaryAmountTouched(true);
                    setForm((current) => ({ ...current, amount: formatted }));
                    return;
                  }
                  setSalaryAmountTouched(true);
                  setAmount(formatted);
                }}
                placeholder="Nhập số tiền..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ngày chi</Label>
              <Input type="date" value={editingId ? form.spentAt : spentAt} onChange={(event) => editingId ? setForm((current) => ({ ...current, spentAt: event.target.value })) : setSpentAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Minh chứng</Label>
              <div className="flex items-center gap-2">
                <Input value={editingId ? form.proofImage : proofName} onChange={(event) => editingId ? setForm((current) => ({ ...current, proofImage: event.target.value })) : setProofName(event.target.value)} placeholder="Tên file ảnh minh chứng" />
                <Button type="button" variant="outline"><Upload className="mr-2 h-4 w-4" />Upload</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Input
                value={editingId ? form.note : note}
                onChange={(event) => {
                  if (editingId) {
                    setFormSalaryNoteTouched(true);
                    setForm((current) => ({ ...current, note: event.target.value }));
                    return;
                  }

                  setSalaryNoteTouched(true);
                  setNote(event.target.value);
                }}
                placeholder="Ghi chú ngắn..."
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void submitFinance()}><PlusCircle className="mr-2 h-4 w-4" />{editingId ? 'Cập nhật' : 'Thêm khoản chi'}</Button>
              {editingId ? <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Hủy</Button> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Danh sách chi tiền</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <div className="space-y-2">
              <Label>Tháng/Năm</Label>
              <Input type="month" value={expenseFilterPeriod} onChange={(event) => setExpenseFilterPeriod(event.target.value)} />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại chi</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Ngày chi</TableHead>
                <TableHead>Minh chứng</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenseItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
                  <TableCell className="font-medium">{formatCurrency(item.amount)}</TableCell>
                  <TableCell>{formatDate(item.spentAt)}</TableCell>
                  <TableCell>{item.proofImage ? item.proofImage : '-'}</TableCell>
                  <TableCell>{extractDisplayNote(item.note) || '-'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(item)}><Edit3 className="mr-2 h-4 w-4" />Sửa</Button>
                      <Button size="sm" variant="destructive" onClick={() => void deleteFinance(item.id)}><Trash2 className="mr-2 h-4 w-4" />Xóa</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredExpenseItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Không có khoản chi trong tháng/năm đã chọn.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
