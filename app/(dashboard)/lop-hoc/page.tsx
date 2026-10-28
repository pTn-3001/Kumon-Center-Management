"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, CircleCheckBig, FileOutput, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableStudentSelect } from '@/components/ui/searchable-student-select';
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
  checkOutAt: string | null;
  status: 'Hiện diện' | 'Vắng';
  makeUpClassGroupId: number | null;
  classGroupLabel: string;
  makeUpClassGroupLabel?: string | null;
  studentName: string;
};

type ApiExtraClassStudent = {
  id: number;
  classGroupId: number;
  studentId: number;
  subjectCode: SubjectCode;
  classShift: string;
  scheduledAt: string;
  note: string | null;
  student: { id: number; fullName: string; status: string };
};

type EffectiveEnrollmentRow = ApiClassGroup['enrollments'][number] & { isMakeUp?: boolean; isExtra?: boolean };

type ClassPayload = {
  classGroups: ApiClassGroup[];
  students: ApiStudent[];
  staff: Array<{ id: number; fullName: string; role: string }>;
  attendance: ApiAttendance[];
  extraClassStudents: ApiExtraClassStudent[];
};

const chartColors = ['#2ca39d', '#d97706', '#ef4444', '#334155'];
const classTabs = ['quan-ly', 'lich-su'] as const;

type ClassTab = typeof classTabs[number];

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

function normalizeClassShift(value: string): ClassShift {
  if (value === 'SHIFT_2' || value === 'Ca 2') return 'Ca 2';
  if (value === 'SHIFT_3' || value === 'Ca 3') return 'Ca 3';
  if (value === 'SHIFT_4' || value === 'Ca 4') return 'Ca 4';
  if (value === 'SHIFT_5' || value === 'Ca 5') return 'Ca 5';
  return 'Ca 1';
}

function getShiftForWeekday(studyDays: string, weekday: Weekday, fallbackShift: string): ClassShift {
  const match = new RegExp(`${weekday}\\s*\\((Ca\\s[1-5])\\)`).exec(studyDays);
  if (match?.[1]) {
    return normalizeClassShift(match[1]);
  }

  return normalizeClassShift(fallbackShift);
}

function getDateRangeForCurrentWeek() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function getDateForWeekdayInCurrentWeek(weekday: Weekday) {
  const weekdays: Weekday[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const index = weekdays.indexOf(weekday);
  const { start } = getDateRangeForCurrentWeek();
  const date = new Date(start);
  date.setDate(start.getDate() + Math.max(index, 0));

  return date.toISOString().slice(0, 10);
}

function toLocalDateString(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return isoDateStr.slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toWeekdayFromDate(value: string) {
  const day = new Date(value).getDay();
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
}

function formatStudentStatusLabel(status: string) {
  if (status === 'OFFICIAL') return 'Chính thức';
  if (status === 'TRIAL') return 'Học thử';
  if (status === 'EXPIRED') return 'Hết hạn';
  if (status === 'DROPPED') return 'Thôi học';
  return status;
}

function ShiftChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const count = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm">
      {count} học viên
    </div>
  );
}

