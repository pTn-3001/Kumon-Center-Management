"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PencilLine, PlusCircle, Save, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { formatDate, formatDateTime } from '@/lib/utils';
import { getSubjectLabel, KUMON_SCHEDULE } from '@/lib/kumon';
import type { ClassShift, SubjectCode } from '@/types';

type AcademicStudent = {
  id: number;
  fullName: string;
  status: string;
  subjects: SubjectCode[];
  currentLevels?: Partial<Record<SubjectCode, string>>;
  admissionDate: string;
  birthDate: string | null;
  parentPhone: string;
  parentName: string | null;
};

type AcademicAssessment = {
  id: number;
  studentId: number;
  subjectCode: SubjectCode;
  level: string;
  correctAnswers: number;
  totalQuestions: number;
  actualMinutes: number;
  standardMinutes: number;
  groupNo: number;
  testDate: string;
};

type AcademicWorksheetBatch = {
  id: number;
  subjectCode: SubjectCode;
  level: string;
  codeRange: string;
  quantity: number;
  receivedAt: string;
  note: string | null;
};

type AcademicWorksheetUsage = {
  id: number;
  batchId: number;
  studentId: number | null;
  quantity: number;
  usedAt: string;
  preparedBy: string | null;
  note: string | null;
};

type AcademicPersonalSchedule = {
  id: number;
  studentId: number;
  subjectCode: SubjectCode;
  scheduledAt: string;
  classShift: ClassShift;
  note: string | null;
};

type AcademicPayload = {
  students: AcademicStudent[];
  assessments: AcademicAssessment[];
  worksheetBatches: AcademicWorksheetBatch[];
  worksheetUsages: AcademicWorksheetUsage[];
  personalSchedules: AcademicPersonalSchedule[];
  attendances: Array<{
    id: number;
    classGroupId: number;
    classGroupLabel: string;
    subjectCode: SubjectCode;
    studentId: number;
    date: string;
    status: 'Hiện diện' | 'Vắng';
    makeUpClassGroupId: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type WorksheetAssignmentTrack = {
  studentId: number;
  subjectCode: SubjectCode;
};

type WorksheetAssignmentRow = {
  id: number;
  studentId: number;
  subjectCode: SubjectCode;
  date: string;
  worksheet: string;
};

type StockRow = {
  worksheetCode: string;
  opening: number;
  imported: number;
  used: number;
  generated: number;
  closing: number;
  matchedBatchIds: number[];
};

type WorksheetLoanRecord = {
  usageId: number;
  quantity: number;
  dueDate: string;
  borrowCenter: string;
  note: string;
  returned: boolean;
};

type InventorySubject = SubjectCode | 'WRITING';

type WorksheetRange = {
  level: string;
  minNumber: number;
  maxNumber: number;
  subjectCode: SubjectCode;
};

const levelBySubject: Record<SubjectCode, string[]> = {
  MATH: ['6A', '5A', '4A', '3A', '2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'AT-4A', 'AT-3A', 'AT-2A', 'AT-A', 'AT-B', 'AT-C', 'AT-D', 'AT-E', 'AT-F', 'AT-G', 'AT-H', 'AT-I', 'AT-J', 'AT-K', 'AT-L', 'AT-M', 'AT-N', 'DT-K1', 'DT-K2', 'DT-P1', 'DT-P2', 'DT-P3', 'DT-P4', 'DT-P5', 'DT-P6', 'DT-M1', 'DT-M2', 'DT-M3', 'DT-H'],
  EFL: ['7A', '6A', '5A', '4A', '3A', '2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'AT-7A', 'AT-6A', 'AT-5A', 'AT-4A', 'AT-3A', 'AT-2A', 'AT-A', 'AT-B', 'AT-C', 'AT-D', 'AT-E', 'AT-F', 'AT-G', 'AT-H', 'AT-I', 'AT-J', 'AT-K', 'AT-L', 'AT-M', 'AT-N', 'DT-K', 'DT-P1', 'DT-P2', 'DT-M', 'DT-H'],
};

const emptyAssessmentForm = {
  studentId: '',
  subjectCode: 'MATH' as SubjectCode,
  testType: 'AT' as 'AT' | 'DT',
  level: 'AT-A',
  correctAnswers: '0',
  totalQuestions: '100',
  actualMinutes: '0',
  standardMinutes: '30',
  groupNo: '1',
  testDate: new Date().toISOString().slice(0, 10),
};

const emptyBatchForm = {
  subjectCode: 'MATH' as SubjectCode,
  level: 'A1',
  codeRange: 'A1',
  quantity: '0',
  receivedAt: new Date().toISOString().slice(0, 10),
  note: '',
};

const emptyScheduleForm = {
  studentId: '',
  subjectCode: 'MATH' as SubjectCode,
  scheduledAt: new Date().toISOString().slice(0, 10) + 'T16:30',
  classShift: 'Ca 1' as ClassShift,
  note: '',
};

const academicTopTabs = ['hoc-thuat', 'kho'] as const;
type AcademicTopTab = typeof academicTopTabs[number];
const academicSubTabs = ['diem-so', 'lich-hoc', 'soan-bai'] as const;
type AcademicSubTab = typeof academicSubTabs[number];
const khoSubTabs = ['nhap-kho', 'ton-kho'] as const;
type KhoSubTab = typeof khoSubTabs[number];

const WORKSHEET_ASSIGNMENT_NOTE_PREFIX = '[WS_ASSIGN]';
const WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX = '[WS_ASSIGN_WRITING]';
const WORKSHEET_DAILY_NOTE_PREFIX = '[WS_DAILY_NOTE]';
const WORKSHEET_ASSIGNMENT_BATCH_NOTE_PREFIX = '[WS_ASSIGNMENT_BATCH]';
const WORKSHEET_WRITING_BATCH_NOTE_PREFIX = '[WS_WRITING_BATCH]';
const WORKSHEET_EXTRA_NOTE_PREFIX = '[WS_EXTRA]';
const WORKSHEET_LOAN_NOTE_PREFIX = '[WS_LOAN]';
const WORKSHEET_RETURN_NOTE_PREFIX = '[WS_RETURN]';
const WORKSHEET_STOCK_TRACKING_PREFIX = '[WS_STOCK_TRACKING]';
const WORKSHEET_ASSIGN_NOTE_DELIMITER = '::NOTE::';

const SPECIAL_WORKSHEET_RANGES: WorksheetRange[] = [
  { level: '6A', minNumber: 1, maxNumber: 191, subjectCode: 'MATH' },
  { level: '5A', minNumber: 1, maxNumber: 91, subjectCode: 'MATH' },
  { level: '7A', minNumber: 1, maxNumber: 191, subjectCode: 'EFL' },
  { level: '6A', minNumber: 1, maxNumber: 191, subjectCode: 'EFL' },
  { level: '5A', minNumber: 1, maxNumber: 91, subjectCode: 'EFL' },
];

function isAtLevel(level: string) {
  return /^AT-[A-Z0-9]+$/i.test(level.trim());
}

function isDtLevel(level: string) {
  return /^DT-[A-Z0-9]+$/i.test(level.trim());
}

function isFixedWorksheetCodeLevel(level: string) {
  return isAtLevel(level) || isDtLevel(level);
}

function getAssessmentLevelOptions(subjectCode: SubjectCode, testType: 'AT' | 'DT') {
  return levelBySubject[subjectCode].filter((level) => (testType === 'AT' ? isAtLevel(level) : isDtLevel(level)));
}

function normalizeAssessmentLevel(subjectCode: SubjectCode, testType: 'AT' | 'DT', level: string) {
  const options = getAssessmentLevelOptions(subjectCode, testType);
  if (options.includes(level)) {
    return level;
  }

  return options[0] ?? levelBySubject[subjectCode][0];
}

function isWorksheetAssignmentBatch(batch: AcademicWorksheetBatch) {
  return batch.note?.startsWith(WORKSHEET_ASSIGNMENT_BATCH_NOTE_PREFIX) ?? false;
}

function isWorksheetAssignmentUsage(usage: AcademicWorksheetUsage) {
  return (
    usage.note?.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)
    || usage.note?.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX)
    || usage.note?.startsWith(WORKSHEET_DAILY_NOTE_PREFIX)
    || false
  );
}

function extractWorksheetCodeFromNote(note: string | null) {
  if (!note) {
    return '';
  }

  const splitAssignmentPayload = (rawPayload: string) => {
    const match = rawPayload.match(/^(.*?)(?:\s*::NOTE::\s*(.*))?$/);
    if (!match) {
      return {
        worksheetCodeRaw: rawPayload.trim(),
      };
    }

    return {
      worksheetCodeRaw: (match[1] ?? '').trim(),
    };
  };

  const normalizeWorksheetCodeFromPayload = (rawPayload: string) => {
    const { worksheetCodeRaw } = splitAssignmentPayload(rawPayload);
    const codeMatch = worksheetCodeRaw.match(/^(AT-[A-Z0-9]+|DT-[A-Z0-9]+|[A-Z0-9-]*[A-Z]\d+)$/i);
    return codeMatch ? codeMatch[1].toUpperCase() : worksheetCodeRaw.toUpperCase();
  };

  if (note.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX)) {
    return normalizeWorksheetCodeFromPayload(note.slice(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX.length));
  }

  if (!note.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)) {
    return '';
  }

  return normalizeWorksheetCodeFromPayload(note.slice(WORKSHEET_ASSIGNMENT_NOTE_PREFIX.length));
}

