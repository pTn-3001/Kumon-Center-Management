"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { addYears, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { CalendarDays, Edit3, PhoneCall, Search, PlusCircle, ShieldX, X, CircleDollarSign, Save, FolderPlus, GraduationCap, History, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MetricCard } from '@/components/dashboard/metric-card';
import { cn, formatCurrency, formatDate, formatNumberWithDots } from '@/lib/utils';
import { formatClassShiftByWeekday } from '@/lib/kumon';
import type { ClassShift, Gender, StudentStatus, SubjectCode, Weekday } from '@/types';

type ApiStudent = {
  id: number;
  centerId: number;
  fullName: string;
  birthDate: string | null;
  gender: Gender;
  admissionDate: string;
  fatherFullName: string | null;
  fatherPhone: string | null;
  motherFullName: string | null;
  motherPhone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  status: StudentStatus;
  reportBDate: string | null;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  enrollments: Array<{
    id: number;
    subjectCode: 'MATH' | 'EFL';
    registrationType: string;
    enrollmentType: string;
    currentLevel: string | null;
    studyDays: string;
    classShift: 'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca 4' | 'Ca 5';
    startDate: string;
    reportBDate: string | null;
    reenrollDate: string | null;
    endDate: string | null;
    classGroup: { id: number; label: string; weekday: string; classShift: string } | null;
  }>;
};

type ApiClassGroup = {
  id: number;
  subjectCode: SubjectCode;
  classShift: string;
  weekday: Weekday;
  label: string;
};

type ApiFinanceItem = {
  id: number;
  centerId: number;
  type: string;
  amount: number;
  spentAt: string;
  proofImage: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiLeadPrefill = {
  id: number;
  fullName: string;
  parentPhone: string;
  parentName: string;
  preferredSubjects: SubjectCode[];
};

type StudentTab = 'hoc-vien' | 'hoc-thu' | 'nghi-hoc' | 'sinh-nhat' | 'chua-thu-hoc-phi' | 'nhap-hoc';
type BirthdayFilter = 'all' | '7-days' | 'after-7-days' | 'passed';
type TrialStatusFilter = 'all' | typeof STATUS_TRIAL | typeof STATUS_EXPIRED;
type TuitionStatusFilter = 'all' | 'unpaid' | 'paid';
type AdmissionRegistrationType = 'Chinh thuc' | 'Hoc thu';
type IntakeSource = 'transfer' | 'new';
type ShiftOption = 'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca 4' | 'Ca 5';
type PaymentMethod = 'Tiền mặt' | 'Chuyển khoản';
type OfficialAdmissionMode = 'all' | 'subjects';

type SubjectAssignmentValue = {
  enrollmentId: number;
  registrationType: string;
  enrollmentType: string;
  startDate: string;
  selectedWeekdays: Weekday[];
  shiftsByWeekday: Partial<Record<Weekday, ShiftOption>>;
};

const STATUS_OFFICIAL = 'Ch\u00ednh th\u1ee9c' as StudentStatus;
const STATUS_DROPPED = 'Th\u00f4i h\u1ecdc' as StudentStatus;
const STATUS_TRIAL = 'H\u1ecdc th\u1eed' as StudentStatus;
const STATUS_EXPIRED = 'H\u1ebft h\u1ea1n' as StudentStatus;

const GENDER_MALE = 'Nam' as Gender;
const GENDER_FEMALE = 'N\u1eef' as Gender;
const GENDER_OTHER = 'Kh\u00e1c' as Gender;

const birthdayFilters: BirthdayFilter[] = ['all', '7-days', 'after-7-days', 'passed'];
const studentTabs: StudentTab[] = ['hoc-vien', 'hoc-thu', 'nghi-hoc', 'sinh-nhat', 'chua-thu-hoc-phi', 'nhap-hoc'];
const SHIFT_OPTIONS: ShiftOption[] = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5'];
const SUBJECT_OPTIONS: SubjectCode[] = ['MATH', 'EFL'];
const TUITION_NOTE_PREFIX = '[TUITION]';
const TUITION_PER_SUBJECT_PER_MONTH = 1500000;
const FIXED_CLASSES: Array<{ subjectCode: SubjectCode; weekday: Weekday; name: string }> = [
  { subjectCode: 'MATH', weekday: 'T2', name: 'Toán - Thứ Hai' },
  { subjectCode: 'MATH', weekday: 'T3', name: 'Toán - Thứ Ba' },
  { subjectCode: 'MATH', weekday: 'T4', name: 'Toán - Thứ Tư' },
  { subjectCode: 'MATH', weekday: 'T5', name: 'Toán - Thứ Năm' },
  { subjectCode: 'MATH', weekday: 'T6', name: 'Toán - Thứ Sáu' },
  { subjectCode: 'MATH', weekday: 'T7', name: 'Toán - Thứ Bảy' },
  { subjectCode: 'EFL', weekday: 'T2', name: 'Tiếng Anh - Thứ Hai' },
  { subjectCode: 'EFL', weekday: 'T3', name: 'Tiếng Anh - Thứ Ba' },
  { subjectCode: 'EFL', weekday: 'T4', name: 'Tiếng Anh - Thứ Tư' },
  { subjectCode: 'EFL', weekday: 'T5', name: 'Tiếng Anh - Thứ Năm' },
  { subjectCode: 'EFL', weekday: 'T6', name: 'Tiếng Anh - Thứ Sáu' },
  { subjectCode: 'EFL', weekday: 'T7', name: 'Tiếng Anh - Thứ Bảy' },
];

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const emptyForm = {
  fullName: '',
  birthDate: '',
  gender: GENDER_MALE,
  admissionDate: TODAY_ISO,
  fatherFullName: '',
  fatherPhone: '',
  motherFullName: '',
  motherPhone: '',
  address: '',
  status: STATUS_OFFICIAL,
  assignedStaffId: '',
};

function getBirthdayInfo(birthDate: string) {
  const today = new Date();
  const birth = parseISO(birthDate);
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  const passed = birthdayThisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nextBirthday = passed ? addYears(birthdayThisYear, 1) : birthdayThisYear;
  const daysUntil = differenceInCalendarDays(nextBirthday, today);
  return { daysUntil, passed };
}

function getSubjectBadge(subjectCode: 'MATH' | 'EFL') {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide',
        subjectCode === 'EFL'
          ? 'bg-[#f08900]/15 text-[#f08900] ring-1 ring-inset ring-[#f08900]/35'
          : 'bg-[#7ecdf4]/20 text-[#2e8db7] ring-1 ring-inset ring-[#7ecdf4]/45'
      )}
    >
      {subjectCode}
    </span>
  );
}

function parseSerializedStudyDays(studyDays: string, fallbackShift: ShiftOption): Array<{ weekday: Weekday; shift: ShiftOption }> {
  const result: Array<{ weekday: Weekday; shift: ShiftOption }> = [];
  const serializedMatches = Array.from(studyDays.matchAll(/(T[2-7])\s*\((Ca\s[1-5])\)/g));

  if (serializedMatches.length > 0) {
    serializedMatches.forEach((match) => {
      result.push({ weekday: match[1] as Weekday, shift: match[2] as ShiftOption });
    });
    return result;
  }

  const plainWeekdays = Array.from(new Set((studyDays.match(/T[2-7]/g) ?? []) as Weekday[]));
  plainWeekdays.forEach((weekday) => {
    result.push({ weekday, shift: fallbackShift });
  });
  return result;
}

function isEnrollmentActive(enrollment: { endDate: string | null; reenrollDate: string | null }) {
  if (!enrollment.endDate) {
    return true;
  }

  if (!enrollment.reenrollDate) {
    return false;
  }

  return parseISO(enrollment.reenrollDate).getTime() > parseISO(enrollment.endDate).getTime();
}

function isEnrollmentDropped(enrollment: { endDate: string | null; reenrollDate: string | null }) {
  return Boolean(enrollment.endDate) && !isEnrollmentActive(enrollment);
}

