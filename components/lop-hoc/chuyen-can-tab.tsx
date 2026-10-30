"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Printer, Award, CheckCircle, Sparkles, RefreshCw, AlertCircle, Info, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChuyenCanWeek = {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  attendedDaysCount: number;
  days: Array<{
    formattedDate: string;
    rawDate: string;
    details: Array<{ classLabel: string; time: string }>;
  }>;
  pointsEarned: number;
  cumulativePoints: number;
};

export type ChuyenCanCycle = {
  cycleNumber: number;
  label: string;
  isCompleted: boolean;
  points: number;
  weeks: ChuyenCanWeek[];
};

export type ChuyenCanStudent = {
  id: number;
  fullName: string;
  status: string;
  classDisplay: string;
  totalPoints: number;
  completedCards: number;
  currentPoints: number;
  justCompleted10: boolean;
  cycles?: ChuyenCanCycle[];
  currentCycleWeeks?: ChuyenCanWeek[];
  latestCompletedCycleWeeks?: ChuyenCanWeek[];
  weeklyBreakdown: ChuyenCanWeek[];
};

// SVG Stamp: Great Thumbs-up matching the uploaded photo
function StampGreat({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center select-none w-full h-full", className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full text-[#d63031] drop-shadow-sm fill-current opacity-90">
        {/* Outer subtle circle border */}
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 2" opacity="0.6" />

        {/* Great arched text on top */}
        <path id="greatCurve" d="M 22,38 A 34,34 0 0,1 78,38" fill="none" />
        <text fontSize="14" fontWeight="bold" fontFamily="system-ui, sans-serif" fill="currentColor" letterSpacing="1">
          <textPath href="#greatCurve" startOffset="50%" textAnchor="middle">
            Great
          </textPath>
        </text>

        {/* Smiley face with thumbs up hand */}
        <circle cx="50" cy="60" r="22" fill="none" stroke="currentColor" strokeWidth="3" />
        {/* Winking or happy eye */}
        <circle cx="43" cy="55" r="2.5" fill="currentColor" />
        <path d="M53 54 Q57 51 60 55" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Big smile */}
        <path d="M43 65 Q50 73 57 65" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Thumbs up */}
        <path
          d="M 28 64 C 28 59, 32 55, 36 55 L 36 67 C 32 67, 28 67, 28 64 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M 33 55 L 33 50 C 33 47, 36 47, 36 50 L 36 55" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

interface ChuyenCanTabProps {
  initialStudentId?: string | null;
}

let cachedChuyenCanStudents: ChuyenCanStudent[] | null = null;