function normalizeWorksheetCode(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function isWorksheetCodeValid(value: string) {
  const normalized = normalizeWorksheetCode(value);
  if (!normalized) {
    return false;
  }

  if (isFixedWorksheetCodeLevel(normalized)) {
    return true;
  }

  return /^[A-Z0-9-]*[A-Z]\d+$/i.test(normalized);
}

function getWorksheetParts(value: string) {
  const normalized = normalizeWorksheetCode(value);
  if (isFixedWorksheetCodeLevel(normalized)) {
    return {
      prefix: normalized,
      number: 0,
    };
  }

  const match = /^([A-Z0-9-]*[A-Z])(\d+)$/i.exec(normalized);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    number: Number(match[2]),
  };
}

function getWorksheetRange(worksheetCode: string, subjectCode: SubjectCode): WorksheetRange | null {
  const parts = getWorksheetParts(worksheetCode);
  if (!parts || isFixedWorksheetCodeLevel(parts.prefix)) {
    return null;
  }

  const range = SPECIAL_WORKSHEET_RANGES.find((item) => (
    item.subjectCode === subjectCode
    && item.level === parts.prefix
    && parts.number >= item.minNumber
    && parts.number <= item.maxNumber
  ));

  return range ?? null;
}

function getWorksheetRangeKey(worksheetCode: string, subjectCode: SubjectCode) {
  const range = getWorksheetRange(worksheetCode, subjectCode);
  return range ? `${range.subjectCode}-${range.level}` : null;
}

function getWorksheetCodesInRange(range: WorksheetRange) {
  const codes: string[] = [];
  for (let number = range.minNumber; number <= range.maxNumber; number += 10) {
    codes.push(normalizeWorksheetCode(`${range.level}${number}`));
  }
  return codes;
}