function toTimeInputValue(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function ClassPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedStudentFromQuery = searchParams.get('studentId');
  const [data, setData] = useState<ClassPayload>({ classGroups: [], students: [], staff: [], attendance: [], extraClassStudents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<{ subjectCode: SubjectCode; weekday: Weekday } | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceCheckInTime, setAttendanceCheckInTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [isCustomCheckInTime, setIsCustomCheckInTime] = useState(false);

  useEffect(() => {
    if (isCustomCheckInTime) return;
    const updateRealtimeCheckIn = () => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setAttendanceCheckInTime((prev) => (prev === timeStr ? prev : timeStr));
    };
    updateRealtimeCheckIn();
    const timer = setInterval(updateRealtimeCheckIn, 1000);
    return () => clearInterval(timer);
  }, [isCustomCheckInTime]);
  const [attendanceStudentId, setAttendanceStudentId] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'Hiện diện' | 'Vắng'>('Hiện diện');
  const [makeUpClassKey, setMakeUpClassKey] = useState('none');
  const [makeUpClassShift, setMakeUpClassShift] = useState<ClassShift>('Ca 1');
  const [extraStudentId, setExtraStudentId] = useState('');
  const [extraStudentDate, setExtraStudentDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceHistoryDate, setAttendanceHistoryDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceCheckoutDialogOpen, setAttendanceCheckoutDialogOpen] = useState(false);
  const [attendanceCheckoutTarget, setAttendanceCheckoutTarget] = useState<ApiAttendance | null>(null);
  const [attendanceCheckoutTime, setAttendanceCheckoutTime] = useState(() => toTimeInputValue(new Date()));
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

  const activeFetchDate = currentTab === 'lich-su' ? attendanceHistoryDate : attendanceDate;

  const fetchClassData = useCallback(async (targetDate: string) => {
    const response = await fetch(`/api/lop-hoc?date=${targetDate}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu lớp học');
    }
    return (await response.json()) as ClassPayload;
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const loadData = async () => {
      try {
        const payload = await fetchClassData(activeFetchDate);
        if (!isCancelled) {
          setData(payload);
          setSelectedClass((prev) => prev || { subjectCode: 'MATH', weekday: defaultMathWeekday });
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Có lỗi xảy ra');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      isCancelled = true;
    };
  }, [activeFetchDate, defaultMathWeekday, fetchClassData]);

  useEffect(() => {
    if (!selectedClass) {
      return;
    }

    setExtraStudentDate(new Date().toISOString().slice(0, 10));
  }, [selectedClass]);

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

  const weekRange = useMemo(() => getDateRangeForCurrentWeek(), []);

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

  const weeklyExtraStudentsByClassKey = useMemo(() => {
    const map = new Map<string, ApiExtraClassStudent[]>();

    data.extraClassStudents.forEach((item) => {
      const scheduledAt = new Date(item.scheduledAt);
      if (!(scheduledAt >= weekRange.start && scheduledAt < weekRange.end)) {
        return;
      }

      const classGroup = classGroupById.get(item.classGroupId);
      if (!classGroup) {
        return;
      }

      const weekday = toWeekdayFromDate(item.scheduledAt);
      if (weekday !== classGroup.weekday) {
        return;
      }

      const key = `${classGroup.subjectCode}-${classGroup.weekday}`;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    });

    return map;
  }, [classGroupById, data.extraClassStudents, weekRange.end, weekRange.start]);

  const effectiveEnrollmentsByClassKey = useMemo(() => {
    const result = new Map<string, EffectiveEnrollmentRow[]>();

    FIXED_CLASSES.forEach((classItem) => {
      const key = `${classItem.subjectCode}-${classItem.weekday}`;
      const classGroupIds = data.classGroups
        .filter((group) => group.subjectCode === classItem.subjectCode && group.weekday === classItem.weekday)
        .map((group) => group.id);
      const selectedSet = new Set(classGroupIds);

      const baseEnrollments = mergedClassGroups.get(key)?.enrollments ?? [];

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

      const weeklyExtraRows = weeklyExtraStudentsByClassKey.get(key) ?? [];
      const extraRows: EffectiveEnrollmentRow[] = [];

      weeklyExtraRows.forEach((item) => {
        if (existingStudentIds.has(item.studentId)) {
          return;
        }

        const sourceEnrollment =
          allEnrollments.find((enrollment) => enrollment.studentId === item.studentId && enrollment.subjectCode === classItem.subjectCode)
          ?? allEnrollments.find((enrollment) => enrollment.studentId === item.studentId);

        extraRows.push({
          id: sourceEnrollment?.id ?? -item.id,
          studentId: item.studentId,
          classGroupId: item.classGroupId,
          subjectCode: classItem.subjectCode,
          registrationType: sourceEnrollment?.registrationType ?? 'Học thêm tuần',
          enrollmentType: sourceEnrollment?.enrollmentType ?? 'Theo lịch cá nhân',
          studyDays: sourceEnrollment?.studyDays ?? `${classItem.weekday}(${item.classShift})`,
          classShift: item.classShift,
          startDate: sourceEnrollment?.startDate ?? item.scheduledAt,
          endDate: sourceEnrollment?.endDate ?? null,
          isExtra: true,
          student: {
            id: item.student.id,
            fullName: item.student.fullName,
            status: 'Học thêm',
          },
        });

        existingStudentIds.add(item.studentId);
      });

      result.set(key, [...baseEnrollments, ...movedInRows, ...extraRows]);
    });

    return result;
  }, [allEnrollments, classGroupById, data.classGroups, data.students, mergedClassGroups, weeklyExtraStudentsByClassKey, weeklyMakeUpMap]);

  const selectedClassEffectiveEnrollments = useMemo<EffectiveEnrollmentRow[]>(() => {
    if (!selectedClass) return [];
    const key = `${selectedClass.subjectCode}-${selectedClass.weekday}`;
    return effectiveEnrollmentsByClassKey.get(key) ?? [];
  }, [effectiveEnrollmentsByClassKey, selectedClass]);

  const selectedClassStudents = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string; status: string }>();
    selectedClassEffectiveEnrollments.forEach((enrollment) => {
      if (enrollment.isExtra) {
        map.set(enrollment.student.id, { ...enrollment.student, status: 'Học thêm' });
        return;
      }

      if (enrollment.isMakeUp) {
        map.set(enrollment.student.id, { ...enrollment.student, status: 'Học bù' });
        return;
      }

      if (!map.has(enrollment.student.id)) {
        map.set(enrollment.student.id, enrollment.student);
      }
    });
    return Array.from(map.values());
  }, [selectedClassEffectiveEnrollments]);

  useEffect(() => {
    if (!selectedStudentFromQuery) return;
    const matchedStudent = selectedClassStudents.find((student) => String(student.id) === selectedStudentFromQuery);
    if (!matchedStudent) return;
    setAttendanceStudentId(String(matchedStudent.id));
  }, [selectedClassStudents, selectedStudentFromQuery]);

  const filteredClassStudentsForAttendance = useMemo(() => {
    if (!selectedClassGroup) return selectedClassStudents;
    const attendedStudentIds = new Set(
      data.attendance
        .filter((record) => toLocalDateString(record.date) === attendanceDate && record.classGroupId === selectedClassGroup.id)
        .map((record) => record.studentId)
    );
    return selectedClassStudents.filter((student) => !attendedStudentIds.has(student.id));
  }, [selectedClassStudents, data.attendance, attendanceDate, selectedClassGroup]);

  const statusData = useMemo(() => {
    const counts = selectedClassStudents.reduce<Record<string, number>>((acc, student) => {
      const label = formatStudentStatusLabel(student.status);
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [selectedClassStudents]);

  const shiftData = useMemo(() => {
    const counts = selectedClassEffectiveEnrollments.reduce<Record<string, number>>((acc, enrollment) => {
      const shift = selectedClass?.weekday
        ? getShiftForWeekday(enrollment.studyDays, selectedClass.weekday, enrollment.classShift)
        : normalizeClassShift(enrollment.classShift);
      acc[shift] = (acc[shift] ?? 0) + 1;
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

  const selectedClassExtraStudents = useMemo(() => {
    if (!selectedClass) {
      return [] as ApiExtraClassStudent[];
    }

    const key = `${selectedClass.subjectCode}-${selectedClass.weekday}`;
    return weeklyExtraStudentsByClassKey.get(key) ?? [];
  }, [selectedClass, weeklyExtraStudentsByClassKey]);

  const extraStudentCandidates = useMemo(() => {
    const existingIds = new Set(selectedClassStudents.map((item) => item.id));
    return data.students.filter((student) => !existingIds.has(student.id));
  }, [data.students, selectedClassStudents]);

  const filteredAttendanceHistory = useMemo(() => {
    return data.attendance.filter((record) => toLocalDateString(record.date) === attendanceHistoryDate);
  }, [attendanceHistoryDate, data.attendance]);

  async function refreshData() {
    const payload = await fetchClassData(activeFetchDate);
    setData(payload);
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
    // Tránh reset `attendanceDate` (ngày điểm danh) để tiện điểm danh liên tục cho cùng một ngày
    setAttendanceStudentId('');
    setAttendanceStatus('Hiện diện');
    setIsCustomCheckInTime(false);
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

  function openAttendanceCheckoutDialog(record: ApiAttendance) {
    const existingTime = record.checkOutAt ? new Date(record.checkOutAt) : new Date();
    setAttendanceCheckoutTarget(record);
    setAttendanceCheckoutTime(toTimeInputValue(existingTime));
    setAttendanceCheckoutDialogOpen(true);
  }

  function closeAttendanceCheckoutDialog() {
    setAttendanceCheckoutDialogOpen(false);
    setAttendanceCheckoutTarget(null);
  }

  async function submitAttendanceCheckout() {
    if (!attendanceCheckoutTarget) {
      return;
    }

    const [hoursText, minutesText] = attendanceCheckoutTime.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    const checkoutDate = new Date(attendanceCheckoutTarget.date);
    checkoutDate.setHours(hours, minutes, 0, 0);

    const response = await fetch(`/api/lop-hoc/attendance/${attendanceCheckoutTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkOutAt: checkoutDate.toISOString() }),
    });

    if (!response.ok) throw new Error('Không thể điểm danh giờ ra');

    closeAttendanceCheckoutDialog();
    await refreshData();
  }

  async function addWeeklyExtraStudent() {
    if (!selectedClassGroup || !extraStudentId || !extraStudentDate) {
      return;
    }

    const response = await fetch('/api/lop-hoc/extra-students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classGroupId: selectedClassGroup.id,
        studentId: Number(extraStudentId),
        scheduledAt: extraStudentDate,
      }),
    });

    if (!response.ok) {
      throw new Error('Không thể thêm học viên học thêm');
    }

    setExtraStudentId('');
    await refreshData();
  }

  async function removeWeeklyExtraStudent(id: number) {
    const response = await fetch(`/api/lop-hoc/extra-students/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Không thể xóa học viên học thêm');
    }

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
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-950">{classItem.name}</p>
                              <p className="text-xs text-muted-foreground">{enrollmentCount} học viên</p>
                            </div>
                            {active ? (
                              <CircleCheckBig className="h-6 w-6 text-green-600" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {selectedClassGroup ? (
              <div className="space-y-4">
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
                          <Tooltip content={<ShiftChartTooltip />} />
                          <Bar dataKey="value" fill="#2ca39d" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

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
                              <div className="flex items-center gap-2">
                                {enrollment.isMakeUp ? <Badge variant="secondary">Học bù</Badge> : null}
                                {enrollment.isExtra ? <Badge variant="warning">Học thêm</Badge> : null}
                              </div>
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

                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-base">Thêm học viên học thêm trong tuần</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Học viên</Label>
                        <SearchableStudentSelect
                          options={extraStudentCandidates.map((student) => ({
                            value: String(student.id),
                            label: student.fullName,
                          }))}
                          value={extraStudentId}
                          onValueChange={setExtraStudentId}
                          placeholder="Chọn học viên học thêm"
                          searchPlaceholder="Tìm tên học viên học thêm..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ngày học thêm</Label>
                        <Input type="date" value={extraStudentDate} onChange={(event) => setExtraStudentDate(event.target.value)} />
                      </div>
                    </div>
                    <Button type="button" className="w-full" onClick={() => void addWeeklyExtraStudent()}>
                      Thêm học viên học thêm
                    </Button>

                    <div className="space-y-2 rounded-xl border p-3">
                      <p className="text-sm font-medium text-slate-900">Danh sách học thêm trong tuần ({selectedClassExtraStudents.length})</p>
                      {selectedClassExtraStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Chưa có học viên học thêm tuần này.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedClassExtraStudents.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                              <div>
                                <p className="font-medium text-slate-900">{item.student.fullName}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(item.scheduledAt)}</p>
                              </div>
                              <Button size="sm" variant="destructive" onClick={() => void removeWeeklyExtraStudent(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-base">Điểm danh</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Học viên</Label>
                      <SearchableStudentSelect
                        options={filteredClassStudentsForAttendance.map((student) => ({
                          value: String(student.id),
                          label: student.fullName,
                          subLabel: student.status === 'Học bù' ? 'Học bù' : student.status === 'Học thêm' ? 'Học thêm' : undefined,
                        }))}
                        value={attendanceStudentId}
                        onValueChange={setAttendanceStudentId}
                        placeholder="Chọn học viên"
                        searchPlaceholder="Tìm tên học viên điểm danh..."
                      />
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
                          <Input type="time" value={attendanceCheckInTime} onChange={(e) => { setAttendanceCheckInTime(e.target.value); setIsCustomCheckInTime(true); }} />
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
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-2">
                <Label>Lọc theo ngày</Label>
                <Input type="date" value={attendanceHistoryDate} onChange={(event) => setAttendanceHistoryDate(event.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Học viên</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Giờ vào lớp</TableHead>
                    <TableHead>Giờ ra về</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendanceHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {(() => {
                          const group = classGroupById.get(record.classGroupId);
                          if (!group) return record.classGroupLabel;
                          const shiftLabel = formatClassShiftByWeekday(group.weekday, group.classShift as ClassShift);
                          return group.label.includes(shiftLabel) ? group.label : `${group.label} - ${shiftLabel}`;
                        })()}
                      </TableCell>
                      <TableCell>{record.studentName}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.status === 'Hiện diện' ? formatTime24(record.date) : '--:--'}</TableCell>
                      <TableCell>{record.status === 'Hiện diện' ? (record.checkOutAt ? formatTime24(record.checkOutAt) : '--:--') : '--:--'}</TableCell>
                      <TableCell>
                        <Badge variant={record.status === 'Hiện diện' ? 'success' : 'destructive'}>{record.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {record.status === 'Hiện diện' && !record.checkOutAt ? (
                            <Button size="sm" variant="outline" onClick={() => openAttendanceCheckoutDialog(record)}>
                              <FileOutput className="mr-2 h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button size="sm" variant="destructive" onClick={() => void deleteAttendance(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAttendanceHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Không có dữ liệu điểm danh cho ngày đã chọn.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={attendanceCheckoutDialogOpen} onOpenChange={(open) => {
        setAttendanceCheckoutDialogOpen(open);
        if (!open) {
          setAttendanceCheckoutTarget(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Điểm danh giờ ra về</DialogTitle>
            <DialogDescription>Kiểm tra lại thông tin và xác nhận giờ ra về của học viên.</DialogDescription>
          </DialogHeader>

          {attendanceCheckoutTarget ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Học viên</Label>
                  <Input value={attendanceCheckoutTarget.studentName} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Ngày</Label>
                  <Input value={formatDate(attendanceCheckoutTarget.date)} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lớp</Label>
                <Input
                  value={(() => {
                    const group = classGroupById.get(attendanceCheckoutTarget.classGroupId);
                    if (!group) return attendanceCheckoutTarget.classGroupLabel;
                    const shiftLabel = formatClassShiftByWeekday(group.weekday, group.classShift as ClassShift);
                    return group.label.includes(shiftLabel) ? group.label : `${group.label} - ${shiftLabel}`;
                  })()}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>Giờ ra</Label>
                <Input type="time" value={attendanceCheckoutTime} onChange={(event) => setAttendanceCheckoutTime(event.target.value)} />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAttendanceCheckoutDialog}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void submitAttendanceCheckout()}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClassPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Đang tải...</div>}>
      <ClassPageContent />
    </Suspense>
  );
}