export function ChuyenCanTab({ initialStudentId }: ChuyenCanTabProps) {
  const [students, setStudents] = useState<ChuyenCanStudent[]>(() => cachedChuyenCanStudents ?? []);
  const [loading, setLoading] = useState(() => cachedChuyenCanStudents === null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Chính thức' | 'Học thử'>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => {
    if (cachedChuyenCanStudents && cachedChuyenCanStudents.length > 0) {
      if (initialStudentId) {
        const match = cachedChuyenCanStudents.find((s) => String(s.id) === initialStudentId);
        if (match) return match.id;
      }
      return cachedChuyenCanStudents[0].id;
    }
    return null;
  });
  const [selectedCycleView, setSelectedCycleView] = useState<'current' | number>('current');
  const cardPrintRef = useRef<HTMLDivElement>(null);

  const fetchChuyenCanData = async () => {
    if (!cachedChuyenCanStudents) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch('/api/lop-hoc/chuyen-can', { cache: 'no-store' });
      if (!res.ok) throw new Error('Không thể tải dữ liệu chuyên cần');
      const data = await res.json();
      const nextStudents: ChuyenCanStudent[] = data.students || [];
      cachedChuyenCanStudents = nextStudents;
      setStudents(nextStudents);

      if (nextStudents.length > 0) {
        if (initialStudentId) {
          const match = nextStudents.find((s: ChuyenCanStudent) => String(s.id) === initialStudentId);
          if (match) {
            setSelectedStudentId(match.id);
            return;
          }
        }
        setSelectedStudentId((prev) => prev ?? nextStudents[0].id);
      }
    } catch (err: any) {
      if (!cachedChuyenCanStudents) {
        setError(err.message || 'Lỗi hệ thống');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChuyenCanData();
  }, []);

  // Filter students: chỉ lấy Chính thức và Học thử, không hiển thị học viên thôi học / nghỉ học
  const filteredStudents = useMemo(() => {
    let list = students.filter(
      (s) => s.status === 'Chính thức' || s.status === 'Học thử' || s.status === 'OFFICIAL' || s.status === 'TRIAL'
    );
    if (statusFilter !== 'ALL') {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) => s.fullName.toLowerCase().includes(query) || s.classDisplay.toLowerCase().includes(query)
      );
    }
    return list;
  }, [students, statusFilter, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || filteredStudents[0] || null;
  }, [students, selectedStudentId, filteredStudents]);

  // Phiếu hoàn thành gần kề nhất (nếu có)
  const latestCompletedCycle = useMemo(() => {
    if (!selectedStudent?.cycles) return null;
    return selectedStudent.cycles.filter((c) => c.isCompleted).pop() ?? null;
  }, [selectedStudent]);

  // Đang xem phiếu gần nhất hay phiếu hiện tại
  const isViewingLatestCompleted = useMemo(() => {
    if (!latestCompletedCycle) return false;
    return selectedCycleView === latestCompletedCycle.cycleNumber;
  }, [latestCompletedCycle, selectedCycleView]);

  const currentCycleNumber = (selectedStudent?.completedCards ?? 0) + 1;

  // Xác định chu kỳ phiếu đang xem
  const activeCycle = useMemo(() => {
    if (!selectedStudent?.cycles || selectedStudent.cycles.length === 0) return null;
    if (isViewingLatestCompleted && latestCompletedCycle) {
      return latestCompletedCycle;
    }
    return selectedStudent.cycles[selectedStudent.cycles.length - 1] ?? null;
  }, [selectedStudent, isViewingLatestCompleted, latestCompletedCycle]);

  // Tuần bắt đầu của phiếu chuyên cần đang xem (chỉ lấy tuần bắt đầu, không lấy tuần kết thúc)
  const cardStartWeekLabel = useMemo(() => {
    if (!activeCycle || !activeCycle.weeks || activeCycle.weeks.length === 0) {
      return 'Chưa có buổi học';
    }
    const firstWeek = activeCycle.weeks[0];
    return firstWeek.startDate || firstWeek.weekLabel.split(' - ')[0].replace(/^Tuần\s+/, '');
  }, [activeCycle]);

  // Số điểm hiển thị trên thẻ chuyên cần theo chu kỳ đang chọn
  const displayPoints = useMemo(() => {
    if (!selectedStudent) return 0;
    if (activeCycle) {
      return activeCycle.points;
    }
    return selectedStudent.currentPoints;
  }, [selectedStudent, activeCycle]);

  // Danh sách các tuần hiển thị theo chu kỳ đang chọn (chỉ phiếu hiện tại hoặc phiếu gần nhất)
  const displayedWeeks = useMemo(() => {
    if (!selectedStudent) return [];
    if (activeCycle) {
      return activeCycle.weeks || [];
    }
    return selectedStudent.currentCycleWeeks || [];
  }, [selectedStudent, activeCycle]);

  // Handle printing
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border bg-white p-8 text-slate-500">
        <RefreshCw className="mr-3 h-5 w-5 animate-spin text-primary" />
        Đang tải dữ liệu điểm chuyên cần...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="font-semibold">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void fetchChuyenCanData()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #chuyen-can-printable-card,
          #chuyen-can-printable-card * {
            visibility: visible;
          }
          #chuyen-can-printable-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
        }
      `}</style>

      {/* Top Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Tổng số học viên</p>
              <p className="text-2xl font-bold text-slate-800">{students.length}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Award className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Học viên đang tích điểm</p>
              <p className="text-2xl font-bold text-emerald-600">
                {students.filter((s) => s.totalPoints > 0).length}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Số phiếu đã hoàn thành</p>
              <p className="text-2xl font-bold text-amber-600">
                {students.reduce((acc, s) => acc + s.completedCards, 0)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <Sparkles className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Vừa đạt mốc 10 điểm</p>
              <p className="text-2xl font-bold text-rose-600">
                {students.filter((s) => s.justCompleted10).length}
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <Award className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Student Selector on Left & Stamp Card on Right */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left Side: Student List & Search */}
        <Card className="glass-card flex flex-col h-[750px]">
          <CardHeader className="p-4 pb-3 border-b space-y-2.5">
            <CardTitle className="text-base font-semibold text-slate-800">Danh sách học viên</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm theo tên học viên..."
                className="pl-9 h-9 text-sm bg-slate-50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Quick Status Filter: Chỉ hiển thị Chính thức và Học thử */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {(['ALL', 'Chính thức', 'Học thử'] as const).map((filter) => {
                const count = filter === 'ALL'
                  ? students.filter((s) => s.status === 'Chính thức' || s.status === 'Học thử' || s.status === 'OFFICIAL' || s.status === 'TRIAL').length
                  : students.filter((s) => s.status === filter).length;
                const isCurrent = statusFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border",
                      isCurrent
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {filter === 'ALL' ? 'Tất cả' : filter} ({count})
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1.5">
            {filteredStudents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">Không tìm thấy học viên</div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = selectedStudent?.id === s.id;
                const isTrial = s.status === 'Học thử' || s.status === 'TRIAL';
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setSelectedCycleView('current');
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group",
                      isSelected
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/80"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className={cn("text-sm font-semibold truncate", isSelected ? "text-primary" : "text-slate-800")}>
                          {s.fullName}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0",
                            isTrial ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                          )}
                        >
                          {isTrial ? 'Học thử' : 'Chính thức'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{s.classDisplay}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                          ⭐ {s.currentPoints}/10
                        </span>
                      </div>
                      {s.completedCards > 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium block mt-1">
                          🏆 {s.completedCards} phiếu
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Side: Thẻ Chuyên Cần & Details */}
        <div className="space-y-6">
          {selectedStudent ? (
            <>
              {/* Alert Notification if Completed 10 Points */}
              {selectedStudent.justCompleted10 || (selectedStudent.completedCards > 0 && selectedStudent.currentPoints === 0) ? (
                <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-pink-50 p-4 shadow-sm flex items-start gap-3">
                  <div className="rounded-full bg-rose-500 p-2 text-white shrink-0 mt-0.5 animate-bounce">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                      🎉 Chúc mừng học viên {selectedStudent.fullName}!
                      <Badge className="bg-rose-600 hover:bg-rose-600 text-white text-[11px]">
                        Đã tích đủ 10 điểm
                      </Badge>
                    </h4>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      Học viên đã hoàn thành xuất sắc 10 điểm chuyên cần! Phiếu chuyên cần đã được hoàn tất và hệ thống đã tự động reset chu kỳ tích điểm mới.
                      <span className="font-semibold block mt-0.5">
                        Tổng số phiếu đã hoàn thành: {selectedStudent.completedCards} phiếu ({selectedStudent.totalPoints} điểm tích lũy toàn bộ).
                      </span>
                    </p>
                    {latestCompletedCycle && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isViewingLatestCompleted ? "default" : "outline"}
                          className={cn(
                            "text-xs h-7",
                            isViewingLatestCompleted
                              ? "bg-rose-600 text-white hover:bg-rose-700"
                              : "border-rose-300 text-rose-700 hover:bg-rose-100/50"
                          )}
                          onClick={() => {
                            if (isViewingLatestCompleted) {
                              setSelectedCycleView('current');
                            } else {
                              setSelectedCycleView(latestCompletedCycle.cycleNumber);
                            }
                          }}
                        >
                          {isViewingLatestCompleted ? "Về phiếu hiện tại" : "Xem phiếu gần nhất"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedStudent.completedCards > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-900">
                        Học viên đã hoàn thành {selectedStudent.completedCards} phiếu chuyên cần trước đó (mỗi phiếu 10 điểm).
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Hiện đang tích lũy phiếu chu kỳ mới (Phiếu {selectedStudent.completedCards + 1}): {selectedStudent.currentPoints}/10 điểm.
                      </p>
                    </div>
                  </div>
                  {latestCompletedCycle && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shrink-0 ml-3"
                      onClick={() => {
                        if (isViewingLatestCompleted) {
                          setSelectedCycleView('current');
                        } else {
                          setSelectedCycleView(latestCompletedCycle.cycleNumber);
                        }
                      }}
                    >
                      {isViewingLatestCompleted ? "Về phiếu hiện tại" : "Xem phiếu gần nhất"}
                    </Button>
                  )}
                </div>
              ) : null}

              {/* Action Bar */}
              <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium border-slate-300 text-slate-700">
                    {isViewingLatestCompleted && latestCompletedCycle
                      ? `Đang xem: Phiếu ${latestCompletedCycle.cycleNumber} (Gần nhất: 10/10)`
                      : `Đang xem: Phiếu ${currentCycleNumber} (Hiện tại: ${displayPoints}/10)`}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Tổng điểm tích lũy: <strong className="text-slate-800">{selectedStudent.totalPoints}</strong> điểm
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs text-slate-700"
                    onClick={handlePrint}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    In phiếu chuyên cần
                  </Button>
                </div>
              </div>

              {/* THE CHUYEN CAN CARD - Matching the User's Image */}
              <div className="flex justify-center">
                <div
                  id="chuyen-can-printable-card"
                  ref={cardPrintRef}
                  className="w-full max-w-[580px] bg-white rounded-3xl border-2 border-slate-300/80 p-8 shadow-md relative overflow-hidden transition-all duration-300"
                  style={{
                    backgroundColor: '#faf9f6', // Natural cardstock paper tone
                    backgroundImage: 'radial-gradient(#e5e7eb 0.75px, transparent 0.75px)',
                    backgroundSize: '16px 16px',
                  }}
                >
                  {/* Top-Left Arc Badge "THẺ CHUYÊN CẦN" */}
                  <div className="absolute top-0 left-0">
                    <div className="w-36 h-28 bg-[#8c94a4] text-white rounded-br-[75px] pl-5 pt-5 shadow-sm flex flex-col justify-start">
                      <span className="text-xl font-black tracking-wider uppercase leading-none drop-shadow-sm">
                        THẺ
                      </span>
                      <span className="text-xs font-bold tracking-widest uppercase mt-1 drop-shadow-sm">
                        CHUYÊN CẦN
                      </span>
                    </div>
                  </div>

                  {/* Header: Student Name & Tuần bắt đầu */}
                  <div className="ml-36 pt-2 pb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-800 shrink-0">
                        Họ tên HS:
                      </span>
                      <div className="flex-1 border-b-2 border-dotted border-slate-400 pb-0.5">
                        <span className="text-sm font-bold text-slate-900 tracking-wide">
                          {selectedStudent.fullName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-sm font-semibold text-slate-800 shrink-0">
                        Tuần bắt đầu:
                      </span>
                      <div className="flex-1 border-b-2 border-dotted border-slate-400 pb-0.5">
                        <span className="text-sm font-semibold text-slate-800 tracking-wide">
                          {cardStartWeekLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 10 STAMP SLOTS IN 3 ROWS (matching the physical card):
                      Row 1: 4 circles
                      Row 2: 3 circles (centered)
                      Row 3: 3 circles (centered)
                  */}
                  <div className="py-6 space-y-6">
                    {/* Row 1: 4 Circles (Slots 1, 2, 3, 4) */}
                    <div className="grid grid-cols-4 gap-4 px-2">
                      {[1, 2, 3, 4].map((slotNumber) => {
                        const isStamped = slotNumber <= displayPoints;
                        return (
                          <div
                            key={slotNumber}
                            className="aspect-square flex items-center justify-center relative rounded-full border-2 border-slate-700/80 bg-white shadow-inner transition-transform"
                          >
                            {isStamped ? (
                              <div className="w-[85%] h-[85%] flex items-center justify-center animate-in zoom-in-50 duration-200">
                                <StampGreat />
                              </div>
                            ) : (
                              <span className="text-xs font-serif text-slate-300 select-none">
                                {slotNumber}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Row 2: 3 Circles (Slots 5, 6, 7) */}
                    <div className="grid grid-cols-3 gap-6 px-10">
                      {[5, 6, 7].map((slotNumber) => {
                        const isStamped = slotNumber <= displayPoints;
                        return (
                          <div
                            key={slotNumber}
                            className="aspect-square flex items-center justify-center relative rounded-full border-2 border-slate-700/80 bg-white shadow-inner transition-transform"
                          >
                            {isStamped ? (
                              <div className="w-[85%] h-[85%] flex items-center justify-center animate-in zoom-in-50 duration-200">
                                <StampGreat />
                              </div>
                            ) : (
                              <span className="text-xs font-serif text-slate-300 select-none">
                                {slotNumber}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Row 3: 3 Circles (Slots 8, 9, 10) */}
                    <div className="grid grid-cols-3 gap-6 px-10">
                      {[8, 9, 10].map((slotNumber) => {
                        const isStamped = slotNumber <= displayPoints;
                        return (
                          <div
                            key={slotNumber}
                            className="aspect-square flex items-center justify-center relative rounded-full border-2 border-slate-700/80 bg-white shadow-inner transition-transform"
                          >
                            {isStamped ? (
                              <div className="w-[85%] h-[85%] flex items-center justify-center animate-in zoom-in-50 duration-200">
                                <StampGreat />
                              </div>
                            ) : (
                              <span className="text-xs font-serif text-slate-300 select-none">
                                {slotNumber}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Footer: Kumon branding */}
                  <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold tracking-wide uppercase">Kumon Gia Hòa</span>
                    <span>10 điểm = Hoàn thành 1 thẻ</span>
                  </div>
                </div>
              </div>

              {/* Weekly Point Calculation History Breakdown */}
              <Card className="glass-card">
                <CardHeader className="p-4 pb-3 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        {isViewingLatestCompleted && latestCompletedCycle
                          ? `Lịch sử tích lũy - Phiếu ${latestCompletedCycle.cycleNumber} (Gần nhất: 10/10 điểm)`
                          : `Lịch sử tích lũy - Phiếu ${currentCycleNumber} (Hiện tại: ${selectedStudent.currentPoints}/10 điểm)`}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        {isViewingLatestCompleted
                          ? `Chi tiết 5 tuần tích lũy của phiếu số ${latestCompletedCycle?.cycleNumber} đã đạt 10 điểm`
                          : 'Hiển thị các tuần tích lũy của phiếu hiện tại (Tự động reset khi phiếu đạt đủ 10 điểm)'}
                      </CardDescription>
                    </div>

                    {/* Filter tabs: Chỉ hiển thị Phiếu hiện tại và Phiếu gần nhất */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100/90 p-1 rounded-xl">
                      {/* Phiếu hiện tại */}
                      <button
                        type="button"
                        onClick={() => setSelectedCycleView('current')}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                          !isViewingLatestCompleted
                            ? "bg-white text-slate-900 shadow-xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Phiếu {currentCycleNumber} (Hiện tại: {selectedStudent.currentPoints}/10)
                      </button>

                      {/* Phiếu gần kề nhất (nếu có) */}
                      {latestCompletedCycle && (
                        <button
                          type="button"
                          onClick={() => setSelectedCycleView(latestCompletedCycle.cycleNumber)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                            isViewingLatestCompleted
                              ? "bg-emerald-600 text-white shadow-xs font-semibold"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Phiếu {latestCompletedCycle.cycleNumber} (Gần nhất: 10/10)
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {(() => {
                    const weeks = displayedWeeks;

                    if (weeks.length === 0) {
                      return (
                        <div className="p-8 text-center text-sm text-slate-500 space-y-2">
                          {selectedCycleView === 'current' && selectedStudent.completedCards > 0 ? (
                            <>
                              <p className="font-semibold text-slate-700">
                                🎉 Phiếu chuyên cần đã đạt đủ 10 điểm và reset sang chu kỳ mới (0/10 điểm).
                              </p>
                              <p className="text-xs text-slate-400">
                                Lịch sử tích lũy của phiếu này đã được làm mới về 0 và sẽ bắt đầu ghi nhận từ các buổi điểm danh tiếp theo.
                              </p>
                              {latestCompletedCycle && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  onClick={() => setSelectedCycleView(latestCompletedCycle.cycleNumber)}
                                >
                                  Xem phiếu gần nhất (10/10)
                                </Button>
                              )}
                            </>
                          ) : (
                            <p className="text-slate-400">Chưa có dữ liệu điểm danh hiện diện cho học viên này</p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                            <tr>
                              <th className="py-2.5 px-4 text-left">Tuần học (Thứ 2 - CN)</th>
                              <th className="py-2.5 px-4 text-left">Các ngày đi học thực tế</th>
                              <th className="py-2.5 px-4 text-center">Số buổi</th>
                              <th className="py-2.5 px-4 text-center">Điểm tuần này</th>
                              <th className="py-2.5 px-4 text-center">Lũy kế phiếu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {weeks.map((w) => (
                              <tr key={w.weekKey} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-4 font-medium text-slate-800">
                                  {w.weekLabel}
                                </td>
                                <td className="py-2.5 px-4 text-slate-700">
                                  <div className="flex flex-wrap gap-1.5">
                                    {w.days.map((d, dIdx) => (
                                      <span
                                        key={dIdx}
                                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]"
                                      >
                                        📅 {d.formattedDate}
                                        {d.details.length > 1 && (
                                          <span className="text-[10px] text-primary font-semibold">
                                            ({d.details.length} môn)
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-center text-slate-600 font-medium">
                                  {w.attendedDaysCount} ngày
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "font-bold text-xs",
                                      w.pointsEarned === 2
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                    )}
                                  >
                                    +{w.pointsEarned} điểm
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-4 text-center font-bold text-amber-600">
                                  {w.cumulativePoints} / 10 điểm
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border bg-white p-8 text-slate-400">
              Vui lòng chọn học viên để xem thẻ chuyên cần
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