function toDateInputValue(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWorksheetNumberOptions(level: string) {
  if (isFixedWorksheetCodeLevel(level)) {
    return [0];
  }

  if (level === 'ZI') {
    return [21, 31, 41, 51, 61, 71, 81, 91];
  }

  if (level === 'ZII') {
    return [11, 21, 31, 41, 51, 61, 71, 81, 91];
  }

  const options: number[] = [];
  for (let value = 1; value <= 191; value += 10) {
    options.push(value);
  }
  return options;
}

function getInventorySubjectFromBatch(batch: AcademicWorksheetBatch) {
  if (batch.note?.startsWith(WORKSHEET_WRITING_BATCH_NOTE_PREFIX)) {
    return 'WRITING' as const;
  }
  return batch.subjectCode;
}

function getInventorySubjectLabel(subject: InventorySubject) {
  if (subject === 'WRITING') {
    return 'Kỹ năng viết';
  }
  return getSubjectLabel(subject);
}

function toDateTimeInputValue(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function AcademicWarehousePageContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AcademicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worksheetStudentSearch, setWorksheetStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<Date>(new Date());
  const [assessmentForm, setAssessmentForm] = useState(emptyAssessmentForm);
  const [batchForm, setBatchForm] = useState(emptyBatchForm);
  const [inventorySubject, setInventorySubject] = useState<InventorySubject>('MATH');
  const [inventoryWorksheetLevel, setInventoryWorksheetLevel] = useState('A');
  const [inventoryWorksheetNumber, setInventoryWorksheetNumber] = useState('1');
  const [stockSubject, setStockSubject] = useState<InventorySubject>('MATH');
  const [stockLevel, setStockLevel] = useState('A');
  const [stockMonthFilter, setStockMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [stockYearFilter, setStockYearFilter] = useState(String(new Date().getFullYear()));
  const [selectedStockRow, setSelectedStockRow] = useState<StockRow | null>(null);
  const [stockDetailOpen, setStockDetailOpen] = useState(false);
  const [stockEditForm, setStockEditForm] = useState({ opening: '0', used: '0', generated: '0', closing: '0' });
  const [loanForm, setLoanForm] = useState({
    quantity: '1',
    borrowCenter: '',
    note: '',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [savingStockAction, setSavingStockAction] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [editingAssessmentId, setEditingAssessmentId] = useState<number | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const activeTopTabFromQuery = searchParams.get('tab');
  const activeSubTabFromQuery = searchParams.get('subtab');
  const activeKhoSubTabFromQuery = searchParams.get('ksubtab');
  const currentTopTab: AcademicTopTab = academicTopTabs.includes(activeTopTabFromQuery as AcademicTopTab)
    ? (activeTopTabFromQuery as AcademicTopTab)
    : 'hoc-thuat';
  const currentSubTab: AcademicSubTab = academicSubTabs.includes(activeSubTabFromQuery as AcademicSubTab)
    ? (activeSubTabFromQuery as AcademicSubTab)
    : 'diem-so';
  const currentKhoSubTab: KhoSubTab = khoSubTabs.includes(activeKhoSubTabFromQuery as KhoSubTab)
    ? (activeKhoSubTabFromQuery as KhoSubTab)
    : 'nhap-kho';

  const selectedStudent = useMemo(
    () => data?.students.find((student) => student.id === selectedStudentId) ?? data?.students[0] ?? null,
    [data, selectedStudentId]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/hoc-thuat', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu học thuật');
        }

        const payload = (await response.json()) as AcademicPayload;
        setData(payload);

        if (payload.students.length > 0) {
          setSelectedStudentId((current) => current || payload.students[0].id);
        }

      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Có lỗi xảy ra');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    if (!data || selectedStudentId) {
      return;
    }

    const firstAvailableStudent = data.students.find((student) => student.status === 'Chính thức' || student.status === 'Học thử') ?? data.students[0];
    if (firstAvailableStudent) {
      setSelectedStudentId(firstAvailableStudent.id);
      setScheduleForm((current) => ({ ...current, studentId: String(firstAvailableStudent.id) }));
    }
  }, [data, selectedStudentId]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!scheduleForm.studentId && selectedStudent) {
      setScheduleForm((current) => ({ ...current, studentId: String(selectedStudent.id) }));
    }
  }, [data, scheduleForm.studentId, selectedStudent]);

  const worksheetSummary = useMemo(() => {
    const availableBatches = (data?.worksheetBatches ?? []).filter((batch) => !isWorksheetAssignmentBatch(batch));
    const availableUsages = (data?.worksheetUsages ?? []).filter((usage) => !isWorksheetAssignmentUsage(usage));
    const totalReceived = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
    const totalUsed = availableUsages.reduce((sum, usage) => sum + usage.quantity, 0);
    const totalLeft = totalReceived - totalUsed;
    return { totalReceived, totalUsed, totalLeft };
  }, [data]);

  const worksheetInventory = useMemo(() => {
    const availableBatches = (data?.worksheetBatches ?? []).filter((batch) => !isWorksheetAssignmentBatch(batch));
    const availableUsages = (data?.worksheetUsages ?? []).filter((usage) => !isWorksheetAssignmentUsage(usage));
    return availableBatches.map((batch) => ({
      ...batch,
      used: availableUsages.filter((usage) => usage.batchId === batch.id).reduce((sum, usage) => sum + usage.quantity, 0),
    }));
  }, [data]);

  useEffect(() => {
    if (stockSubject === 'WRITING') {
      if (stockLevel !== 'ZI' && stockLevel !== 'ZII') {
        setStockLevel('ZI');
      }
      return;
    }

    if (!levelBySubject[stockSubject].includes(stockLevel)) {
      setStockLevel(levelBySubject[stockSubject][0]);
    }
  }, [stockLevel, stockSubject]);

  const newlyImportedInMonth = useMemo(() => {
    const now = new Date();
    return worksheetInventory
      .filter((batch) => {
        const importedAt = new Date(batch.receivedAt);
        return importedAt.getMonth() === now.getMonth() && importedAt.getFullYear() === now.getFullYear();
      })
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [worksheetInventory]);

  const stockLevelOptions = useMemo(() => {
    return stockSubject === 'WRITING' ? ['ZI', 'ZII'] : levelBySubject[stockSubject];
  }, [stockSubject]);

  const stockPeriod = useMemo(() => {
    const year = Number(stockYearFilter);
    const month = Number(stockMonthFilter);
    const startDate = new Date(year, month - 1, 1);
    const nextMonthStartDate = new Date(year, month, 1);

    return {
      startKey: toDateInputValue(startDate),
      nextStartKey: toDateInputValue(nextMonthStartDate),
    };
  }, [stockMonthFilter, stockYearFilter]);

  const stockYearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    (data?.worksheetBatches ?? []).forEach((batch) => years.add(new Date(batch.receivedAt).getFullYear()));
    (data?.worksheetUsages ?? []).forEach((usage) => years.add(new Date(usage.usedAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [data?.worksheetBatches, data?.worksheetUsages]);

  const stockRows = useMemo(() => {
    const assignmentBatchById = new Map<number, AcademicWorksheetBatch>(
      (data?.worksheetBatches ?? []).map((batch) => [batch.id, batch])
    );
    const availableUsages = (data?.worksheetUsages ?? []).filter((usage) => !isWorksheetAssignmentUsage(usage));

    const firstRangeAssignmentUsageByKey = new Map<string, { usageId: number; worksheetCode: string }>();
    (data?.worksheetUsages ?? []).forEach((usage) => {
      if (!usage.note?.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)) {
        return;
      }

      const batch = assignmentBatchById.get(usage.batchId);
      if (!batch) {
        return;
      }

      const worksheet = extractWorksheetCodeFromNote(usage.note);
      if (!worksheet) {
        return;
      }

      const rangeKey = getWorksheetRangeKey(worksheet, batch.subjectCode);
      if (!rangeKey) {
        return;
      }

      const current = firstRangeAssignmentUsageByKey.get(rangeKey);
      const usageTime = new Date(usage.usedAt).getTime();
      if (!current) {
        firstRangeAssignmentUsageByKey.set(rangeKey, { usageId: usage.id, worksheetCode: worksheet });
        return;
      }

      const currentUsage = (data?.worksheetUsages ?? []).find((item) => item.id === current.usageId);
      const currentTime = currentUsage ? new Date(currentUsage.usedAt).getTime() : Number.POSITIVE_INFINITY;
      const isEarlier = usageTime < currentTime || (usageTime === currentTime && usage.id < current.usageId);
      if (isEarlier) {
        firstRangeAssignmentUsageByKey.set(rangeKey, { usageId: usage.id, worksheetCode: worksheet });
      }
    });

    const assignmentUsedBeforeByCode = new Map<string, number>();
    const assignmentUsedInPeriodByCode = new Map<string, number>();

    (data?.worksheetUsages ?? []).forEach((usage) => {
      const usageDate = toDateInputValue(usage.usedAt);
      const worksheet = extractWorksheetCodeFromNote(usage.note);
      if (!worksheet) {
        return;
      }

      let normalizedSubject: InventorySubject | null = null;
      let shouldCount = false;

      if (usage.note?.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX)) {
        normalizedSubject = 'WRITING';
        shouldCount = true;
      } else if (usage.note?.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)) {
        const batch = assignmentBatchById.get(usage.batchId);
        if (!batch) {
          return;
        }

        normalizedSubject = batch.subjectCode;
        const rangeKey = getWorksheetRangeKey(worksheet, batch.subjectCode);
        if (!rangeKey) {
          shouldCount = true;
        } else {
          const firstUsage = firstRangeAssignmentUsageByKey.get(rangeKey);
          shouldCount = firstUsage?.usageId === usage.id;
        }
      }

      if (!normalizedSubject || normalizedSubject !== stockSubject || !shouldCount) {
        return;
      }

      const accumulateToMap = (targetCodeKey: string) => {
        if (usageDate < stockPeriod.startKey) {
          assignmentUsedBeforeByCode.set(targetCodeKey, (assignmentUsedBeforeByCode.get(targetCodeKey) ?? 0) + usage.quantity);
        } else if (usageDate >= stockPeriod.startKey && usageDate < stockPeriod.nextStartKey) {
          assignmentUsedInPeriodByCode.set(targetCodeKey, (assignmentUsedInPeriodByCode.get(targetCodeKey) ?? 0) + usage.quantity);
        }
      };

      if (usage.note?.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)) {
        const range = getWorksheetRange(worksheet, normalizedSubject as SubjectCode);
        if (range) {
          getWorksheetCodesInRange(range).forEach((codeKey) => accumulateToMap(codeKey));
          return;
        }
      }

      accumulateToMap(normalizeWorksheetCode(worksheet));
    });

    const codeList = isFixedWorksheetCodeLevel(stockLevel)
      ? [stockLevel]
      : getWorksheetNumberOptions(stockLevel).map((numberValue) => `${stockLevel}${numberValue}`);

    return codeList.map((worksheetCode) => {
      const matchedBatches = worksheetInventory.filter((batch) => (
        getInventorySubjectFromBatch(batch) === stockSubject
        && normalizeWorksheetCode(batch.level) === normalizeWorksheetCode(stockLevel)
        && normalizeWorksheetCode(batch.codeRange) === normalizeWorksheetCode(worksheetCode)
      ));

      const openingImported = matchedBatches
        .filter((batch) => toDateInputValue(batch.receivedAt) < stockPeriod.startKey)
        .reduce((sum, batch) => sum + batch.quantity, 0);

      const importedInPeriod = matchedBatches
        .filter((batch) => {
          const batchDate = toDateInputValue(batch.receivedAt);
          return batchDate >= stockPeriod.startKey && batchDate < stockPeriod.nextStartKey;
        })
        .reduce((sum, batch) => sum + batch.quantity, 0);

      const batchUsages = availableUsages.filter((usage: AcademicWorksheetUsage) => matchedBatches.some((batch) => batch.id === usage.batchId));
      const isGeneratedUsage = (usage: AcademicWorksheetUsage) => (
        usage.note?.startsWith(WORKSHEET_EXTRA_NOTE_PREFIX)
        || usage.note?.startsWith(WORKSHEET_LOAN_NOTE_PREFIX)
        || usage.note?.startsWith(WORKSHEET_RETURN_NOTE_PREFIX)
      );

      const usagesBeforePeriod = batchUsages.filter((usage) => {
        const usageDate = toDateInputValue(usage.usedAt);
        return usageDate < stockPeriod.startKey;
      });

      const usagesInPeriod = batchUsages.filter((usage) => {
        const usageDate = toDateInputValue(usage.usedAt);
        return usageDate >= stockPeriod.startKey && usageDate < stockPeriod.nextStartKey;
      });

      const generatedBefore = usagesBeforePeriod
        .filter((usage: AcademicWorksheetUsage) => isGeneratedUsage(usage))
        .reduce((sum: number, usage: AcademicWorksheetUsage) => sum + usage.quantity, 0);

      const generatedUsageInPeriod = usagesInPeriod
        .filter((usage: AcademicWorksheetUsage) => isGeneratedUsage(usage))
        .reduce((sum: number, usage: AcademicWorksheetUsage) => sum + usage.quantity, 0);

      const baseUsedBefore = usagesBeforePeriod
        .filter((usage: AcademicWorksheetUsage) => !isGeneratedUsage(usage))
        .reduce((sum: number, usage: AcademicWorksheetUsage) => sum + usage.quantity, 0);

      const baseUsed = usagesInPeriod
        .filter((usage: AcademicWorksheetUsage) => !isGeneratedUsage(usage))
        .reduce((sum: number, usage: AcademicWorksheetUsage) => sum + usage.quantity, 0);

      const normalizedWorksheetCode = normalizeWorksheetCode(worksheetCode);
      const assignmentUsedBefore = assignmentUsedBeforeByCode.get(normalizedWorksheetCode) ?? 0;
      const assignmentUsed = assignmentUsedInPeriodByCode.get(normalizedWorksheetCode) ?? 0;

      const opening = openingImported - baseUsedBefore - assignmentUsedBefore - generatedBefore;

      const used = baseUsed + assignmentUsed;
      const generated = generatedUsageInPeriod;
      const closing = opening + importedInPeriod - used - generated;

      return {
        worksheetCode,
        opening,
        imported: importedInPeriod,
        used,
        generated,
        closing,
        matchedBatchIds: matchedBatches.map((batch) => batch.id),
      } satisfies StockRow;
    });
  }, [data?.worksheetBatches, data?.worksheetUsages, stockLevel, stockPeriod.nextStartKey, stockPeriod.startKey, stockSubject, worksheetInventory]);

  const worksheetAssignmentBatchMap = useMemo(() => {
    const entries = (data?.worksheetBatches ?? [])
      .filter((batch) => isWorksheetAssignmentBatch(batch))
      .map((batch) => [batch.id, batch] as const);
    return new Map<number, AcademicWorksheetBatch>(entries);
  }, [data]);

  const worksheetAssignmentRows = useMemo(() => {
    return (data?.worksheetUsages ?? [])
      .filter((usage) => isWorksheetAssignmentUsage(usage) && usage.studentId)
      .map((usage) => {
        const batch = worksheetAssignmentBatchMap.get(usage.batchId);
        const worksheet = extractWorksheetCodeFromNote(usage.note);
        if (!batch || !worksheet || !usage.studentId) {
          return null;
        }

        return {
          id: usage.id,
          studentId: usage.studentId,
          subjectCode: batch.subjectCode,
          date: toDateInputValue(usage.usedAt),
          worksheet,
        } satisfies WorksheetAssignmentRow;
      })
      .filter((item): item is WorksheetAssignmentRow => Boolean(item));
  }, [data, worksheetAssignmentBatchMap]);

  const worksheetAssessmentByTrack = useMemo(() => {
    const map = new Map<string, AcademicAssessment>();
    const sorted = [...(data?.assessments ?? [])].sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());

    sorted.forEach((assessment) => {
      const key = `${assessment.studentId}-${assessment.subjectCode}`;
      if (!map.has(key)) {
        map.set(key, assessment);
      }
    });

    return map;
  }, [data]);

  const worksheetProgressByTrack = useMemo(() => {
    const map = new Map<string, string>();
    const maxByTrack = new Map<string, { worksheet: string; number: number; prefix: string }>();

    worksheetAssignmentRows.forEach((item) => {
      const parts = getWorksheetParts(item.worksheet);
      if (!parts) {
        return;
      }

      const key = `${item.studentId}-${item.subjectCode}`;
      const current = maxByTrack.get(key);
      if (!current || parts.number > current.number) {
        maxByTrack.set(key, { worksheet: item.worksheet, number: parts.number, prefix: parts.prefix });
      }
    });

    maxByTrack.forEach((value, key) => {
      map.set(key, value.worksheet);
    });

    return map;
  }, [worksheetAssignmentRows]);

  const activeLearningStudents = useMemo(
    () => (data?.students ?? []).filter((student) => student.status === 'Chính thức' || student.status === 'Học thử'),
    [data]
  );

  const filteredWorksheetStudents = useMemo(() => {
    const keyword = worksheetStudentSearch.trim().toLowerCase();
    if (!keyword) return data?.students ?? [];
    return (data?.students ?? []).filter((student) => student.fullName.toLowerCase().includes(keyword));
  }, [data?.students, worksheetStudentSearch]);

  const selectedStudentPresentAttendances = useMemo(() => {
    if (!data || !selectedStudent) {
      return [];
    }

    return data.attendances
      .filter((item) => item.studentId === selectedStudent.id && item.status === 'Hiện diện')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, selectedStudent]);

  const selectedStudentSchedules = useMemo(() => {
    if (!data) {
      return [] as AcademicPersonalSchedule[];
    }

    if (!selectedStudent) {
      return data.personalSchedules;
    }

    return data.personalSchedules.filter((item) => item.studentId === selectedStudent.id);
  }, [data, selectedStudent]);

  const scheduleCalendarMarkers = useMemo(() => {
    const mathSet = new Set<string>();
    const eflSet = new Set<string>();

    selectedStudentPresentAttendances.forEach((item) => {
      const dateText = toDateInputValue(item.date);
      if (item.subjectCode === 'EFL') {
        eflSet.add(dateText);
        return;
      }
      mathSet.add(dateText);
    });

    const toDates = (values: string[]) => values.map((dateText) => {
      const [year, month, day] = dateText.split('-').map(Number);
      return new Date(year, month - 1, day);
    });

    const mixed = Array.from(mathSet).filter((dateText) => eflSet.has(dateText));
    const mathOnly = Array.from(mathSet).filter((dateText) => !eflSet.has(dateText));
    const eflOnly = Array.from(eflSet).filter((dateText) => !mathSet.has(dateText));

    return {
      mathOnly: toDates(mathOnly),
      eflOnly: toDates(eflOnly),
      mixed: toDates(mixed),
    };
  }, [selectedStudentPresentAttendances]);

  const selectedDateAttendances = useMemo(() => {
    if (!selectedDate) {
      return [] as typeof selectedStudentPresentAttendances;
    }

    const target = toDateInputValue(selectedDate);
    return selectedStudentPresentAttendances.filter((item) => toDateInputValue(item.date) === target);
  }, [selectedDate, selectedStudentPresentAttendances]);

  const monthlyPresentAttendances = useMemo(() => {
    const targetMonth = selectedCalendarMonth.getMonth();
    const targetYear = selectedCalendarMonth.getFullYear();

    return selectedStudentPresentAttendances.filter((item) => {
      const date = new Date(item.date);
      return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
    });
  }, [selectedCalendarMonth, selectedStudentPresentAttendances]);

  const monthlyMathCount = useMemo(
    () => monthlyPresentAttendances.filter((item) => item.subjectCode === 'MATH').length,
    [monthlyPresentAttendances]
  );

  const monthlyEflCount = useMemo(
    () => monthlyPresentAttendances.filter((item) => item.subjectCode === 'EFL').length,
    [monthlyPresentAttendances]
  );

  const selectedMonthLabel = useMemo(
    () => `Tháng ${selectedCalendarMonth.getMonth() + 1}/${selectedCalendarMonth.getFullYear()}`,
    [selectedCalendarMonth]
  );

  async function refreshData() {
    const response = await fetch('/api/hoc-thuat', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu học thuật');
    }

    const payload = (await response.json()) as AcademicPayload;
    setData(payload);
  }

  async function submitAssessment() {
    if (!assessmentForm.studentId) {
      return;
    }

    const payload = {
      studentId: Number(assessmentForm.studentId),
      subjectCode: assessmentForm.subjectCode,
      level: assessmentForm.level,
      correctAnswers: Number(assessmentForm.correctAnswers),
      totalQuestions: Number(assessmentForm.totalQuestions),
      actualMinutes: Number(assessmentForm.actualMinutes),
      standardMinutes: Number(assessmentForm.standardMinutes),
      groupNo: Number(assessmentForm.groupNo),
      testDate: assessmentForm.testDate,
    };

    const response = await fetch(editingAssessmentId ? `/api/hoc-thuat/assessments/${editingAssessmentId}` : '/api/hoc-thuat/assessments', {
      method: editingAssessmentId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Không thể lưu bài thi');
    }

    setAssessmentForm(emptyAssessmentForm);
    setEditingAssessmentId(null);
    await refreshData();
  }

  async function submitBatch() {
    const normalizedLevel = normalizeWorksheetCode(inventoryWorksheetLevel);
    if (!normalizedLevel) {
      throw new Error('Vui lòng chọn level worksheet');
    }

    const numberOptions = getWorksheetNumberOptions(normalizedLevel);
    if (!isFixedWorksheetCodeLevel(normalizedLevel) && !numberOptions.includes(Number(inventoryWorksheetNumber))) {
      throw new Error('Số worksheet không hợp lệ với level đã chọn');
    }

    const worksheetCode = isFixedWorksheetCodeLevel(normalizedLevel) ? normalizedLevel : `${normalizedLevel}${Number(inventoryWorksheetNumber)}`;
    const mappedSubjectCode: SubjectCode = inventorySubject === 'WRITING' ? 'MATH' : inventorySubject;
    const noteParts = [
      inventorySubject === 'WRITING' ? WORKSHEET_WRITING_BATCH_NOTE_PREFIX : '',
      batchForm.note.trim(),
    ].filter((value) => value.length > 0);

    const payload = {
      subjectCode: mappedSubjectCode,
      level: normalizedLevel,
      codeRange: worksheetCode,
      quantity: Number(batchForm.quantity),
      receivedAt: batchForm.receivedAt,
      note: noteParts.join(' '),
    };

    const response = await fetch(editingBatchId ? `/api/hoc-thuat/worksheet-batches/${editingBatchId}` : '/api/hoc-thuat/worksheet-batches', {
      method: editingBatchId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Không thể lưu worksheet batch');
    }

    setBatchForm(emptyBatchForm);
    setInventorySubject('MATH');
    setInventoryWorksheetLevel('A');
    setInventoryWorksheetNumber('1');
    setEditingBatchId(null);
    await refreshData();
  }

  async function submitSchedule() {
    if (!scheduleForm.studentId) {
      return;
    }

    const payload = {
      studentId: Number(scheduleForm.studentId),
      subjectCode: scheduleForm.subjectCode,
      scheduledAt: scheduleForm.scheduledAt,
      classShift: scheduleForm.classShift,
      note: scheduleForm.note,
    };

    const response = await fetch(editingScheduleId ? `/api/hoc-thuat/personal-schedules/${editingScheduleId}` : '/api/hoc-thuat/personal-schedules', {
      method: editingScheduleId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Không thể lưu lịch học cá nhân');
    }

    setScheduleForm(emptyScheduleForm);
    setEditingScheduleId(null);
    await refreshData();
  }

  async function deleteAssessment(id: number) {
    await fetch(`/api/hoc-thuat/assessments/${id}`, { method: 'DELETE' });
    if (editingAssessmentId === id) {
      setAssessmentForm(emptyAssessmentForm);
      setEditingAssessmentId(null);
    }
    await refreshData();
  }

  async function deleteBatch(id: number) {
    await fetch(`/api/hoc-thuat/worksheet-batches/${id}`, { method: 'DELETE' });
    if (editingBatchId === id) {
      setBatchForm(emptyBatchForm);
      setEditingBatchId(null);
    }
    await refreshData();
  }

  async function deleteSchedule(id: number) {
    await fetch(`/api/hoc-thuat/personal-schedules/${id}`, { method: 'DELETE' });
    if (editingScheduleId === id) {
      setScheduleForm(emptyScheduleForm);
      setEditingScheduleId(null);
    }
    await refreshData();
  }

  function startAssessmentEdit(item: AcademicAssessment) {
    const nextTestType: 'AT' | 'DT' = isDtLevel(item.level) ? 'DT' : 'AT';
    setEditingAssessmentId(item.id);
    setAssessmentForm({
      studentId: String(item.studentId),
      subjectCode: item.subjectCode,
      testType: nextTestType,
      level: normalizeAssessmentLevel(item.subjectCode, nextTestType, item.level),
      correctAnswers: String(item.correctAnswers),
      totalQuestions: String(item.totalQuestions),
      actualMinutes: String(item.actualMinutes),
      standardMinutes: String(item.standardMinutes),
      groupNo: String(item.groupNo),
      testDate: toDateInputValue(item.testDate),
    });
  }

  function startBatchEdit(item: AcademicWorksheetBatch) {
    const subject = getInventorySubjectFromBatch(item);
    const parts = getWorksheetParts(item.codeRange);
    setEditingBatchId(item.id);
    setInventorySubject(subject);
    setInventoryWorksheetLevel(parts?.prefix ?? item.level);
    setInventoryWorksheetNumber(parts ? String(parts.number) : '1');
    setBatchForm({
      subjectCode: item.subjectCode,
      level: item.level,
      codeRange: item.codeRange,
      quantity: String(item.quantity),
      receivedAt: toDateInputValue(item.receivedAt),
      note: (item.note ?? '').replace(WORKSHEET_WRITING_BATCH_NOTE_PREFIX, '').trim(),
    });
  }

  function startScheduleEdit(item: AcademicPersonalSchedule) {
    setEditingScheduleId(item.id);
    setScheduleForm({
      studentId: String(item.studentId),
      subjectCode: item.subjectCode,
      scheduledAt: toDateTimeInputValue(item.scheduledAt),
      classShift: item.classShift,
      note: item.note ?? '',
    });
  }

  function openStockDetail(row: StockRow) {
    setSelectedStockRow(row);
    setStockEditForm({
      opening: String(row.opening),
      used: String(row.used),
      generated: String(row.generated),
      closing: String(row.closing),
    });
    setLoanForm((current) => ({
      ...current,
      quantity: '1',
      borrowCenter: '',
      note: '',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    }));
    setStockDetailOpen(true);
  }

  async function ensureBatchForStockAction(row: StockRow) {
    if (row.matchedBatchIds.length > 0) {
      return row.matchedBatchIds[0];
    }

    const subjectCode = stockSubject === 'WRITING' ? 'MATH' : stockSubject;
    const noteParts = [
      stockSubject === 'WRITING' ? WORKSHEET_WRITING_BATCH_NOTE_PREFIX : '',
      WORKSHEET_STOCK_TRACKING_PREFIX,
    ].filter(Boolean);

    const createResponse = await fetch('/api/hoc-thuat/worksheet-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectCode,
        level: stockLevel,
        codeRange: row.worksheetCode,
        quantity: 0,
        receivedAt: new Date().toISOString().slice(0, 10),
        note: noteParts.join(' '),
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Không thể tạo mã worksheet theo dõi tồn kho');
    }

    const created = (await createResponse.json()) as AcademicWorksheetBatch;
    return created.id;
  }

  async function createUsage(batchId: number, quantity: number, noteValue: string) {
    const response = await fetch('/api/hoc-thuat/worksheet-usages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        studentId: null,
        quantity,
        usedAt: new Date().toISOString().slice(0, 10),
        preparedBy: null,
        note: noteValue,
      }),
    });

    if (!response.ok) {
      throw new Error('Không thể cập nhật tồn kho worksheet');
    }
  }

  async function submitStockEdit() {
    if (!selectedStockRow) return;

    setSavingStockAction(true);
    try {
      const targetOpening = Number(stockEditForm.opening) || 0;
      const targetUsed = Number(stockEditForm.used) || 0;
      const targetGenerated = Number(stockEditForm.generated) || 0;
      const targetClosing = Number(stockEditForm.closing) || 0;

      const batchId = await ensureBatchForStockAction(selectedStockRow);

      const openingDelta = targetOpening - selectedStockRow.opening;
      if (openingDelta > 0) {
        const response = await fetch('/api/hoc-thuat/worksheet-batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectCode: stockSubject === 'WRITING' ? 'MATH' : stockSubject,
            level: stockLevel,
            codeRange: selectedStockRow.worksheetCode,
            quantity: openingDelta,
            receivedAt: new Date().toISOString().slice(0, 10),
            note: WORKSHEET_STOCK_TRACKING_PREFIX,
          }),
        });
        if (!response.ok) throw new Error('Không thể tăng tồn đầu');
      } else if (openingDelta < 0) {
        await createUsage(batchId, Math.abs(openingDelta), '[WS_OPENING_REDUCE] giảm tồn đầu');
      }

      const usedDelta = targetUsed - selectedStockRow.used;
      if (usedDelta !== 0) {
        await createUsage(batchId, usedDelta, '[WS_USED_ADJUST] điều chỉnh sử dụng');
      }

      const generatedDelta = targetGenerated - selectedStockRow.generated;
      if (generatedDelta !== 0) {
        await createUsage(batchId, generatedDelta, `${WORKSHEET_EXTRA_NOTE_PREFIX} phát sinh ngoài sử dụng`);
      }

      const currentClosing = selectedStockRow.closing;
      const closingDelta = currentClosing - targetClosing;
      if (closingDelta !== 0) {
        await createUsage(batchId, closingDelta, '[WS_CLOSING_ADJUST] điều chỉnh tồn cuối');
      }

      await refreshData();
      setStockDetailOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu chỉnh sửa tồn kho');
    } finally {
      setSavingStockAction(false);
    }
  }

  const activeLoanRecords = useMemo(() => {
    if (!selectedStockRow || !data) return [] as WorksheetLoanRecord[];

    const rowBatchIds = new Set(selectedStockRow.matchedBatchIds);
    const usages = data.worksheetUsages.filter((usage) => rowBatchIds.has(usage.batchId));
    const returnedLoanIds = new Set<number>();

    usages.forEach((usage) => {
      if (!usage.note?.startsWith(WORKSHEET_RETURN_NOTE_PREFIX)) return;
      const match = /loanUsageId=(\d+)/.exec(usage.note);
      if (match) returnedLoanIds.add(Number(match[1]));
    });

    return usages
      .filter((usage) => usage.note?.startsWith(WORKSHEET_LOAN_NOTE_PREFIX))
      .map((usage) => {
        const dueDate = /dueDate=(\d{4}-\d{2}-\d{2})/.exec(usage.note ?? '')?.[1] ?? '-';
        const borrowCenter = /borrowCenter=([^;]+)/.exec(usage.note ?? '')?.[1] ?? 'Không rõ đơn vị';
        const loanNote = /note=([^;]+)/.exec(usage.note ?? '')?.[1] ?? '';
        return {
          usageId: usage.id,
          quantity: usage.quantity,
          dueDate,
          borrowCenter,
          note: decodeURIComponent(loanNote),
          returned: returnedLoanIds.has(usage.id),
        } satisfies WorksheetLoanRecord;
      })
      .filter((item) => !item.returned);
  }, [data, selectedStockRow]);

  async function submitWorksheetLoan() {
    if (!selectedStockRow) return;

    setSavingStockAction(true);
    try {
      const quantity = Number(loanForm.quantity) || 0;
      if (quantity <= 0) {
        throw new Error('Số lượng cho mượn phải lớn hơn 0');
      }
      if (!loanForm.borrowCenter.trim()) {
        throw new Error('Vui lòng nhập trung tâm mượn');
      }

      const batchId = await ensureBatchForStockAction(selectedStockRow);
      const derivedSubjectCode: SubjectCode = stockSubject === 'WRITING' ? 'MATH' : stockSubject;
      const derivedWorksheetType = selectedStockRow.worksheetCode;
      const encodedNote = encodeURIComponent(loanForm.note.trim());
      const noteValue = `${WORKSHEET_LOAN_NOTE_PREFIX} dueDate=${loanForm.dueDate};borrowCenter=${loanForm.borrowCenter.trim()};worksheetType=${derivedWorksheetType};subject=${derivedSubjectCode};note=${encodedNote}`;

      await createUsage(batchId, quantity, noteValue);
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu phiếu cho mượn worksheet');
    } finally {
      setSavingStockAction(false);
    }
  }

  async function markLoanReturned(loan: WorksheetLoanRecord) {
    if (!selectedStockRow) return;

    setSavingStockAction(true);
    try {
      const batchId = await ensureBatchForStockAction(selectedStockRow);
      const noteValue = `${WORKSHEET_RETURN_NOTE_PREFIX} loanUsageId=${loan.usageId};borrowCenter=${loan.borrowCenter}`;
      await createUsage(batchId, -Math.abs(loan.quantity), noteValue);
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể ghi nhận hoàn trả worksheet');
    } finally {
      setSavingStockAction(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Đang tải dữ liệu học thuật...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {currentTopTab === 'hoc-thuat' ? (
          <Tabs value={currentSubTab} className="space-y-4">

            <TabsContent value="diem-so" className="space-y-6">
              <div className="grid gap-4">
                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg">{editingAssessmentId ? 'Cập nhật bài thi' : 'Thêm bài thi'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Học viên</Label>
                      <Select value={assessmentForm.studentId} onValueChange={(value) => setAssessmentForm((current) => ({ ...current, studentId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Chọn học viên" /></SelectTrigger>
                        <SelectContent>
                          {data?.students.map((student) => <SelectItem key={student.id} value={String(student.id)}>{student.fullName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Môn</Label>
                      <Select value={assessmentForm.subjectCode} onValueChange={(value) => {
                        const subjectCode = value as SubjectCode;
                        setAssessmentForm((current) => ({
                          ...current,
                          subjectCode,
                          level: normalizeAssessmentLevel(subjectCode, current.testType, current.level),
                        }));
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MATH">Toán</SelectItem>
                          <SelectItem value="EFL">Tiếng Anh</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Bài thi</Label>
                        <Select value={assessmentForm.testType} onValueChange={(value) => {
                          const testType = value as 'AT' | 'DT';
                          setAssessmentForm((current) => ({
                            ...current,
                            testType,
                            level: normalizeAssessmentLevel(current.subjectCode, testType, current.level),
                          }));
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DT">Bài kiểm tra đầu vào</SelectItem>
                            <SelectItem value="AT">Bài kiểm tra kết thúc trình độ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Trình độ</Label>
                        <Select value={assessmentForm.level} onValueChange={(value) => setAssessmentForm((current) => ({ ...current, level: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {getAssessmentLevelOptions(assessmentForm.subjectCode, assessmentForm.testType).map((level) => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Kết quả đúng / tổng</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" value={assessmentForm.correctAnswers} onChange={(event) => setAssessmentForm((current) => ({ ...current, correctAnswers: event.target.value }))} />
                        <Input type="number" value={assessmentForm.totalQuestions} onChange={(event) => setAssessmentForm((current) => ({ ...current, totalQuestions: event.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Thời gian thực tế</Label>
                        <Input type="number" value={assessmentForm.actualMinutes} onChange={(event) => setAssessmentForm((current) => ({ ...current, actualMinutes: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Thời gian chuẩn</Label>
                        <Input type="number" value={assessmentForm.standardMinutes} onChange={(event) => setAssessmentForm((current) => ({ ...current, standardMinutes: event.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Ngày thi</Label>
                        <Input type="date" value={assessmentForm.testDate} onChange={(event) => setAssessmentForm((current) => ({ ...current, testDate: event.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nhóm</Label>
                      <Input type="number" value={assessmentForm.groupNo} onChange={(event) => setAssessmentForm((current) => ({ ...current, groupNo: event.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => void submitAssessment()} className="flex-1"><PlusCircle className="mr-2 h-4 w-4" />{editingAssessmentId ? 'Cập nhật' : 'Lưu bài thi'}</Button>
                      {editingAssessmentId ? <Button type="button" variant="outline" onClick={() => { setEditingAssessmentId(null); setAssessmentForm(emptyAssessmentForm); }}>Hủy</Button> : null}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Học viên</TableHead>
                    <TableHead>Môn</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Điểm</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Nhóm</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {(data?.assessments ?? [])
                      .slice()
                      .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())
                      .map((item) => {
                        const student = data?.students.find((candidate) => candidate.id === item.studentId);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{student?.fullName ?? 'Không xác định'}</TableCell>
                            <TableCell>{getSubjectLabel(item.subjectCode)}</TableCell>
                            <TableCell><Badge variant="secondary">{item.level}</Badge></TableCell>
                            <TableCell>{item.correctAnswers}/{item.totalQuestions}</TableCell>
                            <TableCell>{item.actualMinutes}/{item.standardMinutes} phút</TableCell>
                            <TableCell>Nhóm {item.groupNo}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => startAssessmentEdit(item)}>Sửa</Button>
                                <Button type="button" size="sm" variant="destructive" onClick={() => void deleteAssessment(item.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="soan-bai" className="space-y-4">
              <Card className="border bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Nhật ký worksheet theo học viên</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tìm theo họ tên học viên</Label>
                    <div className="relative">
                      <Input
                        value={worksheetStudentSearch}
                        onChange={(event) => setWorksheetStudentSearch(event.target.value)}
                        placeholder="Tìm họ tên học viên..."
                        className="pl-10"
                      />
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[#2e8db7]">Toán</p>
                      {filteredWorksheetStudents
                        .filter((student) => student.subjects?.includes('MATH'))
                        .map((student) => {
                          const mathKey = `${student.id}-MATH`;
                          const level = student.currentLevels?.MATH ?? worksheetAssessmentByTrack.get(mathKey)?.level ?? '-';
                          const progress = worksheetProgressByTrack.get(mathKey) ?? '-';
                          const isMathDtTrack = isDtLevel(level);
                          return (
                            isMathDtTrack ? (
                              <div key={`MATH-${student.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-80">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-950">{student.fullName}</p>
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-[#2e8db7] text-white">Toán</Badge>
                                    <Badge variant="secondary">DT</Badge>
                                  </div>
                                </div>
                                <p className="mt-2 text-sm text-slate-700">Level: {level} · Tiến độ: {progress}</p>
                                <p className="mt-1 text-xs text-muted-foreground">DT chỉ quản lý ở Nhập kho/Tồn kho và Thêm bài thi, không soạn bài.</p>
                              </div>
                            ) : (
                              <Link key={`MATH-${student.id}`} href={`/hoc-thuat/worksheet/${student.id}?subject=MATH`} className="block rounded-2xl border border-blue-200 bg-blue-50 p-4 transition hover:border-blue-400 hover:bg-blue-100">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-950">{student.fullName}</p>
                                  <Badge className="bg-[#2e8db7] text-white">Toán</Badge>
                                </div>
                                <p className="mt-2 text-sm text-slate-700">Level: {level} · Tiến độ: {progress}</p>
                              </Link>
                            )
                          );
                        })}
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[#f08900]">Tiếng Anh</p>
                      {filteredWorksheetStudents
                        .filter((student) => student.subjects?.includes('EFL'))
                        .map((student) => {
                          const eflKey = `${student.id}-EFL`;
                          const level = student.currentLevels?.EFL ?? worksheetAssessmentByTrack.get(eflKey)?.level ?? '-';
                          const progress = worksheetProgressByTrack.get(eflKey) ?? '-';
                          const isEflDtTrack = isDtLevel(level);
                          return (
                            isEflDtTrack ? (
                              <div key={`EFL-${student.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-80">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-950">{student.fullName}</p>
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-[#f08900] text-white">Tiếng Anh</Badge>
                                    <Badge variant="secondary">DT</Badge>
                                  </div>
                                </div>
                                <p className="mt-2 text-sm text-slate-700">Level: {level} · Tiến độ: {progress}</p>
                                <p className="mt-1 text-xs text-muted-foreground">DT chỉ quản lý ở Nhập kho/Tồn kho và Thêm bài thi, không soạn bài.</p>
                              </div>
                            ) : (
                              <Link key={`EFL-${student.id}`} href={`/hoc-thuat/worksheet/${student.id}?subject=EFL`} className="block rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-400 hover:bg-emerald-100">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-950">{student.fullName}</p>
                                  <Badge className="bg-[#f08900] text-white">Tiếng Anh</Badge>
                                </div>
                                <p className="mt-2 text-sm text-slate-700">Level: {level} · Tiến độ: {progress}</p>
                              </Link>
                            )
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lich-hoc" className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg">Học viên chính thức / học thử</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Học viên</TableHead>
                          <TableHead>Môn học</TableHead>
                          <TableHead>Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeLearningStudents.map((student) => (
                          <TableRow
                            key={student.id}
                            className={`cursor-pointer ${selectedStudentId === student.id ? 'bg-kumon-500/10' : ''}`}
                            onClick={() => {
                              setSelectedStudentId(student.id);
                              setSelectedDate(undefined);
                            }}
                          >
                            <TableCell className="font-medium">{student.fullName}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {student.subjects?.length ? student.subjects.map((subject) => (
                                  <Badge
                                    key={`${student.id}-${subject}`}
                                    className={subject === 'EFL' ? 'bg-[#f08900]/15 text-[#f08900] ring-1 ring-inset ring-[#f08900]/35' : 'bg-[#2e8db7]/15 text-[#2e8db7] ring-1 ring-inset ring-[#2e8db7]/35'}
                                  >
                                    {subject === 'MATH' ? 'Toán' : 'Tiếng Anh'}
                                  </Badge>
                                )) : <span className="text-xs text-muted-foreground">Chưa có môn</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={student.status === 'Chính thức' ? 'success' : 'warning'}>{student.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg">Lịch học cá nhân</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
                        <p className="font-semibold text-slate-950">{selectedStudent?.fullName ?? 'Chưa chọn học viên'}</p>
                        <p className="text-sm text-muted-foreground">Số buổi hiện diện {selectedMonthLabel}: {monthlyPresentAttendances.length}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#2e8db7]/10 px-2 py-1 font-medium text-[#2e8db7]">Toán: {monthlyMathCount}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f08900]/10 px-2 py-1 font-medium text-[#f08900]">Tiếng Anh: {monthlyEflCount}</span>
                        </div>
                      </div>

                      <Calendar
                        mode="single"
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        classNames={{
                          caption_label: 'text-lg font-semibold tracking-wide text-slate-900',
                          nav_button: 'h-9 w-9 rounded-lg border border-slate-200 bg-white p-0 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900',
                          head_cell: 'w-11 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500',
                          day: 'h-11 w-11 rounded-xl text-sm transition-colors hover:bg-slate-100 hover:text-slate-900',
                          day_today: 'ring-1 ring-inset ring-kumon-500/40 bg-kumon-500/10 text-kumon-700',
                        }}
                        month={selectedCalendarMonth}
                        onMonthChange={setSelectedCalendarMonth}
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        modifiers={{
                          mathPresent: scheduleCalendarMarkers.mathOnly,
                          eflPresent: scheduleCalendarMarkers.eflOnly,
                          mixedPresent: scheduleCalendarMarkers.mixed,
                        }}
                        modifiersClassNames={{
                          mathPresent: 'bg-[#2e8db7]/20 text-[#2e8db7] font-semibold',
                          eflPresent: 'bg-[#f08900]/20 text-[#f08900] font-semibold',
                          mixedPresent: 'bg-[linear-gradient(90deg,_#2e8db7_50%,_#f08900_50%)] text-white font-semibold',
                        }}
                      />

                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#2e8db7]/30" /> Toán</div>
                        <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#f08900]/30" /> Tiếng Anh</div>
                      </div>

                      {selectedDate ? (
                        <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-slate-600">
                          <p className="font-medium text-slate-800">{formatDate(selectedDate)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedDateAttendances.length > 0
                              ? `${selectedDateAttendances.length} lần hiện diện (${selectedDateAttendances.map((item) => item.subjectCode === 'MATH' ? 'Toán' : 'Tiếng Anh').join(', ')}).`
                              : 'Không có điểm danh hiện diện.'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
                {currentKhoSubTab === 'nhap-kho' ? (
                  <>
                    <Card className="border bg-white xl:max-w-3xl">
                      <CardHeader>
                        <CardTitle className="text-lg">{editingBatchId ? 'Cập nhật nhập worksheet' : 'Nhập worksheet'}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Môn học</Label>
                          <Select
                            value={inventorySubject}
                            onValueChange={(value) => {
                              const nextSubject = value as InventorySubject;
                              setInventorySubject(nextSubject);
                              if (nextSubject === 'WRITING') {
                                setInventoryWorksheetLevel('ZI');
                                setInventoryWorksheetNumber('21');
                              } else {
                                setInventoryWorksheetLevel('A');
                                setInventoryWorksheetNumber('1');
                              }
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MATH">Toán</SelectItem>
                              <SelectItem value="EFL">Tiếng Anh</SelectItem>
                              <SelectItem value="WRITING">Kỹ năng viết</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Mã worksheet</Label>
                          <div className="grid gap-2 md:grid-cols-2">
                            <Select value={inventoryWorksheetLevel} onValueChange={(value) => {
                              setInventoryWorksheetLevel(value);
                              const firstNumber = getWorksheetNumberOptions(value)[0];
                              setInventoryWorksheetNumber(String(firstNumber));
                            }}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(inventorySubject === 'WRITING' ? ['ZI', 'ZII'] : levelBySubject[inventorySubject]).map((level) => (
                                  <SelectItem key={level} value={level}>{level}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={inventoryWorksheetNumber} onValueChange={setInventoryWorksheetNumber}>
                              <SelectTrigger disabled={isFixedWorksheetCodeLevel(inventoryWorksheetLevel)}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {getWorksheetNumberOptions(inventoryWorksheetLevel).map((value) => (
                                  <SelectItem key={value} value={String(value)}>{value === 0 ? 'Mã level' : value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Số lượng</Label>
                            <Input type="number" value={batchForm.quantity} onChange={(event) => setBatchForm((current) => ({ ...current, quantity: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Ngày nhập</Label>
                            <Input type="date" value={batchForm.receivedAt} onChange={(event) => setBatchForm((current) => ({ ...current, receivedAt: event.target.value }))} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Ghi chú</Label>
                          <Input value={batchForm.note} onChange={(event) => setBatchForm((current) => ({ ...current, note: event.target.value }))} />
                        </div>

                        <div className="flex gap-2">
                          <Button type="button" className="flex-1" onClick={() => void submitBatch()}><Save className="mr-2 h-4 w-4" />{editingBatchId ? 'Cập nhật' : 'Lưu nhập kho'}</Button>
                          {editingBatchId ? <Button type="button" variant="outline" onClick={() => { setEditingBatchId(null); setBatchForm(emptyBatchForm); }}>Hủy</Button> : null}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border bg-white">
                      <CardHeader><CardTitle className="text-lg">Các worksheet mới nhập trong tháng</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Batch</TableHead>
                              <TableHead>Môn</TableHead>
                              <TableHead>Worksheet code</TableHead>
                              <TableHead>Số lượng</TableHead>
                              <TableHead>Ngày nhập</TableHead>
                              <TableHead className="text-right">Thao tác</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {newlyImportedInMonth.map((batch) => (
                              <TableRow key={batch.id}>
                                <TableCell className="font-medium">#{batch.id}</TableCell>
                                <TableCell>{getInventorySubjectLabel(getInventorySubjectFromBatch(batch))}</TableCell>
                                <TableCell>{batch.codeRange}</TableCell>
                                <TableCell>{batch.quantity}</TableCell>
                                <TableCell>{formatDate(batch.receivedAt)}</TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={() => startBatchEdit(batch)}><PencilLine className="h-4 w-4" /></Button>
                                    <Button type="button" size="sm" variant="destructive" onClick={() => void deleteBatch(batch.id)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {newlyImportedInMonth.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Chưa có worksheet mới nhập trong tháng này.</TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="border bg-white">
                    <CardHeader><CardTitle className="text-lg">Tồn kho worksheet theo tháng</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Môn học</Label>
                          <Select value={stockSubject} onValueChange={(value) => setStockSubject(value as InventorySubject)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MATH">Toán</SelectItem>
                              <SelectItem value="EFL">Tiếng Anh</SelectItem>
                              <SelectItem value="WRITING">Kỹ năng viết</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Trình độ</Label>
                          <Select value={stockLevel} onValueChange={setStockLevel}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stockLevelOptions.map((level) => (
                                <SelectItem key={level} value={level}>{level}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tháng</Label>
                          <Select value={stockMonthFilter} onValueChange={setStockMonthFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }).map((_, idx) => (
                                <SelectItem key={`stock-month-${idx + 1}`} value={String(idx + 1)}>Tháng {idx + 1}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Năm</Label>
                          <Select value={stockYearFilter} onValueChange={setStockYearFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stockYearOptions.map((year) => (
                                <SelectItem key={`stock-year-${year}`} value={String(year)}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Tồn đầu tháng được tự động kế thừa từ tồn cuối của tháng trước.
                      </p>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Worksheet</TableHead>
                            <TableHead>Tồn đầu</TableHead>
                            <TableHead>Nhập kho</TableHead>
                            <TableHead>Sử dụng</TableHead>
                            <TableHead>Phát sinh</TableHead>
                            <TableHead>Tồn cuối</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockRows.map((row) => (
                            <TableRow
                              key={`${stockSubject}-${stockLevel}-${row.worksheetCode}`}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => openStockDetail(row)}
                            >
                              <TableCell className="font-medium">{row.worksheetCode}</TableCell>
                              <TableCell>{row.opening}</TableCell>
                              <TableCell>{row.imported}</TableCell>
                              <TableCell>{row.used}</TableCell>
                              <TableCell>{row.generated}</TableCell>
                              <TableCell className={row.closing < 0 ? 'text-red-600 font-semibold' : ''}>{row.closing}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
          </div>
        )}
      </div>

      <Dialog open={stockDetailOpen} onOpenChange={setStockDetailOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết worksheet {selectedStockRow?.worksheetCode ?? ''}</DialogTitle>
            <DialogDescription>
              Môn {getInventorySubjectLabel(stockSubject)} - Level {stockLevel}. Có thể chỉnh sửa tồn kho, cho mượn và nhận hoàn trả.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">Chỉnh sửa tồn kho</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tồn đầu</Label>
                  <Input type="number" value={stockEditForm.opening} onChange={(event) => setStockEditForm((current) => ({ ...current, opening: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Sử dụng</Label>
                  <Input type="number" value={stockEditForm.used} onChange={(event) => setStockEditForm((current) => ({ ...current, used: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Phát sinh</Label>
                  <Input type="number" value={stockEditForm.generated} onChange={(event) => setStockEditForm((current) => ({ ...current, generated: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Tồn cuối</Label>
                  <Input type="number" value={stockEditForm.closing} onChange={(event) => setStockEditForm((current) => ({ ...current, closing: event.target.value }))} />
                </div>
              </div>
              <Button type="button" className="mt-3" onClick={() => void submitStockEdit()} disabled={savingStockAction}>
                <Save className="mr-2 h-4 w-4" />
                Lưu chỉnh sửa
              </Button>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">Cho mượn worksheet</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Môn học</Label>
                  <Input value={stockSubject === 'WRITING' ? 'MATH' : stockSubject} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Loại worksheet</Label>
                  <Input value={selectedStockRow?.worksheetCode ?? ''} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Số lượng cho mượn</Label>
                  <Input type="number" min={1} value={loanForm.quantity} onChange={(event) => setLoanForm((current) => ({ ...current, quantity: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Trung tâm mượn</Label>
                  <Input value={loanForm.borrowCenter} onChange={(event) => setLoanForm((current) => ({ ...current, borrowCenter: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Hạn nhắc trả</Label>
                  <Input type="date" value={loanForm.dueDate} onChange={(event) => setLoanForm((current) => ({ ...current, dueDate: event.target.value }))} />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label>Ghi chú</Label>
                <Input value={loanForm.note} onChange={(event) => setLoanForm((current) => ({ ...current, note: event.target.value }))} placeholder="Ghi chú cho lượt cho mượn" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Hệ thống sẽ tạo thông báo nhắc đòi trả khi đến hạn sau 7 ngày nếu chưa nhận hoàn trả.</p>
              <Button type="button" className="mt-3" onClick={() => void submitWorksheetLoan()} disabled={savingStockAction}>
                <Save className="mr-2 h-4 w-4" />
                Lưu phiếu cho mượn
              </Button>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">Danh sách đang cho mượn</p>
              <div className="space-y-2">
                {activeLoanRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Không có lượt mượn đang mở.</p>
                ) : activeLoanRecords.map((loan) => (
                  <div key={loan.usageId} className="rounded-lg border bg-slate-50 p-3 text-sm">
                    <p>Số lượng: {loan.quantity}</p>
                    <p>Đơn vị mượn: {loan.borrowCenter}</p>
                    <p>Hạn trả: {loan.dueDate}</p>
                    <p>Ghi chú: {loan.note || '-'}</p>
                    <Button type="button" size="sm" className="mt-2" onClick={() => void markLoanReturned(loan)} disabled={savingStockAction}>Đã nhận hoàn trả</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDetailOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AcademicWarehousePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Dang tai...</div>}>
      <AcademicWarehousePageContent />
    </Suspense>
  );
}
