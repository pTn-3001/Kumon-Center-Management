"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatTime24 } from '@/lib/utils';
import { CLASS_SHIFT_OPTIONS, formatClassShiftByWeekday } from '@/lib/kumon';
import type { ClassShift, SubjectCode, Weekday } from '@/types';

type ApiClassGroup = {
  id: number;
  centerId: number;
  subjectCode: SubjectCode;
  weekday: Weekday;
  classShift: string;
  label: string;
  teacherId: number | null;
  teacher: { id: number; fullName: string; role: string } | null;
  enrollments: Array<{
    id: number;
    studentId: number;
    classGroupId: number | null;
    subjectCode: SubjectCode;
    registrationType: string;
    enrollmentType: string;
    studyDays: string;
    classShift: string;
    startDate: string;
    endDate: string | null;
    student: { id: number; fullName: string; status: string };
  }>;
  createdAt: string;
  updatedAt: string;
};

type ApiStudent = {
  id: number;
  fullName: string;
  status: string;
  parentPhone: string;
};

type ApiAttendance = {
  id: number;
  classGroupId: number;
  studentId: number;
  date: string;
  status: 'Hiện diện' | 'Vắng';
  makeUpClassGroupId: number | null;
  classGroupLabel: string;
  makeUpClassGroupLabel?: string | null;
  studentName: string;
};

type EffectiveEnrollmentRow = ApiClassGroup['enrollments'][number] & { isMakeUp?: boolean };

type ClassPayload = {
  classGroups: ApiClassGroup[];
  students: ApiStudent[];
  staff: Array<{ id: number; fullName: string; role: string }>;
  attendance: ApiAttendance[];
};

const chartColors = ['#2ca39d', '#d97706', '#ef4444', '#334155'];
const classTabs = ['quan-ly', 'lich-su'] as const;

type ClassTab = typeof classTabs[number];

// Generate fixed 12 classes
const FIXED_CLASSES = [
  { subjectCode: 'MATH' as SubjectCode, weekday: 'T2' as Weekday, name: 'Toán - Thứ Hai' },
  { subjectCode: 'MATH' as SubjectCode, weekday: 'T3' as Weekday, name: 'Toán - Thứ Ba' },
  { subjectCode: 'MATH' as SubjectCode, weekday: 'T4' as Weekday, name: 'Toán - Thứ Tư' },
  { subjectCode: 'MATH' as SubjectCode, weekday: 'T5' as Weekday, name: 'Toán - Thứ Năm' },
  { subjectCode: 'MATH' as SubjectCode, weekday: 'T6' as Weekday, name: 'Toán - Thứ Sáu' },
  { subjectCode: 'MATH' as SubjectCode, weekday: 'T7' as Weekday, name: 'Toán - Thứ Bảy' },
  { subjectCode: 'EFL' as SubjectCode, weekday: 'T2' as Weekday, name: 'Tiếng Anh - Thứ Hai' },
  { subjectCode: 'EFL' as SubjectCode, weekday: 'T3' as Weekday, name: 'Tiếng Anh - Thứ Ba' },
  { subjectCode: 'EFL' as SubjectCode, weekday: 'T4' as Weekday, name: 'Tiếng Anh - Thứ Tư' },
  { subjectCode: 'EFL' as SubjectCode, weekday: 'T5' as Weekday, name: 'Tiếng Anh - Thứ Năm' },
  { subjectCode: 'EFL' as SubjectCode, weekday: 'T6' as Weekday, name: 'Tiếng Anh - Thứ Sáu' },
  { subjectCode: 'EFL' as SubjectCode, weekday: 'T7' as Weekday, name: 'Tiếng Anh - Thứ Bảy' },
];

function ClassPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedStudentFromQuery = searchParams.get('studentId');
  const [data, setData] = useState<ClassPayload>({ classGroups: [], students: [], staff: [], attendance: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<{ subjectCode: SubjectCode; weekday: Weekday } | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceCheckInTime, setAttendanceCheckInTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [attendanceStudentId, setAttendanceStudentId] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'Hiện diện' | 'Vắng'>('Hiện diện');
  const [makeUpClassKey, setMakeUpClassKey] = useState('none');
  const [makeUpClassShift, setMakeUpClassShift] = useState<ClassShift>('Ca 1');
  const activeTabFromQuery = searchParams.get('tab');
  const currentTab: ClassTab = classTabs.includes(activeTabFromQuery as ClassTab) ? (activeTabFromQuery as ClassTab) : 'quan-ly';

  const defaultMathWeekday = useMemo<Weekday>(() => {
    const day = new Date().getDay();
    const map: Record<number, Weekday> = {
      0: 'T2',
      1: 'T2',
      2: 'T3',
      3: 'T4',
      4: 'T5',
      5: 'T6',
      6: 'T7',
    };
    return map[day] ?? 'T2';
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/lop-hoc', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu lớp học');
        }
        const payload = (await response.json()) as ClassPayload;
        setData(payload);
        setSelectedClass({ subjectCode: 'MATH', weekday: defaultMathWeekday });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Có lỗi xảy ra');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [defaultMathWeekday]);

  const mergedClassGroups = useMemo(() => {
    const grouped = new Map<string, ApiClassGroup>();

    data.classGroups.forEach((group) => {
      const key = `${group.subjectCode}-${group.weekday}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, { ...group, enrollments: [...group.enrollments] });
        return;
      }

      const existingIds = new Set(current.enrollments.map((item) => item.id));
      const mergedEnrollments = [
        ...current.enrollments,
        ...group.enrollments.filter((item) => !existingIds.has(item.id)),
      ];

      const preferredGroup = group.enrollments.length > current.enrollments.length ? group : current;

      grouped.set(key, {
        ...preferredGroup,
        enrollments: mergedEnrollments,
      });
    });

    return grouped;
  }, [data.classGroups]);

  const selectedClassGroup = useMemo(() => {
    if (!selectedClass) return null;
    const key = `${selectedClass.subjectCode}-${selectedClass.weekday}`;
    return mergedClassGroups.get(key) ?? null;
  }, [selectedClass, mergedClassGroups]);

  const selectedMakeUpWeekday = useMemo<Weekday | null>(() => {
    if (makeUpClassKey === 'none') {
      return null;
    }

    const [, weekday] = makeUpClassKey.split('-') as [SubjectCode, Weekday];
    return weekday;
  }, [makeUpClassKey]);

  const selectedClassGroupIds = useMemo(() => {
    if (!selectedClass) return [] as number[];
    return data.classGroups
      .filter((group) => group.subjectCode === selectedClass.subjectCode && group.weekday === selectedClass.weekday)
      .map((group) => group.id);
  }, [data.classGroups, selectedClass]);

  const weekRange = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setDate(today.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }, []);

  const weeklyMakeUpMap = useMemo(() => {
    const sorted = [...data.attendance]
      .filter((record) => record.status === 'Vắng' && record.makeUpClassGroupId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const map = new Map<number, number>();
    sorted.forEach((record) => {
      const date = new Date(record.date);
      if (date >= weekRange.start && date < weekRange.end && record.makeUpClassGroupId) {
        map.set(record.studentId, record.makeUpClassGroupId);
      }
    });
    return map;
  }, [data.attendance, weekRange]);

  const allEnrollments = useMemo(() => {
    const map = new Map<number, ApiClassGroup['enrollments'][number]>();
    data.classGroups.forEach((group) => {
      group.enrollments.forEach((enrollment) => {
        if (!map.has(enrollment.id)) {
          map.set(enrollment.id, enrollment);
        }
      });
    });
    return Array.from(map.values());
  }, [data.classGroups]);

  const classGroupById = useMemo(() => {
    const map = new Map<number, ApiClassGroup>();
    data.classGroups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [data.classGroups]);

  const effectiveEnrollmentsByClassKey = useMemo(() => {
    const result = new Map<string, EffectiveEnrollmentRow[]>();

    FIXED_CLASSES.forEach((classItem) => {
      const key = `${classItem.subjectCode}-${classItem.weekday}`;
      const classGroupIds = data.classGroups
        .filter((group) => group.subjectCode === classItem.subjectCode && group.weekday === classItem.weekday)
        .map((group) => group.id);
      const selectedSet = new Set(classGroupIds);

      const baseEnrollments = (mergedClassGroups.get(key)?.enrollments ?? []).filter((enrollment) => {
        const targetClassGroupId = weeklyMakeUpMap.get(enrollment.studentId);
        if (!targetClassGroupId) return true;
        return selectedSet.has(targetClassGroupId);
      });

      const existingStudentIds = new Set(baseEnrollments.map((enrollment) => enrollment.studentId));
      const movedInRows: EffectiveEnrollmentRow[] = [];

      weeklyMakeUpMap.forEach((targetClassGroupId, studentId) => {
        if (!selectedSet.has(targetClassGroupId)) return;
        if (existingStudentIds.has(studentId)) return;

        const sourceEnrollment =
          allEnrollments.find((enrollment) => enrollment.studentId === studentId && enrollment.subjectCode === classItem.subjectCode)
          ?? allEnrollments.find((enrollment) => enrollment.studentId === studentId);
        const student = data.students.find((candidate) => candidate.id === studentId);
        const targetClassGroup = classGroupById.get(targetClassGroupId);
        if (!sourceEnrollment || !student || !targetClassGroup) return;

        movedInRows.push({
          ...sourceEnrollment,
          classGroupId: targetClassGroupId,
          classShift: targetClassGroup.classShift,
          isMakeUp: true,
          student: {
            ...sourceEnrollment.student,
            status: 'Học bù',
          },
        });
      });

      result.set(key, [...baseEnrollments, ...movedInRows]);
    });

    return result;
  }, [allEnrollments, classGroupById, data.classGroups, data.students, mergedClassGroups, weeklyMakeUpMap]);

  const selectedClassEffectiveEnrollments = useMemo<EffectiveEnrollmentRow[]>(() => {
    if (!selectedClass) return [];
    const key = `${selectedClass.subjectCode}-${selectedClass.weekday}`;
    return effectiveEnrollmentsByClassKey.get(key) ?? [];
  }, [effectiveEnrollmentsByClassKey, selectedClass]);

  const selectedClassStudents = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string; status: string }>();
    selectedClassEffectiveEnrollments.forEach((enrollment) => {
      if (enrollment.isMakeUp) {
        map.set(enrollment.student.id, { ...enrollment.student, status: 'Học bù' });
        return;
      }

      const makeUpTarget = weeklyMakeUpMap.get(enrollment.student.id);
      const isInMakeUpElsewhere = Boolean(makeUpTarget && !selectedClassGroupIds.includes(makeUpTarget));
      if (!isInMakeUpElsewhere && !map.has(enrollment.student.id)) {
        map.set(enrollment.student.id, enrollment.student);
      }
    });
    return Array.from(map.values());
  }, [selectedClassEffectiveEnrollments, selectedClassGroupIds, weeklyMakeUpMap]);

  useEffect(() => {
    if (!selectedStudentFromQuery) return;
    const matchedStudent = selectedClassStudents.find((student) => String(student.id) === selectedStudentFromQuery);
    if (!matchedStudent) return;
    setAttendanceStudentId(String(matchedStudent.id));
  }, [selectedClassStudents, selectedStudentFromQuery]);

  const statusData = useMemo(() => {
    const counts = selectedClassStudents.reduce<Record<string, number>>((acc, student) => {
      acc[student.status] = (acc[student.status] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [selectedClassStudents]);

  const shiftData = useMemo(() => {
    const counts = selectedClassEffectiveEnrollments.reduce<Record<string, number>>((acc, enrollment) => {
      acc[enrollment.classShift] = (acc[enrollment.classShift] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({
      name: selectedClass?.weekday ? formatClassShiftByWeekday(selectedClass.weekday, name as ClassShift) : name,
      value,
    }));
  }, [selectedClass?.weekday, selectedClassEffectiveEnrollments]);

  const currentWeekday = useMemo<Weekday | null>(() => {
    const day = new Date().getDay();
    const map: Record<number, Weekday | null> = {
      0: null,
      1: 'T2',
      2: 'T3',
      3: 'T4',
      4: 'T5',
      5: 'T6',
      6: 'T7',
    };
    return map[day] ?? null;
  }, []);

  async function refreshData() {
    const response = await fetch('/api/lop-hoc', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không thể tải dữ liệu lớp học');
    setData((await response.json()) as ClassPayload);
  }

  async function submitAttendance() {
    if (!attendanceStudentId || !selectedClassGroup) return;

    let resolvedMakeUpClassGroupId: number | null = null;
    if (attendanceStatus === 'Vắng' && makeUpClassKey !== 'none') {
      const [subjectCode, weekday] = makeUpClassKey.split('-') as [SubjectCode, Weekday];
      const found = data.classGroups.find((group) => (
        group.subjectCode === subjectCode
        && group.weekday === weekday
        && group.classShift === makeUpClassShift
      ));

      if (found) {
        resolvedMakeUpClassGroupId = found.id;
      } else {
        const fixed = FIXED_CLASSES.find((item) => item.subjectCode === subjectCode && item.weekday === weekday);
        const createResponse = await fetch('/api/lop-hoc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: `${fixed?.name ?? `${subjectCode}-${weekday}`} - ${formatClassShiftByWeekday(weekday, makeUpClassShift)}`,
            subjectCode,
            weekday,
            classShift: makeUpClassShift,
          }),
        });

        if (!createResponse.ok) {
          throw new Error('Không thể tạo lớp học bù');
        }

        const created = (await createResponse.json()) as { id: number };
        resolvedMakeUpClassGroupId = created.id;
      }
    }

    const response = await fetch('/api/lop-hoc/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classGroupId: selectedClassGroup.id,
        studentId: Number(attendanceStudentId),
        date: attendanceDate,
        status: attendanceStatus,
        checkInTime: attendanceStatus === 'Hiện diện' ? attendanceCheckInTime : null,
        makeUpClassGroupId: resolvedMakeUpClassGroupId,
      }),
    });

    if (!response.ok) throw new Error('Không thể lưu điểm danh');
    setAttendanceStudentId('');
    setAttendanceCheckInTime(() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    setMakeUpClassKey('none');
    setMakeUpClassShift('Ca 1');
    await refreshData();
  }

  async function deleteAttendance(id: number) {
    const response = await fetch(`/api/lop-hoc/attendance/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Không thể xóa điểm danh');
    await refreshData();
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Đang tải dữ liệu lớp học...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  function handleTabChange(tab: string) {
    const nextTab = classTabs.includes(tab as ClassTab) ? (tab as ClassTab) : 'quan-ly';
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsContent value="quan-ly" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            {/* Left: Class Cards */}
            <div className="space-y-4">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Các lớp học</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {FIXED_CLASSES.map((classItem) => {
                      const active = selectedClass?.subjectCode === classItem.subjectCode && selectedClass?.weekday === classItem.weekday;
                      const isToday = currentWeekday === classItem.weekday;
                      const subjectColor = classItem.subjectCode === 'MATH' ? '#2e8db7' : '#f08900';
                      const key = `${classItem.subjectCode}-${classItem.weekday}`;
                      const effectiveRows = effectiveEnrollmentsByClassKey.get(key) ?? [];
                      const enrollmentCount = new Set(effectiveRows.map((row) => row.studentId)).size;

                      return (
                        <button
                          key={`${classItem.subjectCode}-${classItem.weekday}`}
                          type="button"
                          onClick={() => setSelectedClass(classItem)}
                          className={`rounded-2xl border p-4 text-left transition ${active ? 'shadow-soft' : ''} ${isToday ? 'ring-2 ring-offset-1' : ''}`}
                          style={{
                            borderColor: active ? subjectColor : (isToday ? `${subjectColor}99` : undefined),
                            backgroundColor: active ? `${subjectColor}14` : (isToday ? `${subjectColor}0D` : undefined),
                            boxShadow: isToday ? `0 0 0 1px ${subjectColor}26` : undefined,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-950">
                                {classItem.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{enrollmentCount} học viên</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Details & Stats */}
            {selectedClassGroup ? (
              <div className="space-y-4">
                {/* Statistics */}
                <div className="grid gap-4">
                  <Card className="border bg-white">
                    <CardHeader>
                      <CardTitle className="text-base">Trạng thái học viên</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">
                            {statusData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border bg-white">
                    <CardHeader>
                      <CardTitle className="text-base">Phân bố ca học</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={shiftData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#2ca39d" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Student List */}
                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-base">Danh sách học viên ({selectedClassEffectiveEnrollments.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {selectedClassEffectiveEnrollments.length > 0 ? (
                        selectedClassEffectiveEnrollments.map((enrollment) => (
                          <div key={enrollment.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-slate-950">{enrollment.student.fullName}</p>
                              {enrollment.isMakeUp ? <Badge variant="secondary">Học bù</Badge> : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{enrollment.registrationType} · {enrollment.enrollmentType}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-sm text-muted-foreground">Chưa có học viên nào</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Attendance */}
                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-base">Điểm danh</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Học viên</Label>
                      <Select value={attendanceStudentId} onValueChange={setAttendanceStudentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn học viên" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedClassStudents.map((student) => (
                            <SelectItem key={student.id} value={String(student.id)}>
                              {student.fullName}{student.status === 'Học bù' ? ' (Học bù)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label>Ngày</Label>
                        <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Trạng thái</Label>
                        <Select
                          value={attendanceStatus}
                          onValueChange={(value: any) => {
                            setAttendanceStatus(value);
                            if (value === 'Hiện diện') {
                              const now = new Date();
                              setAttendanceCheckInTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Hiện diện">Hiện diện</SelectItem>
                            <SelectItem value="Vắng">Vắng</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {attendanceStatus === 'Hiện diện' ? (
                        <div className="space-y-2">
                          <Label>Giờ vào học</Label>
                          <Input type="time" value={attendanceCheckInTime} onChange={(e) => setAttendanceCheckInTime(e.target.value)} />
                        </div>
                      ) : null}
                      {attendanceStatus === 'Vắng' ? (
                        <>
                          <div className="space-y-2">
                            <Label>Lớp học bù</Label>
                            <Select value={makeUpClassKey} onValueChange={setMakeUpClassKey}>
                              <SelectTrigger>
                                <SelectValue placeholder="Chọn 1 trong 12 lớp" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Không học bù</SelectItem>
                                {FIXED_CLASSES.map((item) => (
                                  <SelectItem key={`${item.subjectCode}-${item.weekday}`} value={`${item.subjectCode}-${item.weekday}`}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {makeUpClassKey !== 'none' && selectedMakeUpWeekday ? (
                            <div className="space-y-2">
                              <Label>Ca học bù</Label>
                              <Select value={makeUpClassShift} onValueChange={(value) => setMakeUpClassShift(value as ClassShift)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Chọn ca học" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CLASS_SHIFT_OPTIONS.map((shift) => (
                                    <SelectItem key={shift} value={shift}>{formatClassShiftByWeekday(selectedMakeUpWeekday, shift)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    <Button className="w-full" onClick={() => void submitAttendance()}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Lưu điểm danh
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="glass-card">
                <CardContent className="p-6 text-center text-muted-foreground">Chọn một lớp để xem chi tiết</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lich-su" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Lịch sử điểm danh</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Học viên</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {(() => {
                          const group = classGroupById.get(record.classGroupId);
                          if (!group) return record.classGroupLabel;
                          return `${group.label} - ${formatClassShiftByWeekday(group.weekday, group.classShift as ClassShift)}`;
                        })()}
                      </TableCell>
                      <TableCell>{record.studentName}</TableCell>
                      <TableCell>
                        {record.status === 'Hiện diện'
                          ? `${formatDate(record.date)} ${formatTime24(record.date)}`
                          : formatDate(record.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.status === 'Hiện diện' ? 'success' : 'destructive'}>{record.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" onClick={() => void deleteAttendance(record.id)}>
                          Xóa
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ClassPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Dang tai...</div>}>
      <ClassPageContent />
    </Suspense>
  );
}
