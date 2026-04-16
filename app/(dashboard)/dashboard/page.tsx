"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BadgeDollarSign, BookOpenText, GraduationCap, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

type DashboardPayload = {
  monthlyStats: Array<{
    month: string;
    activeStudents: number;
    trialStudents: number;
    droppedStudents: number;
    totalLessons: number;
    revenue: number;
    expense: number;
  }>;
  stats: {
    activeStudents: number;
    trialStudents: number;
    leads: number;
    monthlyRevenue: number;
    conversionRate: number;
    activeStaffCount: number;
    monthlyLessons: number;
  };
  certificates: Array<{ id: number; studentName: string; subjectCode: 'MATH' | 'EFL'; size: 'small' | 'large'; level: string | null }>;
  recentRevenue: Array<{ id: number; amount: number; spentAt: string; note: string | null }>;
  finance: Array<{ id: number; type: string; amount: number; spentAt: string }>;
  compareStats: Array<{
    month: string;
    activeStudents: number;
    trialStudents: number;
    droppedStudents: number;
    mathStudents: number;
    eflStudents: number;
    revenue: number;
    expense: number;
  }>;
  compareMeta: {
    mode: 'months-in-year' | 'years-by-month';
    selectedYear: number;
    selectedMonth: number;
    availableYears: number[];
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState('');
  const [compareMode, setCompareMode] = useState<'months-in-year' | 'years-by-month'>('months-in-year');
  const [compareYear, setCompareYear] = useState(String(new Date().getFullYear()));
  const [compareMonth, setCompareMonth] = useState(String(new Date().getMonth() + 1));

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const query = new URLSearchParams({
          compareMode,
          year: compareYear,
          month: compareMonth,
        });

        const response = await fetch(`/api/dashboard?${query.toString()}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Không thể tải dashboard');
        }

        setData((await response.json()) as DashboardPayload);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Có lỗi khi tải dashboard');
      }
    };

    void load();
  }, [compareMode, compareMonth, compareYear]);

  const monthlyStats = useMemo(() => data?.monthlyStats ?? [], [data]);
  const compareStats = useMemo(() => data?.compareStats ?? [], [data]);
  const latestStats = data?.stats ?? {
    activeStudents: 0,
    trialStudents: 0,
    leads: 0,
    monthlyRevenue: 0,
    conversionRate: 0,
    activeStaffCount: 0,
    monthlyLessons: 0,
  };

  const revenueGap = useMemo(() => {
    const last = monthlyStats[monthlyStats.length - 1];
    if (!last) return 0;
    return last.revenue - last.expense;
  }, [monthlyStats]);

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Chính thức (lượt môn)" value={String(latestStats.activeStudents)} delta="Đang học" tone="emerald" />
        <MetricCard label="Học thử (lượt môn)" value={String(latestStats.trialStudents)} delta="Cần theo dõi" tone="amber" />
        <MetricCard label="Tư vấn" value={String(latestStats.leads)} delta="CRM theo pipeline" tone="cyan" />
        <MetricCard label="Doanh thu tháng" value={formatCurrency(latestStats.monthlyRevenue)} delta={`Lãi gộp ${formatCurrency(revenueGap)}`} tone="slate" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Dashboard học viên theo tháng</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 px-6 pb-2 md:grid-cols-3">
            <Select value={compareMode} onValueChange={(value) => setCompareMode(value as 'months-in-year' | 'years-by-month')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="months-in-year">So sánh các tháng trong năm</SelectItem>
                <SelectItem value="years-by-month">So sánh các năm theo tháng</SelectItem>
              </SelectContent>
            </Select>
            <Select value={compareYear} onValueChange={setCompareYear}>
              <SelectTrigger><SelectValue placeholder="Năm" /></SelectTrigger>
              <SelectContent>
                {(data?.compareMeta.availableYears ?? [new Date().getFullYear()]).map((year) => (
                  <SelectItem key={year} value={String(year)}>Năm {year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={compareMonth} onValueChange={setCompareMonth}>
              <SelectTrigger><SelectValue placeholder="Tháng" /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>Tháng {idx + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CardContent className="h-[360px] pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => Number(value).toLocaleString('vi-VN')} />
                <Bar dataKey="activeStudents" name="Chính thức" fill="#2ca39d" radius={[8, 8, 0, 0]} />
                <Bar dataKey="trialStudents" name="Học thử" fill="#eab308" radius={[8, 8, 0, 0]} />
                <Bar dataKey="droppedStudents" name="Thôi học" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>So sánh học viên Toán và Tiếng Anh</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...compareStats].reverse()}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fontSize: 12 }}
                    width={35}
                  />

                  <Tooltip />

                  {/* Toán */}
                  <Bar
                    dataKey="mathStudents"
                    stackId="subject"
                    name="Toán"
                    fill="#2e8db7"
                    radius={[0, 0, 0, 0]}
                    barSize={14}
                  />

                  {/* Tiếng Anh */}
                  <Bar
                    dataKey="eflStudents"
                    stackId="subject"
                    name="Tiếng Anh"
                    fill="#f08900"
                    radius={[0, 6, 6, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Tổng thu và tổng chi</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Tăng trưởng doanh thu
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareStats}>
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

        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Doanh thu gần nhất</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentRevenue ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-950">{(item.note || '').startsWith('[ADMISSION_FEE]') ? 'Phí nhập học' : 'Thu học phí'}</p>
                    <p className="text-muted-foreground">{new Date(item.spentAt).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <Badge variant="success">{formatCurrency(item.amount)}</Badge>
                </div>
              ))}
              {(data?.recentRevenue?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có giao dịch học phí gần đây.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Chi phí tháng này</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.finance ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-950">{item.type}</p>
                    <p className="text-muted-foreground">{new Date(item.spentAt).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