function toMonthKey(dateValue: string) {
  const date = parseISO(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function computeSpentAtForMonth(paymentDateStr: string, monthKey: string): string {
  const [payYearStr, payMonthStr, payDayStr] = paymentDateStr.split('-');
  const payDay = Number(payDayStr) || 1;

  const [targetYear, targetMonth] = monthKey.split('-').map(Number);
  const maxDays = new Date(targetYear, targetMonth, 0).getDate();
  const day = Math.min(payDay, maxDays);

  const formattedMonth = String(targetMonth).padStart(2, '0');
  const formattedDay = String(day).padStart(2, '0');

  return `${targetYear}-${formattedMonth}-${formattedDay}`;
}

function isBeforeMonth(monthKey: string, pivotMonthKey: string) {
  return monthKey.localeCompare(pivotMonthKey) < 0;
}

function getFirstMonthMultiplier(reportBDate: string | null) {
  if (!reportBDate) {
    return 1;
  }

  const reportDay = parseISO(reportBDate).getDate();
  return reportDay === 1 ? 1 : 0.5;
}

function getEnrollmentTuitionForMonth(
  enrollment: { reportBDate: string | null },
  monthKey: string,
  fallbackReportBDate: string | null,
) {
  const effectiveReportBDate = enrollment.reportBDate ?? fallbackReportBDate;
  if (!effectiveReportBDate) {
    return TUITION_PER_SUBJECT_PER_MONTH;
  }

  const reportBMonthKey = toMonthKey(effectiveReportBDate);
  if (isBeforeMonth(monthKey, reportBMonthKey)) {
    return 0;
  }

  return reportBMonthKey === monthKey
    ? TUITION_PER_SUBJECT_PER_MONTH * getFirstMonthMultiplier(effectiveReportBDate)
    : TUITION_PER_SUBJECT_PER_MONTH;
}

function normalizeProfileText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function toBirthDateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function calculateStudentTuitionForMonth(
  student: ApiStudent,
  monthKey: string,
  activeEnrollments: Array<{ reportBDate: string | null }>,
) {
  const enrollmentsToCharge = activeEnrollments.length > 0 ? activeEnrollments : student.enrollments;
  if (enrollmentsToCharge.length === 0) {
    return 0;
  }

  return enrollmentsToCharge.reduce((total, enrollment) => (
    total + getEnrollmentTuitionForMonth(enrollment, monthKey, student.reportBDate)
  ), 0);
}

function StudentsPageContent() {
  const searchParams = useSearchParams();

  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [classGroups, setClassGroups] = useState<ApiClassGroup[]>([]);
  const [financeItems, setFinanceItems] = useState<ApiFinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [trialStatusFilter, setTrialStatusFilter] = useState<TrialStatusFilter>('all');
  const [tuitionStatusFilter, setTuitionStatusFilter] = useState<TuitionStatusFilter>('all');
  const [reportBMonthFilter, setReportBMonthFilter] = useState<string>('all');
  const [reportBYearFilter, setReportBYearFilter] = useState<string>('all');
  const [leaveDateFilter, setLeaveDateFilter] = useState<string>('');

  const [birthdayFilter, setBirthdayFilter] = useState<BirthdayFilter>('all');
  const [tuitionMonthFilter, setTuitionMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    birthDate: '',
    gender: GENDER_MALE as Gender,
    fatherFullName: '',
    fatherPhone: '',
    motherFullName: '',
    motherPhone: '',
    address: '',
  });
  const [editEnrollmentIds, setEditEnrollmentIds] = useState<Partial<Record<SubjectCode, number>>>({});
  const [editSubjectAdmissionDates, setEditSubjectAdmissionDates] = useState<Partial<Record<SubjectCode, string>>>({});
  const [editSubjectReportBDates, setEditSubjectReportBDates] = useState<Partial<Record<SubjectCode, string>>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectCode[]>(['MATH']);
  const [subjectAdmissionDates, setSubjectAdmissionDates] = useState<Partial<Record<SubjectCode, string>>>({ MATH: TODAY_ISO });
  const [subjectReportBDates, setSubjectReportBDates] = useState<Partial<Record<SubjectCode, string>>>({});
  const [admissionRegistrationType, setAdmissionRegistrationType] = useState<AdmissionRegistrationType>('Chinh thuc');
  const [officialIntakeSource, setOfficialIntakeSource] = useState<IntakeSource>('new');
  const [admissionFeePaid, setAdmissionFeePaid] = useState(false);
  const [admissionFeePromotion, setAdmissionFeePromotion] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState<ApiStudent | null>(null);
  const [assignmentValues, setAssignmentValues] = useState<Partial<Record<SubjectCode, SubjectAssignmentValue>>>({});
  const [savingAssign, setSavingAssign] = useState(false);

  const [dropoutOpen, setDropoutOpen] = useState(false);
  const [dropoutStudent, setDropoutStudent] = useState<ApiStudent | null>(null);
  const [dropoutDate, setDropoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [dropoutMode, setDropoutMode] = useState<'all' | 'subjects'>('all');
  const [dropoutSubject, setDropoutSubject] = useState<SubjectCode>('MATH');
  const [dropoutEnrollmentIds, setDropoutEnrollmentIds] = useState<number[]>([]);

  const [reenrollOpen, setReenrollOpen] = useState(false);
  const [reenrollStudent, setReenrollStudent] = useState<ApiStudent | null>(null);
  const [reenrollDate, setReenrollDate] = useState(new Date().toISOString().slice(0, 10));
  const [reenrollSubject, setReenrollSubject] = useState<SubjectCode>('MATH');
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [addSubjectStudent, setAddSubjectStudent] = useState<ApiStudent | null>(null);
  const [addSubjectCode, setAddSubjectCode] = useState<SubjectCode>('EFL');
  const [addSubjectStartDate, setAddSubjectStartDate] = useState(TODAY_ISO);
  const [addSubjectReportBDate, setAddSubjectReportBDate] = useState('');
  const [addSubjectRegistrationType, setAddSubjectRegistrationType] = useState<AdmissionRegistrationType>('Chinh thuc');
  const [savingAddSubject, setSavingAddSubject] = useState(false);
  const [newAdmissionOpen, setNewAdmissionOpen] = useState(false);
  const [newAdmissionStudent, setNewAdmissionStudent] = useState<ApiStudent | null>(null);
  const [newAdmissionSubject, setNewAdmissionSubject] = useState<SubjectCode>('MATH');
  const [newAdmissionStartDate, setNewAdmissionStartDate] = useState(TODAY_ISO);
  const [newAdmissionReportBDate, setNewAdmissionReportBDate] = useState('');
  const [newAdmissionFeePaid, setNewAdmissionFeePaid] = useState(false);
  const [savingNewAdmission, setSavingNewAdmission] = useState(false);
  const [officialAdmissionOpen, setOfficialAdmissionOpen] = useState(false);
  const [officialAdmissionStudent, setOfficialAdmissionStudent] = useState<ApiStudent | null>(null);
  const [officialAdmissionDate, setOfficialAdmissionDate] = useState(TODAY_ISO);
  const [officialAdmissionMode, setOfficialAdmissionMode] = useState<OfficialAdmissionMode>('all');
  const [officialAdmissionSubjects, setOfficialAdmissionSubjects] = useState<SubjectCode[]>([]);
  const [savingOfficialAdmission, setSavingOfficialAdmission] = useState(false);
  const [tuitionDialogOpen, setTuitionDialogOpen] = useState(false);
  const [tuitionStep, setTuitionStep] = useState<'form' | 'confirm'>('form');
  const [revertConfirmDialogOpen, setRevertConfirmDialogOpen] = useState(false);
  const [revertTargetRow, setRevertTargetRow] = useState<(typeof tuitionRows)[number] | null>(null);
  const [savingTuitionPayment, setSavingTuitionPayment] = useState(false);
  const [savingRevertTuition, setSavingRevertTuition] = useState(false);
  const [admissionConfirmDialogOpen, setAdmissionConfirmDialogOpen] = useState(false);
  const [savingAdmission, setSavingAdmission] = useState(false);
  const [tuitionDiscount50, setTuitionDiscount50] = useState(false);
  const [tuitionFree, setTuitionFree] = useState(false);
  const [tuitionCustomAmount, setTuitionCustomAmount] = useState<string>('');
  const [tuitionStudent, setTuitionStudent] = useState<ApiStudent | null>(null);
  const [selectedPaymentMonths, setSelectedPaymentMonths] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tiền mặt');
  const [paymentDate, setPaymentDate] = useState(TODAY_ISO);
  const [prefilledLeadId, setPrefilledLeadId] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const activeTabFromQuery = searchParams.get('tab');
  const leadIdFromQuery = Number(searchParams.get('leadId') ?? '');
  const currentTab: StudentTab = studentTabs.includes(activeTabFromQuery as StudentTab) ? (activeTabFromQuery as StudentTab) : 'hoc-vien';

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsRes, classesRes, financeRes] = await Promise.all([
          fetch('/api/hoc-vien', { cache: 'no-store' }),
          fetch('/api/lop-hoc', { cache: 'no-store' }),
          fetch('/api/tai-chinh', { cache: 'no-store' }),
        ]);

        if (!studentsRes.ok) throw new Error('Không thể tải danh sách học viên');
        setStudents((await studentsRes.json()) as ApiStudent[]);

        if (classesRes.ok) {
          const classPayload = (await classesRes.json()) as { classGroups?: ApiClassGroup[] };
          setClassGroups(classPayload.classGroups ?? []);
        }

        if (financeRes.ok) {
          setFinanceItems((await financeRes.json()) as ApiFinanceItem[]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Co loi xay ra');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (currentTab !== 'nhap-hoc') return;
    if (!Number.isFinite(leadIdFromQuery) || leadIdFromQuery <= 0) return;
    if (prefilledLeadId === leadIdFromQuery) return;

    let isCancelled = false;

    const loadLeadPrefill = async () => {
      try {
        const response = await fetch(`/api/tu-van/leads/${leadIdFromQuery}`, { cache: 'no-store' });
        if (!response.ok) return;

        const lead = (await response.json()) as ApiLeadPrefill;
        if (isCancelled) return;

        setForm((current) => ({
          ...current,
          fullName: current.fullName || lead.fullName,
          fatherFullName: current.fatherFullName || lead.parentName || '',
          fatherPhone: current.fatherPhone || lead.parentPhone || '',
        }));

        if (Array.isArray(lead.preferredSubjects) && lead.preferredSubjects.length > 0) {
          setSelectedSubjects(lead.preferredSubjects);
          setSubjectAdmissionDates((current) => {
            const next = { ...current };
            lead.preferredSubjects.forEach((subject) => {
              next[subject] = next[subject] ?? TODAY_ISO;
            });
            return next;
          });
        }

        setPrefilledLeadId(lead.id);
      } catch {
        // Ignore prefill errors and keep manual intake flow working.
      }
    };

    void loadLeadPrefill();
    return () => {
      isCancelled = true;
    };
  }, [currentTab, leadIdFromQuery, prefilledLeadId]);

  const officialStudents = useMemo(
    () => students
      .filter((student) => student.enrollments.some((enrollment) => (
        isEnrollmentActive(enrollment) && enrollment.registrationType === 'Chính thức'
      )))
      .map((student) => ({
        ...student,
        status: STATUS_OFFICIAL,
        enrollments: student.enrollments.filter((enrollment) => (
          isEnrollmentActive(enrollment) && enrollment.registrationType === 'Chính thức'
        )),
      })),
    [students]
  );
  const leaveStudents = useMemo(
    () => students
      .filter((student) => student.enrollments.some((enrollment) => isEnrollmentDropped(enrollment)))
      .map((student) => ({
        ...student,
        status: STATUS_DROPPED,
        enrollments: student.enrollments.filter((enrollment) => isEnrollmentDropped(enrollment)),
      })),
    [students]
  );
  const trialStudents = useMemo(
    () => students
      .map((student) => {
        const activeTrialEnrollments = student.enrollments.filter((enrollment) => (
          isEnrollmentActive(enrollment) && enrollment.registrationType === 'Học thử'
        ));

        if (activeTrialEnrollments.length === 0) {
          return null;
        }

        const firstTrialStart = activeTrialEnrollments
          .map((enrollment) => enrollment.startDate)
          .sort((a, b) => a.localeCompare(b))[0] ?? student.admissionDate;
        const daysLeft = 14 - differenceInCalendarDays(startOfDay(new Date()), startOfDay(parseISO(firstTrialStart)));

        return {
          ...student,
          status: daysLeft < 0 ? STATUS_EXPIRED : STATUS_TRIAL,
          enrollments: activeTrialEnrollments,
        };
      })
      .filter((student): student is ApiStudent => Boolean(student)),
    [students]
  );

  const matchesSearch = useCallback((student: ApiStudent) => (
    search.trim().length === 0 ||
    student.fullName.toLowerCase().includes(search.trim().toLowerCase()) ||
    (student.fatherFullName ?? '').toLowerCase().includes(search.trim().toLowerCase()) ||
    (student.motherFullName ?? '').toLowerCase().includes(search.trim().toLowerCase()) ||
    (student.fatherPhone ?? '').includes(search.trim()) ||
    (student.motherPhone ?? '').includes(search.trim())
  ), [search]);

  const matchesReportBMonth = useCallback((student: ApiStudent) => {
    if (reportBMonthFilter === 'all' && reportBYearFilter === 'all') return true;
    const subjectReportDates = student.enrollments
      .map((enrollment) => enrollment.reportBDate)
      .filter((value): value is string => Boolean(value));
    const candidateDates = student.reportBDate ? [student.reportBDate, ...subjectReportDates] : subjectReportDates;
    if (candidateDates.length === 0) return false;

    return candidateDates.some((dateValue) => {
      const reportBDate = parseISO(dateValue);
      const monthOk = reportBMonthFilter === 'all' || reportBDate.getMonth() + 1 === Number(reportBMonthFilter);
      const yearOk = reportBYearFilter === 'all' || reportBDate.getFullYear() === Number(reportBYearFilter);
      return monthOk && yearOk;
    });
  }, [reportBMonthFilter, reportBYearFilter]);

  const reportBYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    students.forEach((student) => {
      if (!student.reportBDate) return;
      years.add(parseISO(student.reportBDate).getFullYear());
      student.enrollments.forEach((enrollment) => {
        if (!enrollment.reportBDate) return;
        years.add(parseISO(enrollment.reportBDate).getFullYear());
      });
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [students]);

  const filteredOfficialStudents = useMemo(
    () => officialStudents.filter((s) => matchesSearch(s) && matchesReportBMonth(s)),
    [officialStudents, matchesSearch, matchesReportBMonth]
  );

  const filteredLeaveStudents = useMemo(
    () => leaveStudents.filter((s) => {
      if (!matchesSearch(s)) return false;
      if (!leaveDateFilter) return true;
      return s.enrollments.some((enrollment) =>
        isEnrollmentDropped(enrollment) && enrollment.endDate && enrollment.endDate.slice(0, 7) === leaveDateFilter
      );
    }),
    [leaveStudents, matchesSearch, leaveDateFilter]
  );

  const filteredTrialStudents = useMemo(
    () => trialStudents.filter((s) => {
      const statusOk = trialStatusFilter === 'all' || s.status === trialStatusFilter;
      return matchesSearch(s) && statusOk;
    }),
    [trialStudents, matchesSearch, trialStatusFilter]
  );

  useEffect(() => {
    setSelectedStudentId(null);
  }, [currentTab]);

  useEffect(() => {
    const currentList =
      currentTab === 'hoc-vien'
        ? filteredOfficialStudents
        : currentTab === 'hoc-thu'
          ? filteredTrialStudents
          : currentTab === 'nghi-hoc'
            ? filteredLeaveStudents
            : [];

    if (currentList.length === 0) {
      setSelectedStudentId(null);
      return;
    }

    const stillExists = selectedStudentId !== null && currentList.some((student) => student.id === selectedStudentId);
    if (!stillExists) {
      setSelectedStudentId(null);
    }
  }, [currentTab, filteredOfficialStudents, filteredTrialStudents, filteredLeaveStudents, selectedStudentId]);

  const selectedOfficialStudent = useMemo(
    () => filteredOfficialStudents.find((student) => student.id === selectedStudentId) ?? null,
    [filteredOfficialStudents, selectedStudentId]
  );

  const selectedTrialStudent = useMemo(
    () => filteredTrialStudents.find((student) => student.id === selectedStudentId) ?? null,
    [filteredTrialStudents, selectedStudentId]
  );

  const selectedLeaveStudent = useMemo(
    () => filteredLeaveStudents.find((student) => student.id === selectedStudentId) ?? null,
    [filteredLeaveStudents, selectedStudentId]
  );

  const closeStudentPanel = useCallback(() => {
    setSelectedStudentId(null);
  }, []);

  const handleEditFromPanel = (student: ApiStudent) => {
    closeStudentPanel();
    startEdit(student);
  };

  const handleAssignFromPanel = (student: ApiStudent) => {
    closeStudentPanel();
    openAssignDialog(student);
  };

  const handleDropoutFromPanel = (student: ApiStudent) => {
    closeStudentPanel();
    openDropoutDialog(student);
  };

  const handleReenrollFromPanel = (student: ApiStudent) => {
    closeStudentPanel();
    openReenrollDialog(student);
  };

  const handleNewAdmissionFromPanel = (student: ApiStudent) => {
    closeStudentPanel();

    const candidateSubjects = SUBJECT_OPTIONS.filter((subject) =>
      !student.enrollments.some((enrollment) => enrollment.subjectCode === subject)
    );

    if (candidateSubjects.length === 0) {
      setError('Học viên đã từng học đủ các môn tại trung tâm. Vui lòng dùng Nhập học lại.');
      return;
    }

    setNewAdmissionStudent(student);
    setNewAdmissionSubject(candidateSubjects[0]);
    setNewAdmissionStartDate(TODAY_ISO);
    setNewAdmissionReportBDate('');
    setNewAdmissionFeePaid(false);
    setNewAdmissionOpen(true);
  };

  const handleRegisterOfficialFromPanel = (student: ApiStudent) => {
    closeStudentPanel();
    openOfficialAdmissionDialog(student);
  };

  async function updateStudentStatus(studentId: number, status: StudentStatus) {
    const response = await fetch(`/api/hoc-vien/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error('Không thể cập nhật trạng thái học viên');
    }
  }

  async function updateEnrollment(enrollmentId: number, payload: Record<string, unknown>) {
    const response = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Không thể cập nhật đăng ký môn học');
    }
  }

  const birthdayList = useMemo(() => {
    const currentMonth = new Date().getMonth();
    return students
      .filter((s) => s.birthDate && parseISO(s.birthDate).getMonth() === currentMonth)
      .map((s) => ({ ...s, ...getBirthdayInfo(s.birthDate ?? s.admissionDate) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [students]);

  const stats = useMemo(() => {
    const officialEnrollmentCount = officialStudents.reduce((total, student) => total + student.enrollments.length, 0);
    const trialEnrollmentCount = trialStudents.reduce((total, student) => total + student.enrollments.length, 0);
    const droppedEnrollmentCount = leaveStudents.reduce((total, student) => total + student.enrollments.length, 0);

    return [
      {
        label: 'Sinh nhật trong tháng',
        value: students.filter((s) => s.birthDate && parseISO(s.birthDate).getMonth() === new Date().getMonth()).length,
      },
      { label: 'Chính thức (lượt môn)', value: officialEnrollmentCount },
      { label: 'Học thử (lượt môn)', value: trialEnrollmentCount },
      { label: 'Nghỉ học (lượt môn)', value: droppedEnrollmentCount },
    ];
  }, [students, officialStudents, trialStudents, leaveStudents]);

  const availablePaymentMonths = useMemo(() => {
    const result: Array<{ key: string; label: string; month: number; year: number }> = [];
    const [yearStr, monthStr] = tuitionMonthFilter.split('-');
    const baseYear = Number(yearStr);
    const baseMonth = Number(monthStr);
    const base = new Date(baseYear, baseMonth - 1, 1);

    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = `${year}-${String(month).padStart(2, '0')}`;
      result.push({ key, label: `Tháng ${month}/${year}`, month, year });
    }

    return result;
  }, [tuitionMonthFilter]);

  const selectedFilterMonthKey = tuitionMonthFilter;

  const parseTuitionFinanceItem = useCallback((item: ApiFinanceItem) => {
    const note = item.note?.trim();
    if (!note?.startsWith(TUITION_NOTE_PREFIX)) {
      return null;
    }

    const studentIdMatch = /studentId=(\d+)/.exec(note);
    if (!studentIdMatch) {
      return null;
    }

    const monthMatch = /month=(\d{4}-\d{2})/.exec(note);
    const month = monthMatch?.[1] ?? item.spentAt.slice(0, 7);
    const methodMatch = /method=([^;]+)/.exec(note);

    return {
      studentId: Number(studentIdMatch[1]),
      month,
      method: methodMatch ? methodMatch[1] : 'Không rõ',
    };
  }, []);

  const paidMap = useMemo(() => {
    const map = new Set<string>();
    financeItems.forEach((item) => {
      const parsed = parseTuitionFinanceItem(item);
      if (!parsed) {
        return;
      }

      map.add(`${parsed.studentId}-${parsed.month}`);
    });
    return map;
  }, [financeItems, parseTuitionFinanceItem]);

  const tuitionPaymentDetailsMap = useMemo(() => {
    const map = new Map<string, { financeItemId: number; paymentDate: string; paymentMethod: string; amount: number }>();
    financeItems.forEach((item) => {
      const parsed = parseTuitionFinanceItem(item);
      if (!parsed) {
        return;
      }

      map.set(`${parsed.studentId}-${parsed.month}`, {
        financeItemId: item.id,
        paymentDate: item.spentAt.slice(0, 10),
        paymentMethod: parsed.method,
        amount: item.amount,
      });
    });
    return map;
  }, [financeItems, parseTuitionFinanceItem]);

  const hasAdmissionFeeRecorded = useCallback((studentId: number) => (
    financeItems.some((item) =>
      item.note?.startsWith('[ADMISSION_FEE]') && item.note.includes(`studentId=${studentId}`)
    )
  ), [financeItems]);

  const hasOfficialEnrollment = useCallback((student: ApiStudent) => (
    student.status === STATUS_OFFICIAL || student.enrollments.some((enrollment) => (
      isEnrollmentActive(enrollment) && enrollment.registrationType === 'Chính thức'
    ))
  ), []);

  const tuitionRows = useMemo(() => {
    return officialStudents
      .filter((student) => student.enrollments.length > 0)
      .map((student) => {
        const activeEnrollments = student.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
        const subjectCount = Math.max(1, activeEnrollments.length || student.enrollments.length);
        const estimatedAmount = calculateStudentTuitionForMonth(student, selectedFilterMonthKey, activeEnrollments);
        const key = `${student.id}-${selectedFilterMonthKey}`;
        const paid = paidMap.has(key);
        const paymentDetails = tuitionPaymentDetailsMap.get(key);
        return {
          student,
          subjectCount,
          estimatedAmount,
          paid,
          financeItemId: paymentDetails?.financeItemId ?? null,
          paidAmount: paymentDetails?.amount ?? 0,
          paymentDate: paymentDetails?.paymentDate ?? null,
          paymentMethod: paymentDetails?.paymentMethod ?? null,
        };
      })
      .filter((item) => item.estimatedAmount > 0)
      .filter((item) => matchesSearch(item.student))
      .filter((item) => {
        if (tuitionStatusFilter === 'all') return true;
        if (tuitionStatusFilter === 'paid') return item.paid;
        return !item.paid;
      })
      .sort((a, b) => Number(a.paid) - Number(b.paid));
  }, [officialStudents, paidMap, tuitionPaymentDetailsMap, selectedFilterMonthKey, matchesSearch, tuitionStatusFilter]);

  const tuitionTotal = useMemo(() => tuitionRows.reduce((total, row) => total + row.estimatedAmount, 0), [tuitionRows]);

  const tuitionPaidTotal = useMemo(() => {
    return tuitionRows
      .filter((row) => row.paid)
      .reduce((total, row) => total + row.paidAmount, 0);
  }, [tuitionRows]);

  const admissionFeeTotal = useMemo(() => {
    return financeItems.reduce((total, item) => {
      if (!item.note?.startsWith('[ADMISSION_FEE]')) {
        return total;
      }

      const spentAtMonth = item.spentAt.slice(0, 7);
      if (spentAtMonth !== selectedFilterMonthKey) {
        return total;
      }

      return total + item.amount;
    }, 0);
  }, [financeItems, selectedFilterMonthKey]);

  const tuitionDialogAmount = useMemo(() => {
    if (!tuitionStudent) {
      return 0;
    }

    const activeEnrollments = tuitionStudent.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
    return selectedPaymentMonths.reduce(
      (total, monthKey) => total + calculateStudentTuitionForMonth(tuitionStudent, monthKey, activeEnrollments),
      0,
    );
  }, [selectedPaymentMonths, tuitionStudent]);

  useEffect(() => {
    let finalAmount = tuitionDialogAmount;
    if (tuitionFree) {
      finalAmount = 0;
    } else if (tuitionDiscount50) {
      finalAmount = finalAmount / 2;
    }
    setTuitionCustomAmount(finalAmount.toString());
  }, [tuitionDialogAmount, tuitionDiscount50, tuitionFree]);

  async function refreshStudents() {
    const response = await fetch('/api/hoc-vien', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không thể tải danh sách học viên');
    setStudents((await response.json()) as ApiStudent[]);
  }

  async function refreshFinanceItems() {
    const response = await fetch('/api/tai-chinh', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu học phí');
    }
    setFinanceItems((await response.json()) as ApiFinanceItem[]);
  }

  function parseStudyDays(studyDays: string, fallbackShift: ShiftOption): { selectedWeekdays: Weekday[]; shiftsByWeekday: Partial<Record<Weekday, ShiftOption>> } {
    const selectedWeekdays: Weekday[] = [];
    const shiftsByWeekday: Partial<Record<Weekday, ShiftOption>> = {};

    const serializedMatches = Array.from(studyDays.matchAll(/(T[2-7])\s*\((Ca\s[1-5])\)/g));
    if (serializedMatches.length > 0) {
      serializedMatches.forEach((match) => {
        const weekday = match[1] as Weekday;
        const shift = match[2] as ShiftOption;
        if (!selectedWeekdays.includes(weekday)) selectedWeekdays.push(weekday);
        shiftsByWeekday[weekday] = shift;
      });
      return { selectedWeekdays, shiftsByWeekday };
    }

    const plainWeekdays = Array.from(new Set((studyDays.match(/T[2-7]/g) ?? []) as Weekday[]));
    plainWeekdays.forEach((weekday) => {
      selectedWeekdays.push(weekday);
      shiftsByWeekday[weekday] = fallbackShift;
    });
    return { selectedWeekdays, shiftsByWeekday };
  }

  function buildStudyDays(selectedWeekdays: Weekday[], shiftsByWeekday: Partial<Record<Weekday, ShiftOption>>): string {
    return selectedWeekdays.map((weekday) => `${weekday}(${shiftsByWeekday[weekday] ?? 'Ca 1'})`).join(', ');
  }

  function toggleSubject(subjectCode: SubjectCode, checked: boolean) {
    setSelectedSubjects((current) => {
      if (checked) {
        setSubjectAdmissionDates((dateMap) => ({
          ...dateMap,
          [subjectCode]: dateMap[subjectCode] ?? form.admissionDate ?? TODAY_ISO,
        }));
        return current.includes(subjectCode) ? current : [...current, subjectCode];
      }
      if (current.length === 1) return current;
      setSubjectAdmissionDates((dateMap) => {
        const next = { ...dateMap };
        delete next[subjectCode];
        return next;
      });
      setSubjectReportBDates((dateMap) => {
        const next = { ...dateMap };
        delete next[subjectCode];
        return next;
      });
      return current.filter((subject) => subject !== subjectCode);
    });
  }

  function startEdit(student: ApiStudent) {
    const enrollmentIds: Partial<Record<SubjectCode, number>> = {};
    const subjectAdmissions: Partial<Record<SubjectCode, string>> = {};
    const subjectReportBs: Partial<Record<SubjectCode, string>> = {};

    student.enrollments.forEach((enrollment) => {
      if (!enrollmentIds[enrollment.subjectCode]) {
        enrollmentIds[enrollment.subjectCode] = enrollment.id;
      }
      if (!subjectAdmissions[enrollment.subjectCode]) {
        subjectAdmissions[enrollment.subjectCode] = enrollment.startDate.slice(0, 10);
      }
      if (!subjectReportBs[enrollment.subjectCode] && enrollment.reportBDate) {
        subjectReportBs[enrollment.subjectCode] = enrollment.reportBDate.slice(0, 10);
      }
    });

    setEditingStudentId(student.id);
    setEditForm({
      fullName: student.fullName,
      birthDate: student.birthDate ? student.birthDate.slice(0, 10) : '',
      gender: student.gender,
      fatherFullName: student.fatherFullName ?? '',
      fatherPhone: student.fatherPhone ?? '',
      motherFullName: student.motherFullName ?? '',
      motherPhone: student.motherPhone ?? '',
      address: student.address ?? '',
    });
    setEditEnrollmentIds(enrollmentIds);
    setEditSubjectAdmissionDates(subjectAdmissions);
    setEditSubjectReportBDates(subjectReportBs);
    setEditOpen(true);
  }

  async function submitEditStudent() {
    if (!editingStudentId) {
      return;
    }

    try {
      const activeSubjectAdmissions = Object.values(editSubjectAdmissionDates).filter((value): value is string => Boolean(value));
      const admissionDate = activeSubjectAdmissions.sort((a, b) => a.localeCompare(b))[0] ?? TODAY_ISO;

      const activeSubjectReportB = Object.values(editSubjectReportBDates).filter((value): value is string => Boolean(value));
      const studentReportBDate = activeSubjectReportB.sort((a, b) => a.localeCompare(b))[0] ?? null;

      const response = await fetch(`/api/hoc-vien/${editingStudentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName,
          birthDate: editForm.birthDate || null,
          gender: editForm.gender,
          admissionDate,
          reportB: Boolean(studentReportBDate),
          reportBDate: studentReportBDate,
          fatherFullName: editForm.fatherFullName,
          fatherPhone: editForm.fatherPhone,
          motherFullName: editForm.motherFullName,
          motherPhone: editForm.motherPhone,
          address: editForm.address,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật thông tin học viên');
      }

      const enrollmentUpdateRequests = (Object.keys(editEnrollmentIds) as SubjectCode[])
        .filter((subjectCode) => Boolean(editEnrollmentIds[subjectCode]))
        .map((subjectCode) =>
          fetch(`/api/enrollments/${editEnrollmentIds[subjectCode]}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: editSubjectAdmissionDates[subjectCode] || admissionDate,
              reportBDate: editSubjectReportBDates[subjectCode] || null,
            }),
          })
        );

      if (enrollmentUpdateRequests.length > 0) {
        const enrollmentResponses = await Promise.all(enrollmentUpdateRequests);
        if (enrollmentResponses.some((item) => !item.ok)) {
          throw new Error('Không thể cập nhật ngày nhập học/Report B theo môn');
        }
      }

      setEditOpen(false);
      setEditingStudentId(null);
      setEditEnrollmentIds({});
      setEditSubjectAdmissionDates({});
      setEditSubjectReportBDates({});
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi cập nhật học viên');
    }
  }

  function openTuitionDialog(student: ApiStudent) {
    setTuitionStudent(student);
    setSelectedPaymentMonths([tuitionMonthFilter]);
    setPaymentMethod('Tiền mặt');
    setPaymentDate(TODAY_ISO);
    setTuitionDiscount50(false);
    setTuitionFree(false);
    
    const activeEnrollments = student.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
    const amount = calculateStudentTuitionForMonth(student, tuitionMonthFilter, activeEnrollments);
    setTuitionCustomAmount(amount.toString());
    setTuitionStep('form');
    setTuitionDialogOpen(true);
  }

  function handleOpenTuitionConfirm() {
    if (!tuitionStudent || selectedPaymentMonths.length === 0) {
      setError('Vui lòng chọn ít nhất 1 tháng cần thu học phí');
      return;
    }
    const parsedAmount = Number(String(tuitionCustomAmount).replace(/\D/g, ''));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Số tiền đóng học phí không hợp lệ');
      return;
    }
    setError('');
    setTuitionStep('confirm');
  }

  async function submitTuitionPayment() {
    if (!tuitionStudent || selectedPaymentMonths.length === 0) {
      setError('Vui lòng chọn ít nhất 1 tháng cần thu học phí');
      return;
    }

    setSavingTuitionPayment(true);
    try {
      const activeEnrollments = tuitionStudent.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
      const subjectCount = Math.max(1, activeEnrollments.length || tuitionStudent.enrollments.length);

      const parsedCustomAmount = Number(String(tuitionCustomAmount).replace(/\D/g, ''));
      const amountPerMonth = Math.round(parsedCustomAmount / selectedPaymentMonths.length);

      const requests = selectedPaymentMonths.map((monthKey, index) => {
        const thisMonthAmount = index === selectedPaymentMonths.length - 1 
          ? parsedCustomAmount - amountPerMonth * (selectedPaymentMonths.length - 1)
          : amountPerMonth;

        const spentAtForMonth = computeSpentAtForMonth(paymentDate, monthKey);

        return fetch('/api/tai-chinh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'Khác',
            amount: thisMonthAmount,
            spentAt: spentAtForMonth,
            note: `${TUITION_NOTE_PREFIX} studentId=${tuitionStudent.id};month=${monthKey};method=${paymentMethod};subjects=${subjectCount}`,
            proofImage: null,
            skipNotification: true,
          }),
        });
      });

      const responses = await Promise.all(requests);
      if (responses.some((response) => !response.ok)) {
        throw new Error('Không thể lưu học phí cho một số tháng');
      }

      const notifyResponse = await fetch(`/api/hoc-vien/${tuitionStudent.id}/notify-tuition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          months: selectedPaymentMonths,
          totalAmount: parsedCustomAmount,
        }),
      });

      if (!notifyResponse.ok) {
        throw new Error('Đã lưu học phí nhưng không thể gửi thông báo thu học phí');
      }

      await refreshFinanceItems();
      setTuitionDialogOpen(false);
      setTuitionStep('form');
      setTuitionStudent(null);
      setSelectedPaymentMonths([]);
      setTuitionDiscount50(false);
      setTuitionFree(false);
      setTuitionCustomAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi đóng học phí');
    } finally {
      setSavingTuitionPayment(false);
    }
  }

  function handleOpenRevertConfirm(row: (typeof tuitionRows)[number]) {
    if (!row.financeItemId) {
      return;
    }
    setRevertTargetRow(row);
    setRevertConfirmDialogOpen(true);
  }

  async function confirmRevertTuition() {
    if (!revertTargetRow?.financeItemId) {
      return;
    }

    setSavingRevertTuition(true);
    try {
      const response = await fetch(`/api/tai-chinh/${revertTargetRow.financeItemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể hoàn tác đóng học phí');
      }

      await refreshFinanceItems();
      await refreshStudents();
      setRevertConfirmDialogOpen(false);
      setRevertTargetRow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi hoàn tác đóng học phí');
    } finally {
      setSavingRevertTuition(false);
    }
  }

  function openAssignDialog(student: ApiStudent) {
    const initial: Partial<Record<SubjectCode, SubjectAssignmentValue>> = {};
    student.enrollments.forEach((enrollment) => {
      const parsed = parseStudyDays(enrollment.studyDays, enrollment.classShift as ShiftOption);
      const selectedWeekdays = parsed.selectedWeekdays.length > 0
        ? parsed.selectedWeekdays
        : enrollment.classGroup?.weekday
          ? [enrollment.classGroup.weekday as Weekday]
          : [];

      if (selectedWeekdays.length === 0) {
        const fallback = FIXED_CLASSES.find((item) => item.subjectCode === enrollment.subjectCode)?.weekday;
        if (fallback) selectedWeekdays.push(fallback);
      }

      selectedWeekdays.forEach((weekday) => {
        if (!parsed.shiftsByWeekday[weekday]) {
          const mappedGroup = classGroups.find((group) => group.subjectCode === enrollment.subjectCode && group.weekday === weekday);
          parsed.shiftsByWeekday[weekday] = (mappedGroup?.classShift as ShiftOption) ?? (enrollment.classShift as ShiftOption);
        }
      });

      initial[enrollment.subjectCode] = {
        enrollmentId: enrollment.id,
        registrationType: enrollment.registrationType,
        enrollmentType: enrollment.enrollmentType,
        startDate: enrollment.startDate,
        selectedWeekdays,
        shiftsByWeekday: parsed.shiftsByWeekday,
      };
    });

    setAssignmentValues(initial);
    setAssigningStudent(student);
    setAssignOpen(true);
  }

  function openDropoutDialog(student: ApiStudent) {
    const activeEnrollments = student.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
    const firstSubject = activeEnrollments[0]?.subjectCode ?? 'MATH';
    const initialIds = student.enrollments
      .filter((enrollment) => isEnrollmentActive(enrollment) && enrollment.subjectCode === firstSubject)
      .map((enrollment) => enrollment.id);

    setDropoutStudent(student);
    setDropoutDate(new Date().toISOString().slice(0, 10));
    setDropoutMode('subjects');
    setDropoutSubject(firstSubject);
    setDropoutEnrollmentIds(initialIds);
    setDropoutOpen(true);
  }

  function openReenrollDialog(student: ApiStudent) {
    const availableSubjects = Array.from(
      new Set(
        student.enrollments
          .filter((enrollment) => isEnrollmentDropped(enrollment))
          .map((enrollment) => enrollment.subjectCode)
      )
    );

    setReenrollStudent(student);
    setReenrollDate(new Date().toISOString().slice(0, 10));
    setReenrollSubject(availableSubjects[0] ?? 'MATH');
    setReenrollOpen(true);
  }

  function openAddSubjectDialog(student: ApiStudent) {
    const activeSubjects = new Set(
      student.enrollments
        .filter((enrollment) => isEnrollmentActive(enrollment))
        .map((enrollment) => enrollment.subjectCode)
    );

    const candidate = SUBJECT_OPTIONS.find((subject) => !activeSubjects.has(subject));
    if (!candidate) {
      setError('Học viên đã đăng ký đủ 2 môn đang hoạt động.');
      return;
    }

    setAddSubjectStudent(student);
    setAddSubjectCode(candidate);
    setAddSubjectStartDate(TODAY_ISO);
    setAddSubjectReportBDate('');
    setAddSubjectRegistrationType(student.status === STATUS_TRIAL ? 'Hoc thu' : 'Chinh thuc');
    setAddSubjectOpen(true);
  }



  async function submitAddSubject() {
    if (!addSubjectStudent) return;

    try {
      setSavingAddSubject(true);
      const existingEnrollment = addSubjectStudent.enrollments.find((enrollment) => enrollment.subjectCode === addSubjectCode) ?? null;

      if (existingEnrollment?.endDate) {
        const response = await fetch(`/api/enrollments/${existingEnrollment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registrationType: addSubjectRegistrationType,
            startDate: addSubjectStartDate,
            reportBDate: addSubjectReportBDate || null,
            endDate: null,
          }),
        });

        if (!response.ok) {
          throw new Error('Không thể mở lại môn học đã từng nghỉ');
        }
      } else {
        const response = await fetch('/api/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: addSubjectStudent.id,
            classGroupId: null,
            subjectCode: addSubjectCode,
            registrationType: addSubjectRegistrationType,
            enrollmentType: '2 buổi/tuần',
            studyDays: 'T2',
            classShift: 'Ca 1',
            startDate: addSubjectStartDate,
            reportBDate: addSubjectReportBDate || null,
            endDate: null,
          }),
        });

        if (!response.ok) {
          throw new Error('Không thể đăng ký môn học mới');
        }
      }

      setAddSubjectOpen(false);
      setAddSubjectStudent(null);
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi thêm môn học');
    } finally {
      setSavingAddSubject(false);
    }
  }

  async function submitNewAdmission() {
    if (!newAdmissionStudent) return;

    try {
      setSavingNewAdmission(true);

      const candidateSubjects = SUBJECT_OPTIONS.filter((subject) =>
        !newAdmissionStudent.enrollments.some((enrollment) => enrollment.subjectCode === subject)
      );
      if (!candidateSubjects.includes(newAdmissionSubject)) {
        throw new Error('Môn này đã từng học tại trung tâm, vui lòng dùng Nhập học lại');
      }

      const createResponse = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: newAdmissionStudent.id,
          classGroupId: null,
          subjectCode: newAdmissionSubject,
          registrationType: 'Chính thức',
          enrollmentType: '2 buổi/tuần',
          studyDays: 'T2',
          classShift: 'Ca 1',
          startDate: newAdmissionStartDate,
          reportBDate: newAdmissionReportBDate || null,
          endDate: null,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Không thể lưu nhập học mới');
      }

      if (newAdmissionFeePaid) {
        const admissionFeeRevenueDate = newAdmissionReportBDate
          ? `${newAdmissionReportBDate.slice(0, 7)}-01`
          : newAdmissionStartDate;

        const feeResponse = await fetch('/api/tai-chinh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'Khác',
            amount: 300000,
            spentAt: admissionFeeRevenueDate,
            note: `[ADMISSION_FEE] studentId=${newAdmissionStudent.id};source=new-subject;subject=${newAdmissionSubject}`,
            proofImage: null,
          }),
        });

        if (!feeResponse.ok) {
          throw new Error('Không thể ghi nhận phí nhập học');
        }
      }

      await updateStudentStatus(newAdmissionStudent.id, STATUS_OFFICIAL);
      setNewAdmissionOpen(false);
      setNewAdmissionStudent(null);
      setNewAdmissionFeePaid(false);
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi nhập học mới');
    } finally {
      setSavingNewAdmission(false);
    }
  }

  function getTrialDaysLeft(student: ApiStudent) {
    const trialEnrollment = student.enrollments.find((e) => e.registrationType === 'H\u1ecdc th\u1eed');
    const trialStart = trialEnrollment?.startDate ?? student.admissionDate;
    return 14 - differenceInCalendarDays(startOfDay(new Date()), startOfDay(parseISO(trialStart)));
  }

  async function submitAssignments() {
    if (!assigningStudent) return;
    setSavingAssign(true);

    try {
      const classGroupCache = new Map<string, ApiClassGroup>(
        classGroups.map((group) => [`${group.subjectCode}-${group.weekday}-${group.classShift}`, group] as const)
      );

      const ensureClassGroup = async (subjectCode: SubjectCode, weekday: Weekday, classShift: ShiftOption) => {
        const key = `${subjectCode}-${weekday}-${classShift}`;
        const existed = classGroupCache.get(key);
        if (existed) return existed;

        const fixed = FIXED_CLASSES.find((item) => item.subjectCode === subjectCode && item.weekday === weekday);
        const response = await fetch('/api/lop-hoc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: `${fixed?.name ?? `${subjectCode}-${weekday}`} - ${formatClassShiftByWeekday(weekday, classShift as ClassShift)}`,
            subjectCode,
            weekday,
            classShift,
          }),
        });

        if (!response.ok) {
          throw new Error('Không thể tạo lớp học để gán đăng ký môn học');
        }

        const created = (await response.json()) as ApiClassGroup;
        const normalized: ApiClassGroup = {
          id: created.id,
          subjectCode: created.subjectCode,
          weekday: created.weekday,
          classShift: created.classShift,
          label: created.label,
        };
        classGroupCache.set(key, normalized);
        return normalized;
      };

      const updates = assigningStudent.enrollments.map(async (enrollment) => {
        const selected = assignmentValues[enrollment.subjectCode];
        if (!selected || selected.selectedWeekdays.length === 0) return;

        const primaryWeekday = selected.selectedWeekdays[0];
        const primaryShift = selected.shiftsByWeekday[primaryWeekday] ?? 'Ca 1';
        await Promise.all(
          selected.selectedWeekdays.map((weekday) => {
            const shift = selected.shiftsByWeekday[weekday] ?? 'Ca 1';
            return ensureClassGroup(enrollment.subjectCode, weekday, shift);
          })
        );

        const matchedClassGroup = await ensureClassGroup(enrollment.subjectCode, primaryWeekday, primaryShift);
        const serializedStudyDays = buildStudyDays(selected.selectedWeekdays, selected.shiftsByWeekday);

        const changed =
          enrollment.classGroup?.id !== matchedClassGroup.id ||
          enrollment.classShift !== primaryShift ||
          enrollment.studyDays !== serializedStudyDays;
        if (!changed) return;

        const response = await fetch(`/api/enrollments/${enrollment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classGroupId: matchedClassGroup.id,
            classShift: primaryShift,
            studyDays: serializedStudyDays,
          }),
        });

        if (!response.ok) {
          throw new Error('Không thể cập nhật xếp lớp cho một số môn');
        }
      });

      await Promise.all(updates);

      await refreshStudents();
      setClassGroups(Array.from(classGroupCache.values()));
      setAssignOpen(false);
      setAssigningStudent(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi xếp lớp');
    } finally {
      setSavingAssign(false);
    }
  }

  function handleOpenAdmissionConfirm() {
    try {
      if (!form.fullName.trim()) {
        throw new Error('Vui lòng nhập họ tên học viên');
      }

      if (selectedSubjects.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 môn học');
      }

      const missingAdmissionDate = selectedSubjects.find((subject) => !subjectAdmissionDates[subject]);
      if (missingAdmissionDate) {
        throw new Error(`Vui lòng nhập ngày nhập học cho môn ${missingAdmissionDate === 'MATH' ? 'Toán' : 'Tiếng Anh'}`);
      }

      const admissionFeeConfirmed = admissionFeePaid || admissionFeePromotion;
      if (admissionRegistrationType === 'Chinh thuc' && officialIntakeSource === 'new' && !admissionFeeConfirmed) {
        throw new Error('Vui lòng xác nhận đã đóng phí nhập học 300.000đ');
      }

      setError('');
      setAdmissionConfirmDialogOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi kiểm tra thông tin nhập học');
    }
  }

  async function submitStudent() {
    setSavingAdmission(true);
    try {
      if (selectedSubjects.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 môn học');
      }

      const missingAdmissionDate = selectedSubjects.find((subject) => !subjectAdmissionDates[subject]);
      if (missingAdmissionDate) {
        throw new Error(`Vui lòng nhập ngày nhập học cho môn ${missingAdmissionDate === 'MATH' ? 'Toán' : 'Tiếng Anh'}`);
      }

      const orderedAdmissionDates = selectedSubjects
        .map((subject) => subjectAdmissionDates[subject])
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => a.localeCompare(b));
      const studentAdmissionDate = orderedAdmissionDates[0] ?? form.admissionDate ?? TODAY_ISO;

      const orderedReportBDates = selectedSubjects
        .map((subject) => subjectReportBDates[subject])
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => a.localeCompare(b));
      const defaultReportBDate = orderedReportBDates[0] ?? null;
      const admissionFeeConfirmed = admissionFeePaid || admissionFeePromotion;

      if (admissionRegistrationType === 'Chinh thuc' && officialIntakeSource === 'new' && !admissionFeeConfirmed) {
        throw new Error('Vui lòng xác nhận đã đóng phí nhập học 300.000đ');
      }

      const statusFromAdmission = admissionRegistrationType === 'Hoc thu' ? STATUS_TRIAL : STATUS_OFFICIAL;
      const payload = {
        ...form,
        status: statusFromAdmission,
        admissionDate: studentAdmissionDate,
        birthDate: form.birthDate || null,
        reportB: Boolean(defaultReportBDate),
        reportBDate: defaultReportBDate,
        assignedStaffId: form.assignedStaffId ? Number(form.assignedStaffId) : null,
        intakeSource: statusFromAdmission === STATUS_OFFICIAL ? officialIntakeSource : null,
        admissionFeePaid: statusFromAdmission === STATUS_OFFICIAL && officialIntakeSource === 'new' ? admissionFeeConfirmed : false,
        admissionFeePromotion: statusFromAdmission === STATUS_OFFICIAL && officialIntakeSource === 'new' ? admissionFeePromotion : false,
        skipNotification: true,
      };

      const response = await fetch('/api/hoc-vien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Không thể lưu học viên');

      const savedStudent = (await response.json()) as { id: number };
      const targetStudentId = savedStudent.id;

      if (targetStudentId) {
        const subjectsToCreate = selectedSubjects;

        if (subjectsToCreate.length > 0) {
          const enrollmentRequests = subjectsToCreate.map(async (subjectCode) => {
            const registrationTypeText = admissionRegistrationType === 'Hoc thu' ? 'Học thử' : 'Chính thức';
            const startDateValue = subjectAdmissionDates[subjectCode] ?? studentAdmissionDate;
            const reportBDateValue = subjectReportBDates[subjectCode] || null;

            const createResponse = await fetch('/api/enrollments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: targetStudentId,
                classGroupId: null,
                subjectCode,
                registrationType: registrationTypeText,
                enrollmentType: '2 buổi/tuần',
                studyDays: 'T2',
                classShift: 'Ca 1',
                startDate: startDateValue,
                reportBDate: reportBDateValue,
                endDate: null,
              }),
            });

            if (!createResponse.ok) {
              throw new Error('Không thể tạo đăng ký cho một số môn học');
            }
          });

          await Promise.all(enrollmentRequests);
        }

        if (
          admissionRegistrationType === 'Chinh thuc' &&
          officialIntakeSource === 'new' &&
          admissionFeePaid &&
          !admissionFeePromotion &&
          !hasAdmissionFeeRecorded(targetStudentId)
        ) {
          const admissionFeeRevenueDate = defaultReportBDate
            ? `${defaultReportBDate.slice(0, 7)}-01`
            : studentAdmissionDate;
          const admissionFeeResponse = await fetch('/api/tai-chinh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'Khác',
              amount: 300000,
              spentAt: admissionFeeRevenueDate,
              note: `[ADMISSION_FEE] studentId=${targetStudentId};source=new-intake`,
              proofImage: null,
            }),
          });

          if (!admissionFeeResponse.ok) {
            throw new Error('Không thể ghi nhận phí nhập học');
          }
        }

        if (Number.isFinite(leadIdFromQuery) && leadIdFromQuery > 0) {
          await fetch(`/api/tu-van/leads/${leadIdFromQuery}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Đã đăng ký', convertedStudentId: targetStudentId }),
          });
        }

        const notifyResponse = await fetch(`/api/hoc-vien/${targetStudentId}/notify-new`, {
          method: 'POST',
        });

        if (!notifyResponse.ok) {
          throw new Error('Đã lưu học viên nhưng không thể gửi thông báo đăng ký mới');
        }
      }

      setAdmissionConfirmDialogOpen(false);
      setForm(emptyForm);
      setSelectedSubjects(['MATH']);
      setSubjectAdmissionDates({ MATH: TODAY_ISO });
      setSubjectReportBDates({});
      setAdmissionRegistrationType('Chinh thuc');
      setOfficialIntakeSource('new');
      setAdmissionFeePaid(false);
      setAdmissionFeePromotion(false);
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi lưu nhập học');
    } finally {
      setSavingAdmission(false);
    }
  }

  async function registerOfficial(student: ApiStudent) {
    try {
      await updateStudentStatus(student.id, STATUS_OFFICIAL);
      await Promise.all(
        student.enrollments.map((enrollment) =>
          updateEnrollment(enrollment.id, { registrationType: 'Chinh thuc' })
        )
      );
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đăng ký học chính thức');
    }
  }

  function openOfficialAdmissionDialog(student: ApiStudent) {
    const trialLikeSubjects = Array.from(
      new Set(
        student.enrollments
          .filter((enrollment) => isEnrollmentActive(enrollment))
          .filter((enrollment) => enrollment.registrationType === 'Học thử' || student.status === STATUS_EXPIRED || student.status === STATUS_TRIAL)
          .map((enrollment) => enrollment.subjectCode)
      )
    );

    setOfficialAdmissionStudent(student);
    setOfficialAdmissionDate(TODAY_ISO);
    setOfficialAdmissionMode('all');
    setOfficialAdmissionSubjects(trialLikeSubjects);
    setOfficialAdmissionOpen(true);
  }

  async function submitOfficialAdmission() {
    if (!officialAdmissionStudent) return;

    try {
      setSavingOfficialAdmission(true);
      const activeEnrollments = officialAdmissionStudent.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
      const hadOfficialBeforeAdmission = hasOfficialEnrollment(officialAdmissionStudent);
      const targetEnrollments = officialAdmissionMode === 'all'
        ? activeEnrollments
        : activeEnrollments.filter((enrollment) => officialAdmissionSubjects.includes(enrollment.subjectCode));

      const matchingOfficialStudent = students.find((student) => {
        if (student.id === officialAdmissionStudent.id) {
          return false;
        }

        const sameProfile =
          normalizeProfileText(student.fullName) === normalizeProfileText(officialAdmissionStudent.fullName) &&
          toBirthDateKey(student.birthDate) === toBirthDateKey(officialAdmissionStudent.birthDate) &&
          student.gender === officialAdmissionStudent.gender;

        if (!sameProfile) {
          return false;
        }

        return student.enrollments.some((enrollment) => (
          isEnrollmentActive(enrollment) && enrollment.registrationType === 'Chính thức'
        ));
      }) ?? null;

      if (targetEnrollments.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 môn để nhập học chính thức');
      }

      if (matchingOfficialStudent) {
        await Promise.all(
          targetEnrollments.map(async (enrollment) => {
            const existingOfficialEnrollment = matchingOfficialStudent.enrollments.find((item) => item.subjectCode === enrollment.subjectCode) ?? null;

            if (!existingOfficialEnrollment) {
              await updateEnrollment(enrollment.id, {
                studentId: matchingOfficialStudent.id,
                registrationType: 'Chinh thuc',
                startDate: officialAdmissionDate,
                endDate: null,
                reenrollDate: null,
              });
              return;
            }

            if (isEnrollmentActive(existingOfficialEnrollment)) {
              const deleteResponse = await fetch(`/api/enrollments/${enrollment.id}`, { method: 'DELETE' });
              if (!deleteResponse.ok) {
                throw new Error('Không thể gộp đăng ký môn trùng với hồ sơ chính thức');
              }
              return;
            }

            await updateEnrollment(existingOfficialEnrollment.id, {
              registrationType: 'Chinh thuc',
              startDate: officialAdmissionDate,
              reenrollDate: officialAdmissionDate,
              endDate: null,
              reportBDate: enrollment.reportBDate || null,
            });

            const deleteResponse = await fetch(`/api/enrollments/${enrollment.id}`, { method: 'DELETE' });
            if (!deleteResponse.ok) {
              throw new Error('Không thể dọn đăng ký học thử sau khi gộp hồ sơ');
            }
          })
        );
      } else {
        await Promise.all(
          targetEnrollments.map((enrollment) =>
            updateEnrollment(enrollment.id, {
              registrationType: 'Chinh thuc',
              startDate: officialAdmissionDate,
            })
          )
        );
      }

      const remainingTrialEnrollments = activeEnrollments.filter((enrollment) =>
        !targetEnrollments.some((target) => target.id === enrollment.id)
      );

      if (matchingOfficialStudent && remainingTrialEnrollments.length === 0) {
        const deleteStudentResponse = await fetch(`/api/hoc-vien/${officialAdmissionStudent.id}`, { method: 'DELETE' });
        if (!deleteStudentResponse.ok) {
          throw new Error('Không thể gộp 2 hồ sơ học viên');
        }
      } else {
        await updateStudentStatus(
          officialAdmissionStudent.id,
          remainingTrialEnrollments.length === 0 ? STATUS_OFFICIAL : STATUS_TRIAL
        );
      }

      if (matchingOfficialStudent && matchingOfficialStudent.status !== STATUS_OFFICIAL) {
        await updateStudentStatus(matchingOfficialStudent.id, STATUS_OFFICIAL);
      }

      if (!matchingOfficialStudent && !hadOfficialBeforeAdmission && !hasAdmissionFeeRecorded(officialAdmissionStudent.id)) {
        const admissionFeeResponse = await fetch('/api/tai-chinh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'Khác',
            amount: 300000,
            spentAt: officialAdmissionDate,
            note: `[ADMISSION_FEE] studentId=${officialAdmissionStudent.id};source=trial-conversion`,
            proofImage: null,
          }),
        });

        if (!admissionFeeResponse.ok) {
          throw new Error('Không thể ghi nhận phí nhập học');
        }
      }

      setOfficialAdmissionOpen(false);
      setOfficialAdmissionStudent(null);
      setOfficialAdmissionSubjects([]);
      await refreshFinanceItems();
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xử lý nhập học chính thức');
    } finally {
      setSavingOfficialAdmission(false);
    }
  }

  async function submitDropout() {
    if (!dropoutStudent) return;
    try {
      const activeEnrollments = dropoutStudent.enrollments.filter((enrollment) => isEnrollmentActive(enrollment));
      const targetIds = dropoutMode === 'all'
        ? activeEnrollments.map((enrollment) => enrollment.id)
        : activeEnrollments
          .filter((enrollment) => enrollment.subjectCode === dropoutSubject)
          .map((enrollment) => enrollment.id);

      if (targetIds.length === 0) {
        throw new Error('Vui lòng chọn môn cần thôi học');
      }

      await Promise.all(
        targetIds.map((enrollmentId) =>
          updateEnrollment(enrollmentId, { endDate: dropoutDate })
        )
      );

      const remainingActiveEnrollments = dropoutStudent.enrollments.filter(
        (enrollment) => !targetIds.includes(enrollment.id) && isEnrollmentActive(enrollment)
      );
      const hasOfficial = remainingActiveEnrollments.some((e) => e.registrationType === 'Chính thức');
      const hasTrial = remainingActiveEnrollments.some((e) => e.registrationType === 'Học thử');
      const nextStatus = remainingActiveEnrollments.length === 0
        ? STATUS_DROPPED
        : (hasOfficial ? STATUS_OFFICIAL : (hasTrial ? STATUS_TRIAL : STATUS_OFFICIAL));

      await updateStudentStatus(dropoutStudent.id, nextStatus);

      setDropoutOpen(false);
      setDropoutStudent(null);
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xử lý thôi học');
    }
  }

  async function submitReenroll() {
    if (!reenrollStudent) return;
    try {
      const targetIds = reenrollStudent.enrollments
        .filter((enrollment) => isEnrollmentDropped(enrollment) && enrollment.subjectCode === reenrollSubject)
        .map((enrollment) => enrollment.id);

      if (targetIds.length === 0) {
        throw new Error('Không có môn đã nghỉ để nhập học lại');
      }

      await Promise.all(
        targetIds.map((enrollmentId) =>
          updateEnrollment(enrollmentId, {
            reenrollDate,
            endDate: null,
            registrationType: 'Chinh thuc',
          })
        )
      );

      await updateStudentStatus(reenrollStudent.id, STATUS_OFFICIAL);

      setReenrollOpen(false);
      setReenrollStudent(null);
      await refreshStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xử lý nhập học lại');
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Đang tải dữ liệu học viên...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  const showStudentFilters = ['hoc-vien', 'nghi-hoc', 'hoc-thu', 'chua-thu-hoc-phi'].includes(currentTab);

  return (
    <div className="space-y-6">
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={stats[0].label} value={String(stats[0].value)} delta="Theo tháng hiện tại" tone="amber" />
        <MetricCard label={stats[1].label} value={String(stats[1].value)} delta="Đang học" tone="emerald" />
        <MetricCard label={stats[2].label} value={String(stats[2].value)} delta="Cần theo dõi" tone="cyan" />
        <MetricCard label={stats[3].label} value={String(stats[3].value)} delta="Đã nghỉ" tone="slate" />
      </section>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Quản lý học viên</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={currentTab} className="space-y-4">

            {currentTab === 'nhap-hoc' ? (
              <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-white p-5 lg:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <CardTitle className="text-lg">Nhập học viên mới</CardTitle>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label>Họ tên</Label><Input value={form.fullName} onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Ngày sinh</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm((current) => ({ ...current, birthDate: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Giới tính</Label><Select value={form.gender} onValueChange={(value) => setForm((current) => ({ ...current, gender: value as Gender }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={GENDER_MALE}>Nam</SelectItem><SelectItem value={GENDER_FEMALE}>Nữ</SelectItem><SelectItem value={GENDER_OTHER}>Khác</SelectItem></SelectContent></Select></div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Môn học đăng ký</Label>
                    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
                      {SUBJECT_OPTIONS.map((subject) => (
                        <label key={subject} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-sm hover:border-slate-200 hover:bg-white">
                          <input
                            type="checkbox"
                            checked={selectedSubjects.includes(subject)}
                            onChange={(event) => toggleSubject(subject, event.target.checked)}
                          />
                          <span>{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {selectedSubjects.map((subject) => (
                    <div key={`subject-date-${subject}`} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 md:col-span-2">
                      <p className="text-sm font-semibold text-slate-900">{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Ngày nhập học môn {subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</Label>
                          <Input
                            type="date"
                            value={subjectAdmissionDates[subject] ?? ''}
                            onChange={(e) => setSubjectAdmissionDates((current) => ({ ...current, [subject]: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ngày Report B môn {subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</Label>
                          <Input
                            type="date"
                            value={subjectReportBDates[subject] ?? ''}
                            onChange={(e) => setSubjectReportBDates((current) => ({ ...current, [subject]: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2"><Label>Địa chỉ</Label><Input value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Loại đăng ký</Label>
                    <Select value={admissionRegistrationType} onValueChange={(value) => {
                      const nextValue = value as AdmissionRegistrationType;
                      setAdmissionRegistrationType(nextValue);
                      if (nextValue !== 'Chinh thuc') {
                        setAdmissionFeePaid(false);
                        setAdmissionFeePromotion(false);
                      }
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Chinh thuc">Chính thức</SelectItem>
                        <SelectItem value="Hoc thu">Học thử</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2"><Label>Họ tên bố</Label><Input value={form.fatherFullName} onChange={(e) => setForm((current) => ({ ...current, fatherFullName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>SĐT bố</Label><Input value={form.fatherPhone} onChange={(e) => setForm((current) => ({ ...current, fatherPhone: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Họ tên mẹ</Label><Input value={form.motherFullName} onChange={(e) => setForm((current) => ({ ...current, motherFullName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>SĐT mẹ</Label><Input value={form.motherPhone} onChange={(e) => setForm((current) => ({ ...current, motherPhone: e.target.value }))} /></div>

                  {admissionRegistrationType === 'Chinh thuc' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Nguồn</Label>
                        <Select value={officialIntakeSource} onValueChange={(value) => {
                          const nextSource = value as IntakeSource;
                          setOfficialIntakeSource(nextSource);
                          if (nextSource !== 'new') {
                            setAdmissionFeePaid(false);
                            setAdmissionFeePromotion(false);
                          }
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transfer">Chuyển đến từ trung tâm khác</SelectItem>
                            <SelectItem value="new">Mới</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {officialIntakeSource === 'new' ? (
                        <div className="space-y-2 md:col-span-2">
                          <Label>Phí nhập học</Label>
                          <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                            <input
                              type="checkbox"
                              checked={admissionFeePaid}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setAdmissionFeePaid(checked);
                                if (checked) {
                                  setAdmissionFeePromotion(false);
                                }
                              }}
                            />
                            <span>Đã đóng phí nhập học 300.000đ</span>
                          </label>
                          <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                            <input
                              type="checkbox"
                              checked={admissionFeePromotion}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setAdmissionFeePromotion(checked);
                                if (checked) {
                                  setAdmissionFeePaid(false);
                                }
                              }}
                            />
                            <span>Khuyến mãi phí nhập học</span>
                          </label>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <Button className="mt-4 w-full" onClick={handleOpenAdmissionConfirm}><PlusCircle className="mr-2 h-4 w-4" />Lưu và tạo hồ sơ nhập học</Button>
              </div>
            ) : null}

            {showStudentFilters ? (
              <div className="flex flex-col gap-4">
                <div className="space-y-4 rounded-2xl border bg-white p-4">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <div className={cn('relative', currentTab === 'chua-thu-hoc-phi' ? 'lg:col-span-1' : 'lg:col-span-2')}>
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên học viên, ba/mẹ, SĐT..." className="pl-10" />
                    </div>
                    {currentTab === 'chua-thu-hoc-phi' ? (
                      <>
                        <Select value={tuitionStatusFilter} onValueChange={(value) => setTuitionStatusFilter(value as TuitionStatusFilter)}>
                          <SelectTrigger><SelectValue placeholder="Trạng thái học phí" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả trạng thái</SelectItem>
                            <SelectItem value="unpaid">Chưa đóng</SelectItem>
                            <SelectItem value="paid">Đã đóng</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="month" value={tuitionMonthFilter} onChange={(event) => setTuitionMonthFilter(event.target.value)} />
                      </>
                    ) : currentTab === 'hoc-thu' ? (
                      <Select value={trialStatusFilter} onValueChange={(value) => setTrialStatusFilter(value as TrialStatusFilter)}>
                        <SelectTrigger><SelectValue placeholder="Trạng thái học thử" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả</SelectItem>
                          <SelectItem value={STATUS_TRIAL}>Còn hạn</SelectItem>
                          <SelectItem value={STATUS_EXPIRED}>Hết hạn</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : currentTab === 'nghi-hoc' ? (
                      <div className="flex items-center gap-2 lg:col-span-2">
                        <Input
                          type="month"
                          value={leaveDateFilter}
                          onChange={(e) => setLeaveDateFilter(e.target.value)}
                          placeholder="Lọc tháng nghỉ học (mm/yyyy)"
                          className="w-full"
                        />
                        {leaveDateFilter ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setLeaveDateFilter('')}
                            className="whitespace-nowrap"
                          >
                            Xóa lọc
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <Select value={reportBMonthFilter} onValueChange={setReportBMonthFilter}>
                          <SelectTrigger><SelectValue placeholder="Tháng Report B" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tháng report B</SelectItem>
                            {Array.from({ length: 12 }).map((_, idx) => <SelectItem key={idx + 1} value={String(idx + 1)}>Tháng {idx + 1}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={reportBYearFilter} onValueChange={setReportBYearFilter}>
                          <SelectTrigger><SelectValue placeholder="Năm Report B" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Năm report B</SelectItem>
                            {reportBYears.map((year) => <SelectItem key={year} value={String(year)}>Năm {year}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <TabsContent value="hoc-vien" className="space-y-4">
              <div className="grid gap-4">
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <StudentTable
                    students={filteredOfficialStudents}
                    selectedStudentId={selectedOfficialStudent?.id ?? null}
                    statusVariant="success"
                    showReportB
                    reportBMonthFilter={reportBMonthFilter}
                    reportBYearFilter={reportBYearFilter}
                    onSelect={setSelectedStudentId}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="nghi-hoc" className="space-y-4">
              <div className="grid gap-4">
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <StudentTable
                    students={filteredLeaveStudents}
                    selectedStudentId={selectedLeaveStudent?.id ?? null}
                    statusVariant="destructive"
                    showLeaveDate
                    leaveDateFilter={leaveDateFilter}
                    onSelect={setSelectedStudentId}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hoc-thu" className="space-y-4">
              <div className="grid gap-4">
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <StudentTable
                    students={filteredTrialStudents}
                    selectedStudentId={selectedTrialStudent?.id ?? null}
                    statusVariant="warning"
                    showTrialCountdown
                    getTrialDaysLeft={getTrialDaysLeft}
                    onSelect={setSelectedStudentId}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sinh-nhat" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {birthdayList.map((student) => (
                  <Card key={student.id} className="border bg-white">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-950">{student.fullName}</p>
                        <Badge className="whitespace-nowrap" variant={student.passed ? 'secondary' : student.daysUntil <= 7 ? 'warning' : 'default'}>
                          {student.passed ? 'Đã qua' : student.daysUntil <= 7 ? '7 ngày tới' : 'Sau 7 ngày'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Sinh nhật: {student.birthDate ? formatDate(student.birthDate) : '-'}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Còn {student.daysUntil} ngày</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="chua-thu-hoc-phi" className="space-y-4">
              <Card className="border bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Danh sách học phí tháng {tuitionMonthFilter.split('-')[1]}/{tuitionMonthFilter.split('-')[0]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Học viên</TableHead>
                        <TableHead>Số môn</TableHead>
                        <TableHead>Học phí gốc</TableHead>
                        <TableHead>Đã thu</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Ngày thu</TableHead>
                        <TableHead>Hình thức</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tuitionRows.map((row) => (
                        <TableRow key={row.student.id}>
                          <TableCell className="font-medium">{row.student.fullName}</TableCell>
                          <TableCell>{row.subjectCount}</TableCell>
                          <TableCell>{formatCurrency(row.estimatedAmount)}</TableCell>
                          <TableCell>
                            {row.paid ? (
                              <div className="relative inline-flex flex-col items-center justify-center whitespace-nowrap">
                                <span>{formatCurrency(row.paidAmount)}</span>
                                {row.paidAmount !== row.estimatedAmount && row.estimatedAmount > 0 ? (
                                  <Badge className="absolute -right-8 -top-3 scale-[0.65] transform px-1 py-0 font-bold shadow-none" variant={row.paidAmount < row.estimatedAmount ? "destructive" : "warning"}>
                                    {row.paidAmount < row.estimatedAmount ? '-' : '+'}{Math.abs(Math.round((row.estimatedAmount - row.paidAmount) / row.estimatedAmount * 100))}%
                                  </Badge>
                                ) : null}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.paid ? 'success' : 'warning'}>{row.paid ? 'Đã đóng' : 'Chưa đóng'}</Badge>
                          </TableCell>
                          <TableCell>{row.paymentDate ? formatDate(row.paymentDate) : '-'}</TableCell>
                          <TableCell>{row.paymentMethod ?? '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              {!row.paid ? (
                                <Button size="sm" onClick={() => openTuitionDialog(row.student)} title="Đóng học phí">
                                  <CircleDollarSign className="mr-1.5 h-4 w-4" />
                                  Đóng học phí
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                                  onClick={() => handleOpenRevertConfirm(row)}
                                  title="Hoàn tác học phí đã đóng"
                                >
                                  <RotateCcw className="mr-1.5 h-4 w-4" />
                                  Hoàn tác
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-3 space-y-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Tổng học phí ước tính</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(tuitionTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Tổng học phí đã thu</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(tuitionPaidTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Tổng phí nhập học đã thu</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(admissionFeeTotal)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nhap-hoc" className="space-y-1" />
          </Tabs>
        </CardContent>
      </Card>

      {portalReady && selectedOfficialStudent && currentTab === 'hoc-vien'
        ? createPortal(
          <>
            <button type="button" className="fixed inset-0 z-[90] bg-slate-900/25" onClick={closeStudentPanel} aria-label="Đóng" />
            <aside className="fixed inset-y-0 right-0 z-[100] h-dvh w-full max-w-md overflow-y-auto border-l bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg uppercase tracking-[0.2em] text-slate-500">Chi tiết học viên</p>
                <Button type="button" variant="outline" size="icon" onClick={closeStudentPanel}><X className="h-4 w-4" /></Button>
              </div>
              <StudentDetailPanel
                student={selectedOfficialStudent}
                classGroups={classGroups}
                statusVariant="success"
                showReportB
                onEdit={handleEditFromPanel}
                onAssign={handleAssignFromPanel}
                onAddSubject={openAddSubjectDialog}
                extraActionLabel="Thôi học"
                onExtraAction={handleDropoutFromPanel}
              />
            </aside>
          </>,
          document.body
        )
        : null}

      {portalReady && selectedLeaveStudent && currentTab === 'nghi-hoc'
        ? createPortal(
          <>
            <button type="button" className="fixed inset-0 z-[90] bg-slate-900/25" onClick={closeStudentPanel} aria-label="Đóng" />
            <aside className="fixed inset-y-0 right-0 z-[100] h-dvh w-full max-w-md overflow-y-auto border-l bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg uppercase tracking-[0.2em] text-slate-500">Chi tiết học viên</p>
                <Button type="button" variant="outline" size="icon" onClick={closeStudentPanel}><X className="h-4 w-4" /></Button>
              </div>
              <StudentDetailPanel
                student={selectedLeaveStudent}
                classGroups={classGroups}
                statusVariant="destructive"
                showLeaveDate
                onEdit={handleEditFromPanel}
                onAssign={handleAssignFromPanel}
                extraActionLabel="Nhập học lại"
                onExtraAction={handleReenrollFromPanel}
                secondaryActionLabel="Nhập học mới"
                onSecondaryAction={handleNewAdmissionFromPanel}
              />
            </aside>
          </>,
          document.body
        )
        : null}

      {portalReady && selectedTrialStudent && currentTab === 'hoc-thu'
        ? createPortal(
          <>
            <button type="button" className="fixed inset-0 z-[90] bg-slate-900/25" onClick={closeStudentPanel} aria-label="Đóng" />
            <aside className="fixed inset-y-0 right-0 z-[100] h-dvh w-full max-w-md overflow-y-auto border-l bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg uppercase tracking-[0.2em] text-slate-500">Chi tiết học viên</p>
                <Button type="button" variant="outline" size="icon" onClick={closeStudentPanel}><X className="h-4 w-4" /></Button>
              </div>
              <StudentDetailPanel
                student={selectedTrialStudent}
                classGroups={classGroups}
                statusVariant="warning"
                showTrialCountdown
                getTrialDaysLeft={getTrialDaysLeft}
                onEdit={handleEditFromPanel}
                onAssign={handleAssignFromPanel}
                showOfficialRegisterButton
                onRegisterOfficial={handleRegisterOfficialFromPanel}
              />
            </aside>
          </>,
          document.body
        )
        : null}

      <Dialog open={tuitionDialogOpen} onOpenChange={(open) => {
        setTuitionDialogOpen(open);
        if (!open) setTuitionStep('form');
      }}>
        <DialogContent className="max-h-[85vh] flex flex-col overflow-hidden">
          {tuitionStep === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>Đóng học phí</DialogTitle>
                <DialogDescription>{tuitionStudent ? `Học viên: ${tuitionStudent.fullName}` : ''}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <Label>Họ tên học viên</Label>
                  <Input value={tuitionStudent?.fullName ?? ''} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Tháng/năm thu</Label>
                  <div className="max-h-52 space-y-2 overflow-auto rounded-xl border p-3">
                    {availablePaymentMonths.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedPaymentMonths.includes(item.key)}
                          onChange={(event) => {
                            setSelectedPaymentMonths((current) => event.target.checked
                              ? [...current, item.key]
                              : current.filter((value) => value !== item.key));
                          }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ngày thu</Label>
                  <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Hình thức thanh toán</Label>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tiền mặt">Tiền mặt</SelectItem>
                      <SelectItem value="Chuyển khoản">Chuyển khoản</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tuitionDiscount50"
                      className="h-4 w-4 cursor-pointer"
                      checked={tuitionDiscount50}
                      onChange={(e) => setTuitionDiscount50(e.target.checked)}
                    />
                    <Label htmlFor="tuitionDiscount50" className="font-medium text-emerald-600 cursor-pointer">Khuyến mãi 50%</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tuitionFree"
                      className="h-4 w-4 cursor-pointer"
                      checked={tuitionFree}
                      onChange={(e) => setTuitionFree(e.target.checked)}
                    />
                    <Label htmlFor="tuitionFree" className="font-medium text-blue-600 cursor-pointer">Miễn học phí</Label>
                  </div>
                  <div className="space-y-1 mt-2">
                    <Label>Phí thu (Gốc: {formatCurrency(tuitionDialogAmount)})</Label>
                    <Input
                      value={formatNumberWithDots(tuitionCustomAmount)}
                      onChange={(e) => setTuitionCustomAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="Nhập số tiền..."
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setTuitionDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleOpenTuitionConfirm}>Xem lại & Xác nhận</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-900">
                  <CircleDollarSign className="h-5 w-5 text-emerald-600" />
                  Xác nhận đóng học phí
                </DialogTitle>
                <DialogDescription>
                  Vui lòng kiểm tra lại thông tin thu học phí trước khi ghi nhận vào hệ thống.
                </DialogDescription>
              </DialogHeader>

              {tuitionStudent ? (
                <div className="my-2 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <span className="font-medium text-slate-500">Học viên</span>
                    <span className="font-bold text-slate-950 text-right">{tuitionStudent.fullName}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <span className="font-medium text-slate-500">Các tháng đóng</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {selectedPaymentMonths
                        .map((m) => `Tháng ${m.split('-')[1]}/${m.split('-')[0]}`)
                        .join(', ')}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <span className="font-medium text-slate-500">Hình thức</span>
                    <span className="font-medium text-slate-900">{paymentMethod}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <span className="font-medium text-slate-500">Ngày thu</span>
                    <span className="font-medium text-slate-900">{formatDate(paymentDate)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-1">
                    <span className="font-bold text-slate-900">Tổng tiền thu</span>
                    <span className="font-extrabold text-emerald-600 text-base">
                      {formatCurrency(Number(String(tuitionCustomAmount).replace(/\D/g, '')))}
                    </span>
                  </div>
                </div>
              ) : null}

              <DialogFooter className="gap-3 sm:gap-3">
                <Button variant="outline" onClick={() => setTuitionStep('form')} disabled={savingTuitionPayment}>
                  Quay lại
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => void submitTuitionPayment()}
                  disabled={savingTuitionPayment}
                >
                  {savingTuitionPayment ? 'Đang ghi nhận...' : 'Đồng ý đóng học phí'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận hoàn tác đóng học phí */}
      <Dialog open={revertConfirmDialogOpen} onOpenChange={setRevertConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Xác nhận hoàn tác đóng học phí
            </DialogTitle>
            <DialogDescription>
              Hành động này sẽ xóa giao dịch thu học phí trong hệ thống và chuyển trạng thái về chưa đóng.
            </DialogDescription>
          </DialogHeader>

          {revertTargetRow ? (
            <div className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 text-sm text-slate-700">
              <div className="flex items-start justify-between gap-2 border-b border-amber-200/60 pb-2">
                <span className="font-medium text-slate-500">Học viên</span>
                <span className="font-bold text-slate-950 text-right">{revertTargetRow.student.fullName}</span>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-amber-200/60 pb-2">
                <span className="font-medium text-slate-500">Tháng hoàn tác</span>
                <span className="font-semibold text-slate-900">
                  Tháng {selectedFilterMonthKey.split('-')[1]}/{selectedFilterMonthKey.split('-')[0]}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-amber-200/60 pb-2">
                <span className="font-medium text-slate-500">Số tiền đã thu</span>
                <span className="font-bold text-amber-700">{formatCurrency(revertTargetRow.paidAmount)}</span>
              </div>
              <div className="flex items-start justify-between gap-2 pt-1">
                <span className="font-medium text-slate-500">Ngày thu ban đầu</span>
                <span className="font-medium text-slate-900">{revertTargetRow.paymentDate ? formatDate(revertTargetRow.paymentDate) : '-'}</span>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setRevertConfirmDialogOpen(false)} disabled={savingRevertTuition}>
              Hủy
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => void confirmRevertTuition()}
              disabled={savingRevertTuition}
            >
              {savingRevertTuition ? 'Đang hoàn tác...' : 'Xác nhận hoàn tác'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận tạo hồ sơ nhập học */}
      <Dialog open={admissionConfirmDialogOpen} onOpenChange={setAdmissionConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
              Xác nhận tạo hồ sơ nhập học
            </DialogTitle>
            <DialogDescription>
              Vui lòng kiểm tra lại toàn bộ thông tin học viên trước khi lưu vào hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
              <span className="font-medium text-slate-500">Họ tên học viên</span>
              <span className="font-bold text-slate-950 text-right">{form.fullName}</span>
            </div>
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
              <span className="font-medium text-slate-500">Loại đăng ký</span>
              <Badge variant={admissionRegistrationType === 'Chinh thuc' ? 'success' : 'warning'}>
                {admissionRegistrationType === 'Chinh thuc' ? 'Chính thức' : 'Học thử'}
              </Badge>
            </div>
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
              <span className="font-medium text-slate-500">Các môn đăng ký</span>
              <span className="font-semibold text-slate-900 text-right">
                {selectedSubjects
                  .map((s) => (s === 'MATH' ? 'Toán' : 'Tiếng Anh'))
                  .join(', ')}
              </span>
            </div>
            {form.fatherFullName || form.motherFullName ? (
              <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                <span className="font-medium text-slate-500">Phụ huynh</span>
                <span className="font-medium text-slate-900 text-right">
                  {[form.fatherFullName, form.motherFullName].filter(Boolean).join(' / ')}
                </span>
              </div>
            ) : null}
            {form.fatherPhone || form.motherPhone ? (
              <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                <span className="font-medium text-slate-500">Số điện thoại</span>
                <span className="font-medium text-slate-900">{form.fatherPhone || form.motherPhone}</span>
              </div>
            ) : null}
            {admissionRegistrationType === 'Chinh thuc' && officialIntakeSource === 'new' ? (
              <div className="flex items-start justify-between gap-2 pt-1">
                <span className="font-bold text-slate-900">Phí nhập học</span>
                <span className="font-bold text-emerald-600">
                  {admissionFeePromotion ? 'Miễn phí (Khuyến mãi)' : 'Đã thu 300.000đ'}
                </span>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setAdmissionConfirmDialogOpen(false)} disabled={savingAdmission}>
              Hủy
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => void submitStudent()}
              disabled={savingAdmission}
            >
              {savingAdmission ? 'Đang tạo hồ sơ...' : 'Đồng ý tạo hồ sơ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Xếp lớp theo môn đăng ký</DialogTitle>
            <DialogDescription>{assigningStudent ? `Học viên: ${assigningStudent.fullName}` : 'Chọn nhiều lớp và ca học theo từng môn'}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
            {assigningStudent?.enrollments.length ? SUBJECT_OPTIONS
              .filter((subjectCode) => assigningStudent.enrollments.some((enrollment) => enrollment.subjectCode === subjectCode))
              .map((subjectCode) => {
                const selected = assignmentValues[subjectCode];
                if (!selected) return null;

                const fixedClasses = FIXED_CLASSES.filter((item) => item.subjectCode === subjectCode);

                return (
                  <div key={subjectCode} className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      {getSubjectBadge(subjectCode)}
                      <span className="text-sm text-muted-foreground">{selected.registrationType} - {selected.enrollmentType}</span>
                    </div>

                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
                      {fixedClasses.map((item) => {
                        const checked = selected.selectedWeekdays.includes(item.weekday);
                        const currentShift = selected.shiftsByWeekday[item.weekday] ?? 'Ca 1';

                        return (
                          <div key={`${subjectCode}-${item.weekday}`} className="grid items-center gap-2 rounded-lg border bg-slate-50 p-2 sm:grid-cols-[1fr_120px]">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  setAssignmentValues((current) => {
                                    const currentItem = current[subjectCode] as SubjectAssignmentValue;
                                    const selectedWeekdays = event.target.checked
                                      ? Array.from(new Set([...currentItem.selectedWeekdays, item.weekday]))
                                      : currentItem.selectedWeekdays.filter((weekday) => weekday !== item.weekday);

                                    return {
                                      ...current,
                                      [subjectCode]: {
                                        ...currentItem,
                                        selectedWeekdays,
                                      },
                                    };
                                  });
                                }}
                              />
                              <span>{item.name}</span>
                              <span className="text-xs text-muted-foreground">({item.weekday})</span>
                            </label>

                            <Select
                              value={currentShift}
                              onValueChange={(value) => {
                                setAssignmentValues((current) => {
                                  const currentItem = current[subjectCode] as SubjectAssignmentValue;
                                  return {
                                    ...current,
                                    [subjectCode]: {
                                      ...currentItem,
                                      shiftsByWeekday: {
                                        ...currentItem.shiftsByWeekday,
                                        [item.weekday]: value as ShiftOption,
                                      },
                                    },
                                  };
                                });
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Ca hoc" /></SelectTrigger>
                              <SelectContent>
                                {SHIFT_OPTIONS.map((shift) => (
                                  <SelectItem key={shift} value={shift}>{formatClassShiftByWeekday(item.weekday, shift as ClassShift)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Học viên chưa có môn đăng ký để xếp lớp.</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitAssignments()} disabled={savingAssign || !(assigningStudent?.enrollments.length)}>
              {savingAssign ? 'Đang lưu...' : 'Lưu xếp lớp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin học viên</DialogTitle>
            <DialogDescription>Chỉ cập nhật thông tin cá nhân hiện tại của học viên.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[64vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Họ tên</Label><Input value={editForm.fullName} onChange={(e) => setEditForm((current) => ({ ...current, fullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Ngày sinh</Label><Input type="date" value={editForm.birthDate} onChange={(e) => setEditForm((current) => ({ ...current, birthDate: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Giới tính</Label><Select value={editForm.gender} onValueChange={(value) => setEditForm((current) => ({ ...current, gender: value as Gender }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={GENDER_MALE}>Nam</SelectItem><SelectItem value={GENDER_FEMALE}>Nữ</SelectItem><SelectItem value={GENDER_OTHER}>Khác</SelectItem></SelectContent></Select></div>
            </div>

            {(Object.keys(editEnrollmentIds) as SubjectCode[]).length > 0 ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Mốc thời gian nhập học</p>
                <div className="grid gap-2">
                  {(Object.keys(editEnrollmentIds) as SubjectCode[]).map((subjectCode) => (
                    <div key={`edit-${subjectCode}`} className="grid items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-[120px_1fr_1fr]">
                      <span className="text-sm font-medium">{subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh'}</span>
                      <Input
                        type="date"
                        value={editSubjectAdmissionDates[subjectCode] ?? ''}
                        onChange={(e) => setEditSubjectAdmissionDates((current) => ({ ...current, [subjectCode]: e.target.value }))}
                        aria-label={`Ngày nhập học môn ${subjectCode}`}
                      />
                      <Input
                        type="date"
                        value={editSubjectReportBDates[subjectCode] ?? ''}
                        onChange={(e) => setEditSubjectReportBDates((current) => ({ ...current, [subjectCode]: e.target.value }))}
                        aria-label={`Ngày Report B môn ${subjectCode}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Thứ tự cột: Môn học - Ngày nhập học - Ngày Report B.</p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label>Họ tên ba</Label><Input value={editForm.fatherFullName} onChange={(e) => setEditForm((current) => ({ ...current, fatherFullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>SĐT ba</Label><Input value={editForm.fatherPhone} onChange={(e) => setEditForm((current) => ({ ...current, fatherPhone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Họ tên mẹ</Label><Input value={editForm.motherFullName} onChange={(e) => setEditForm((current) => ({ ...current, motherFullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>SĐT mẹ</Label><Input value={editForm.motherPhone} onChange={(e) => setEditForm((current) => ({ ...current, motherPhone: e.target.value }))} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Địa chỉ</Label><Input value={editForm.address} onChange={(e) => setEditForm((current) => ({ ...current, address: e.target.value }))} /></div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitEditStudent()}>
              <Save className="mr-2 h-4 w-4" />
              Lưu chỉnh sửa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dropoutOpen} onOpenChange={setDropoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xử lý thôi học</DialogTitle>
            <DialogDescription>{dropoutStudent ? `Học viên: ${dropoutStudent.fullName}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngày kết thúc học</Label>
              <Input type="date" value={dropoutDate} onChange={(e) => setDropoutDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phương thức</Label>
              <Select
                value={dropoutMode}
                onValueChange={(value) => {
                  const nextMode = value as 'all' | 'subjects';
                  setDropoutMode(nextMode);
                  if (nextMode === 'subjects' && dropoutStudent) {
                    const subjectEnrollments = dropoutStudent.enrollments.filter((enrollment) => isEnrollmentActive(enrollment) && enrollment.subjectCode === dropoutSubject);
                    setDropoutEnrollmentIds(subjectEnrollments.map((enrollment) => enrollment.id));
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Thôi học toàn bộ</SelectItem>
                  <SelectItem value="subjects">Thôi học theo môn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dropoutMode === 'subjects' ? (
              <div className="space-y-2 rounded-xl border p-3">
                <Label>Môn thôi học</Label>
                <Select
                  value={dropoutSubject}
                  onValueChange={(value) => {
                    const subject = value as SubjectCode;
                    setDropoutSubject(subject);
                    const subjectEnrollments = (dropoutStudent?.enrollments ?? []).filter((enrollment) => isEnrollmentActive(enrollment) && enrollment.subjectCode === subject);
                    setDropoutEnrollmentIds(subjectEnrollments.map((enrollment) => enrollment.id));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set((dropoutStudent?.enrollments ?? []).filter((enrollment) => isEnrollmentActive(enrollment)).map((enrollment) => enrollment.subjectCode))).map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDropoutOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitDropout()}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reenrollOpen} onOpenChange={setReenrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập học lại</DialogTitle>
            <DialogDescription>{reenrollStudent ? `Học viên: ${reenrollStudent.fullName}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngày nhập học lại</Label>
              <Input type="date" value={reenrollDate} onChange={(e) => setReenrollDate(e.target.value)} />
            </div>
            <div className="space-y-2 rounded-xl border p-3">
              <Label>Môn nhập học lại</Label>
              <Select value={reenrollSubject} onValueChange={(value) => setReenrollSubject(value as SubjectCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set((reenrollStudent?.enrollments ?? []).filter((enrollment) => isEnrollmentDropped(enrollment)).map((enrollment) => enrollment.subjectCode))).map((subject) => (
                    <SelectItem key={subject} value={subject}>{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReenrollOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitReenroll()}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đăng ký môn học mới</DialogTitle>
            <DialogDescription>{addSubjectStudent ? `Học viên: ${addSubjectStudent.fullName}` : ''}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Môn học</Label>
              <Select value={addSubjectCode} onValueChange={(value) => setAddSubjectCode(value as SubjectCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((subject) => (
                    <SelectItem key={subject} value={subject}>{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Loại đăng ký</Label>
              <Select value={addSubjectRegistrationType} onValueChange={(value) => setAddSubjectRegistrationType(value as AdmissionRegistrationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chinh thuc">Chính thức</SelectItem>
                  <SelectItem value="Hoc thu">Học thử</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ngày nhập học</Label>
              <Input type="date" value={addSubjectStartDate} onChange={(e) => setAddSubjectStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Ngày Report B</Label>
              <Input type="date" value={addSubjectReportBDate} onChange={(e) => setAddSubjectReportBDate(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubjectOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitAddSubject()} disabled={savingAddSubject}>
              {savingAddSubject ? 'Đang lưu...' : 'Lưu đăng ký môn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newAdmissionOpen} onOpenChange={setNewAdmissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập học mới</DialogTitle>
            <DialogDescription>{newAdmissionStudent ? `Học viên: ${newAdmissionStudent.fullName}` : ''}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Môn nhập học mới</Label>
              <Select value={newAdmissionSubject} onValueChange={(value) => setNewAdmissionSubject(value as SubjectCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.filter((subject) => !newAdmissionStudent?.enrollments.some((enrollment) => enrollment.subjectCode === subject)).map((subject) => (
                    <SelectItem key={subject} value={subject}>{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ngày nhập học</Label>
              <Input type="date" value={newAdmissionStartDate} onChange={(e) => setNewAdmissionStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Ngày Report B</Label>
              <Input type="date" value={newAdmissionReportBDate} onChange={(e) => setNewAdmissionReportBDate(e.target.value)} />
            </div>

            <div className="space-y-2 rounded-xl border p-3">
              <Label>Phí nhập học</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newAdmissionFeePaid}
                  onChange={(event) => setNewAdmissionFeePaid(event.target.checked)}
                />
                <span>Đã đóng phí nhập học 300.000đ</span>
              </label>
              <p className="text-xs text-muted-foreground">Bỏ chọn nếu không thu phí nhập học cho lần này.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAdmissionOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitNewAdmission()} disabled={savingNewAdmission}>
              {savingNewAdmission ? 'Đang lưu...' : 'Xác nhận nhập học mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={officialAdmissionOpen} onOpenChange={setOfficialAdmissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xử lý nhập học chính thức</DialogTitle>
            <DialogDescription>{officialAdmissionStudent ? `Học viên: ${officialAdmissionStudent.fullName}` : ''}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngày nhập học chính thức</Label>
              <Input type="date" value={officialAdmissionDate} onChange={(e) => setOfficialAdmissionDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Phương thức</Label>
              <Select value={officialAdmissionMode} onValueChange={(value) => setOfficialAdmissionMode(value as OfficialAdmissionMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Nhập học toàn bộ môn đang học</SelectItem>
                  <SelectItem value="subjects">Nhập học theo môn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {officialAdmissionMode === 'subjects' ? (
              <div className="space-y-2 rounded-xl border p-3">
                <Label>Chọn môn nhập học chính thức</Label>
                <div className="space-y-2">
                  {Array.from(
                    new Set((officialAdmissionStudent?.enrollments ?? [])
                      .filter((enrollment) => isEnrollmentActive(enrollment))
                      .map((enrollment) => enrollment.subjectCode))
                  ).map((subject) => (
                    <label key={`official-subject-${subject}`} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={officialAdmissionSubjects.includes(subject)}
                        onChange={(event) => {
                          setOfficialAdmissionSubjects((current) => event.target.checked
                            ? Array.from(new Set([...current, subject]))
                            : current.filter((value) => value !== subject));
                        }}
                      />
                      <span>{subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfficialAdmissionOpen(false)}>Hủy</Button>
            <Button onClick={() => void submitOfficialAdmission()} disabled={savingOfficialAdmission}>
              {savingOfficialAdmission ? 'Đang xử lý...' : 'Xác nhận nhập học chính thức'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Đang tải...</div>}>
      <StudentsPageContent />
    </Suspense>
  );
}

type StudentTableProps = {
  students: ApiStudent[];
  selectedStudentId: number | null;
  statusVariant: 'success' | 'warning' | 'destructive';
  showReportB?: boolean;
  showLeaveDate?: boolean;
  showTrialCountdown?: boolean;
  reportBMonthFilter?: string;
  reportBYearFilter?: string;
  leaveDateFilter?: string;
  onSelect: (studentId: number) => void;
  getTrialDaysLeft?: (student: ApiStudent) => number;
};

type StudentDetailPanelProps = {
  student: ApiStudent | null;
  classGroups: ApiClassGroup[];
  statusVariant: 'success' | 'warning' | 'destructive';
  showReportB?: boolean;
  showLeaveDate?: boolean;
  showTrialCountdown?: boolean;
  showOfficialRegisterButton?: boolean;
  onEdit: (student: ApiStudent) => void;
  onAssign: (student: ApiStudent) => void;
  onAddSubject?: (student: ApiStudent) => void;
  getTrialDaysLeft?: (student: ApiStudent) => number;
  extraActionLabel?: string;
  onExtraAction?: (student: ApiStudent) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (student: ApiStudent) => void;
  onRegisterOfficial?: (student: ApiStudent) => void;
};

function StudentDetailPanel({
  student,
  classGroups,
  statusVariant,
  showReportB,
  showLeaveDate,
  showTrialCountdown,
  showOfficialRegisterButton,
  onEdit,
  onAssign,
  onAddSubject,
  getTrialDaysLeft,
  extraActionLabel,
  onExtraAction,
  secondaryActionLabel,
  onSecondaryAction,
  onRegisterOfficial,
}: StudentDetailPanelProps) {
  if (!student) {
    return (
      <Card className="glass-card border-dashed xl:sticky xl:top-24">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Chọn một học viên trong bảng để xem thông tin chi tiết.
        </CardContent>
      </Card>
    );
  }

  const daysLeft = showTrialCountdown && getTrialDaysLeft ? getTrialDaysLeft(student) : null;
  const isTrialExpiredByCountdown = showTrialCountdown && daysLeft !== null && daysLeft < 0;
  const displayedStatus = isTrialExpiredByCountdown ? STATUS_EXPIRED : student.status;

  return (
    <Card className="glass-card overflow-hidden xl:sticky xl:top-24">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4">
        <div className="space-y-2">
          <CardTitle className="text-xl text-slate-950">{student.fullName}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="whitespace-nowrap" variant={displayedStatus === STATUS_EXPIRED ? 'destructive' : statusVariant}>{displayedStatus}</Badge>
            {student.enrollments.map((enrollment) => (
              <span key={enrollment.id}>{getSubjectBadge(enrollment.subjectCode)}</span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => onEdit(student)}><Edit3 className="mr-2 h-4 w-4" />Chỉnh sửa</Button>
          <Button onClick={() => onAssign(student)}><FolderPlus className="mr-2 h-4 w-4" />Xếp lớp</Button>
          {onAddSubject ? (
            <Button variant="outline" onClick={() => onAddSubject(student)}>
              <PlusCircle className="mr-2 h-4 w-4" />Đăng ký môn mới
            </Button>
          ) : null}
          {extraActionLabel && onExtraAction ? (
            <Button
              className={onAddSubject || secondaryActionLabel ? '' : 'col-span-2'}
              variant={extraActionLabel === 'Thôi học' ? 'destructive' : 'secondary'}
              onClick={() => onExtraAction(student)}
            >
              {extraActionLabel === 'Thôi học' ? (
                <ShieldX className="mr-2 h-4 w-4" />
              ) : (
                <History className="mr-2 h-4 w-4" />
              )}
              {extraActionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button variant="outline" onClick={() => onSecondaryAction(student)}>
              <PlusCircle className="mr-2 h-4 w-4" />{secondaryActionLabel}
            </Button>
          ) : null}
          {showOfficialRegisterButton && onRegisterOfficial ? (
            <Button className="col-span-2" onClick={() => onRegisterOfficial(student)}>
              <GraduationCap className="mr-2 h-4 w-4" />
              Nhập học chính thức
            </Button>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thông tin cơ bản</p>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Giới tính:</span> {student.gender}</p>
            <p><span className="text-muted-foreground">Ngày sinh:</span> {formatDate(student.birthDate ?? student.admissionDate)}</p>
            <p><span className="text-muted-foreground">Địa chỉ:</span> {student.address || '-'}</p>
            {showTrialCountdown ? (
              <p>
                <span className="text-muted-foreground">Đếm ngược học thử:</span>{' '}
                {daysLeft !== null && daysLeft >= 0 ? `Còn ${daysLeft} ngày` : `Quá hạn ${Math.abs(daysLeft ?? 0)} ngày`}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {showLeaveDate ? 'Ngày nhập học và ngày nghỉ học theo môn' : 'Ngày nhập học và ngày Report B theo môn'}
          </p>
          {student.enrollments.length ? (
            <div className="space-y-3 text-sm">
              {student.enrollments.map((enrollment) => (
                <div key={enrollment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    {getSubjectBadge(enrollment.subjectCode)}
                    <span className="text-xs text-muted-foreground">{enrollment.registrationType}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="text-xs text-muted-foreground">Nhập học: {formatDate(enrollment.startDate)}</p>
                    {showLeaveDate ? (
                      <p className="text-xs text-muted-foreground">Nghỉ học: {enrollment.endDate ? formatDate(enrollment.endDate) : '-'}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Report B: {enrollment.reportBDate ? formatDate(enrollment.reportBDate) : (student.reportBDate ? formatDate(student.reportBDate) : '-')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Nhập học: {formatDate(student.admissionDate)}</p>
              {showReportB ? <p className="text-muted-foreground">Report B: {student.reportBDate ? formatDate(student.reportBDate) : '-'}</p> : null}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phụ huynh liên hệ</p>
          <div className="space-y-2 text-sm">
            <p>Ba: {student.fatherFullName || '-'}</p>
            <p className="flex items-center gap-1 text-muted-foreground"><PhoneCall className="h-3.5 w-3.5" /> {student.fatherPhone || '-'}</p>
            <p>Mẹ: {student.motherFullName || '-'}</p>
            <p className="flex items-center gap-1 text-muted-foreground"><PhoneCall className="h-3.5 w-3.5" /> {student.motherPhone || '-'}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Môn học đăng ký</p>
          <div className="space-y-2">
            {student.enrollments.length ? student.enrollments.map((enrollment) => (
              <div key={enrollment.id} className="rounded-lg border bg-slate-50 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  {getSubjectBadge(enrollment.subjectCode)}
                  <span className="text-xs text-muted-foreground">{enrollment.registrationType}</span>
                </div>
                <p className="mb-1 text-xs text-muted-foreground">Level hiện tại: {enrollment.currentLevel ?? '-'}</p>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const schedules = parseSerializedStudyDays(enrollment.studyDays, enrollment.classShift as ShiftOption);
                    if (schedules.length === 0) {
                      return enrollment.classGroup?.label ?? 'Chưa xếp lớp';
                    }

                    const labels = schedules.map((schedule) => {
                      const mappedClass = classGroups.find((group) =>
                        group.subjectCode === enrollment.subjectCode &&
                        group.weekday === schedule.weekday &&
                        group.classShift === schedule.shift
                      );
                      const shiftLabel = formatClassShiftByWeekday(schedule.weekday, schedule.shift as ClassShift);
                      return mappedClass ? `${mappedClass.label}` : `${schedule.weekday}`;
                    });

                    return labels.join(' • ');
                  })()}
                </p>
              </div>
            )) : <p className="text-sm text-muted-foreground">Chưa có môn đăng ký.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentTable({
  students,
  selectedStudentId,
  statusVariant,
  showReportB,
  showLeaveDate,
  showTrialCountdown,
  reportBMonthFilter,
  reportBYearFilter,
  leaveDateFilter,
  onSelect,
  getTrialDaysLeft,
}: StudentTableProps) {
  const totalColumns = 7 + (showReportB ? 1 : 0) + (showLeaveDate ? 1 : 0) + (showTrialCountdown ? 1 : 0);

  const isEnrollmentVisibleByReportBFilter = useCallback((enrollment: ApiStudent['enrollments'][0], student: ApiStudent) => {
    if (showLeaveDate) {
      if (!leaveDateFilter) return true;
      return Boolean(enrollment.endDate && enrollment.endDate.slice(0, 7) === leaveDateFilter);
    }

    if (!reportBMonthFilter || reportBMonthFilter === 'all' && (!reportBYearFilter || reportBYearFilter === 'all')) return true;

    const effectiveReportBDate = enrollment.reportBDate ?? student.reportBDate;
    if (!effectiveReportBDate) return false;

    const reportBDate = parseISO(effectiveReportBDate);
    const monthOk = !reportBMonthFilter || reportBMonthFilter === 'all' || reportBDate.getMonth() + 1 === Number(reportBMonthFilter);
    const yearOk = !reportBYearFilter || reportBYearFilter === 'all' || reportBDate.getFullYear() === Number(reportBYearFilter);
    return monthOk && yearOk;
  }, [showLeaveDate, leaveDateFilter, reportBMonthFilter, reportBYearFilter]);

  const mathEnrollmentCount = students.reduce(
    (sum, student) => sum + student.enrollments.filter((enrollment) =>
      enrollment.subjectCode === 'MATH' && isEnrollmentVisibleByReportBFilter(enrollment, student)
    ).length,
    0
  );
  const eflEnrollmentCount = students.reduce(
    (sum, student) => sum + student.enrollments.filter((enrollment) =>
      enrollment.subjectCode === 'EFL' && isEnrollmentVisibleByReportBFilter(enrollment, student)
    ).length,
    0
  );
  const totalEnrollmentCount = mathEnrollmentCount + eflEnrollmentCount;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Học viên</TableHead>
          <TableHead>Ngày sinh</TableHead>
          <TableHead>Phụ huynh</TableHead>
          <TableHead>Môn học</TableHead>
          <TableHead>Ngày nhập học</TableHead>
          {showReportB ? <TableHead>Ngày Report B</TableHead> : null}
          {showTrialCountdown ? <TableHead>Đếm ngược hạn</TableHead> : null}
          {showLeaveDate ? <TableHead>Ngày nghỉ học</TableHead> : null}
          <TableHead>Trạng thái</TableHead>
          <TableHead>Địa chỉ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => {
          const daysLeft = showTrialCountdown && getTrialDaysLeft ? getTrialDaysLeft(student) : null;
          const isTrialExpiredByCountdown = showTrialCountdown && daysLeft !== null && daysLeft < 0;
          const displayedStatus = isTrialExpiredByCountdown ? STATUS_EXPIRED : student.status;
          return (
            <TableRow
              key={student.id}
              onClick={() => onSelect(student.id)}
              className={cn(
                'cursor-pointer transition-colors hover:bg-slate-50/80',
                selectedStudentId === student.id ? 'bg-slate-100/70' : ''
              )}
            >
              <TableCell>
                <div>
                  <p className="font-semibold text-slate-950">{student.fullName}</p>
                  <p className="text-xs text-muted-foreground">{student.gender}</p>
                </div>
              </TableCell>
              <TableCell>{formatDate(student.birthDate ?? student.admissionDate)}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">Ba: {student.fatherFullName || '-'} - Mẹ: {student.motherFullName || '-'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <HoverTooltip
                      content={(
                        <span className="block leading-5">
                          <span className="block">Ba: {student.fatherPhone || '-'}</span>
                          <span className="block">Mẹ: {student.motherPhone || '-'}</span>
                        </span>
                      )}
                    >
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                        aria-label="Xem số điện thoại phụ huynh"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                      </span>
                    </HoverTooltip>
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-sm">
                  {student.enrollments.length
                    ? student.enrollments.map((enrollment) => <div key={enrollment.id} className="rounded-lg bg-muted/30 px-2 py-1">{getSubjectBadge(enrollment.subjectCode)}</div>)
                    : <span className="text-muted-foreground">Chưa có môn học</span>}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {student.enrollments.length > 0 ? student.enrollments.map((enrollment) => (
                    <div key={`start-${enrollment.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                      <span className="font-medium">{enrollment.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh'}:</span>{' '}
                      {formatDate(enrollment.startDate)}
                    </div>
                  )) : formatDate(student.admissionDate)}
                </div>
              </TableCell>
              {showReportB ? (
                <TableCell>
                  <div className="space-y-1">
                    {student.enrollments.length > 0 ? student.enrollments.map((enrollment) => (
                      <div key={`report-b-${enrollment.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                        <span className="font-medium">{enrollment.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh'}:</span>{' '}
                        {enrollment.reportBDate ? formatDate(enrollment.reportBDate) : (student.reportBDate ? formatDate(student.reportBDate) : '-')}
                      </div>
                    )) : (student.reportBDate ? formatDate(student.reportBDate) : '-')} 
                  </div>
                </TableCell>
              ) : null}
              {showTrialCountdown ? (
                <TableCell>
                  {daysLeft !== null && daysLeft >= 0 ? (
                    <Badge className="whitespace-nowrap" variant="warning">Còn {daysLeft} ngày</Badge>
                  ) : (
                    <Badge className="whitespace-nowrap" variant="destructive">Quá hạn {Math.abs(daysLeft ?? 0)} ngày</Badge>
                  )}
                </TableCell>
              ) : null}
              {showLeaveDate ? (
                <TableCell>
                  <div className="space-y-1">
                    {student.enrollments.length > 0 ? student.enrollments.map((enrollment) => (
                      <div key={`leave-${enrollment.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                        <span className="font-medium">{enrollment.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh'}:</span>{' '}
                        {enrollment.endDate ? formatDate(enrollment.endDate) : '-'}
                      </div>
                    )) : '-'}
                  </div>
                </TableCell>
              ) : null}
              <TableCell><Badge className="whitespace-nowrap" variant={displayedStatus === STATUS_EXPIRED ? 'destructive' : statusVariant}>{displayedStatus}</Badge></TableCell>
              <TableCell>{student.address || '-'}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-slate-50/70">
          <TableCell colSpan={totalColumns}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-slate-800">
                Tổng số học viên: <span className="text-slate-950">{totalEnrollmentCount}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" style={{ backgroundColor: '#2e8db714', color: '#2e8db7', borderColor: '#2e8db740' }}>
                  Toán: {mathEnrollmentCount}
                </Badge>
                <Badge variant="outline" style={{ backgroundColor: '#f0890014', color: '#f08900', borderColor: '#f0890040' }}>
                  Tiếng Anh: {eflEnrollmentCount}
                </Badge>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
