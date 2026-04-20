"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ArrowLeftFromLine, ChevronLeft, ChevronRight, PlusCircle, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';
import { getSubjectLabel } from '@/lib/kumon';
import type { SubjectCode } from '@/types';

type AcademicStudent = {
  id: number;
  fullName: string;
  status: string;
  enrollmentLevels?: Array<{ id: number; subjectCode: SubjectCode; currentLevel: string | null }>;
  currentLevels?: Partial<Record<SubjectCode, string>>;
  admissionDate: string;
  birthDate: string | null;
  parentPhone: string;
  parentName: string | null;
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

type AcademicPayload = {
  students: AcademicStudent[];
  assessments: AcademicAssessment[];
  worksheetBatches: AcademicWorksheetBatch[];
  worksheetUsages: AcademicWorksheetUsage[];
};

type AssignmentRow = {
  id: number;
  studentId: number;
  date: string;
  worksheet: string;
  subjectCode: SubjectCode;
  isWriting: boolean;
  note: string;
};

type MainWorksheetEntry = {
  id: string;
  level: string;
  number: string;
};

const WORKSHEET_ASSIGNMENT_NOTE_PREFIX = '[WS_ASSIGN]';
const WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX = '[WS_ASSIGN_WRITING]';
const WORKSHEET_ASSIGNMENT_BATCH_NOTE_PREFIX = '[WS_ASSIGNMENT_BATCH]';
const WORKSHEET_DAILY_NOTE_PREFIX = '[WS_DAILY_NOTE]';
const WORKSHEET_ASSIGN_NOTE_DELIMITER = '::NOTE::';
const DEFAULT_ASSIGNMENT_NOTE = 'Học viên luyện tốc độ và độ chính xác theo lộ trình tuần này, tập trung phần còn yếu, hoàn thành trước buổi tới và ghi lại khó khăn để giáo viên điều chỉnh bài phù hợp hơn.';

const levelBySubject: Record<SubjectCode, string[]> = {
  MATH: ['6A', '5A', '4A', '3A', '2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'AT-4A', 'AT-3A', 'AT-2A', 'AT-A', 'AT-B', 'AT-C', 'AT-D', 'AT-E', 'AT-F', 'AT-G', 'AT-H', 'AT-I', 'AT-J', 'AT-K', 'AT-L', 'AT-M', 'AT-N', 'DT-K1', 'DT-K2', 'DT-P1', 'DT-P2', 'DT-P3', 'DT-P4', 'DT-P5', 'DT-P6', 'DT-M1', 'DT-M2', 'DT-M3', 'DT-H'],
  EFL: ['7A', '6A', '5A', '4A', '3A', '2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'AT-7A', 'AT-6A', 'AT-5A', 'AT-4A', 'AT-3A', 'AT-2A', 'AT-A', 'AT-B', 'AT-C', 'AT-D', 'AT-E', 'AT-F', 'AT-G', 'AT-H', 'AT-I', 'AT-J', 'AT-K', 'AT-L', 'AT-M', 'AT-N', 'DT-K', 'DT-P1', 'DT-P2', 'DT-M', 'DT-H'],
};

function getWorksheetAssignableLevels(subjectCode: SubjectCode) {
  return levelBySubject[subjectCode].filter((level) => !isDtLevel(level));
}

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

function toDateInputValue(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthDateRange(monthValue: Date) {
  const year = monthValue.getFullYear();
  const month = monthValue.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return dates;
}

function formatMonthLabel(monthValue: Date) {
  return monthValue.toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });
}

function isWorksheetCodeValid(level: string, numberText: string) {
  const normalizedLevel = level.trim().toUpperCase();
  if (isFixedWorksheetCodeLevel(normalizedLevel)) {
    return true;
  }

  return normalizedLevel.length > 0 && /^\d+$/.test(numberText) && Number(numberText) > 0;
}

function composeWorksheetCode(level: string, numberText: string) {
  const normalizedLevel = level.trim().toUpperCase();
  if (isFixedWorksheetCodeLevel(normalizedLevel)) {
    return normalizedLevel;
  }

  return `${normalizedLevel}${String(Number(numberText))}`;
}

function isWritingNumberAllowed(level: string, numberText: string) {
  const number = Number(numberText);
  if (!Number.isInteger(number) || number <= 0) {
    return false;
  }

  if (level === 'ZI') {
    return number >= 21 && number <= 91 && (number - 21) % 10 === 0;
  }

  if (level === 'ZII') {
    return number >= 11 && number <= 91 && (number - 11) % 10 === 0;
  }

  return false;
}

function extractWorksheetCodeFromNote(note: string | null) {
  if (!note) {
    return '';
  }

  if (note.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX)) {
    return note
      .slice(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX.length)
      .split(WORKSHEET_ASSIGN_NOTE_DELIMITER)[0]
      .trim()
      .toUpperCase();
  }

  if (note.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)) {
    return note
      .slice(WORKSHEET_ASSIGNMENT_NOTE_PREFIX.length)
      .split(WORKSHEET_ASSIGN_NOTE_DELIMITER)[0]
      .trim()
      .toUpperCase();
  }

  return '';
}

function extractAssignmentNoteFromUsage(note: string | null) {
  if (!note) {
    return '';
  }

  if (note.startsWith(WORKSHEET_DAILY_NOTE_PREFIX)) {
    return note.slice(WORKSHEET_DAILY_NOTE_PREFIX.length).trim();
  }

  let payload = '';
  if (note.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX)) {
    payload = note.slice(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX.length);
  } else if (note.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)) {
    payload = note.slice(WORKSHEET_ASSIGNMENT_NOTE_PREFIX.length);
  }

  if (!payload) {
    return '';
  }

  const [, maybeNote] = payload.split(WORKSHEET_ASSIGN_NOTE_DELIMITER);
  return maybeNote?.trim() ?? '';
}

function composeAssignmentUsageNote(prefix: string, worksheetCode: string, assignmentNote: string) {
  const trimmedNote = assignmentNote.trim();
  if (!trimmedNote) {
    return `${prefix}${worksheetCode}`;
  }

  return `${prefix}${worksheetCode}${WORKSHEET_ASSIGN_NOTE_DELIMITER}${trimmedNote}`;
}

function isWorksheetAssignmentUsage(usage: AcademicWorksheetUsage) {
  return usage.note?.startsWith(WORKSHEET_ASSIGNMENT_NOTE_PREFIX)
    || usage.note?.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX)
    || usage.note?.startsWith(WORKSHEET_DAILY_NOTE_PREFIX)
    || false;
}

function isWritingUsage(usage: AcademicWorksheetUsage) {
  return usage.note?.startsWith(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX) || false;
}

function splitWorksheetCode(value: string) {
  if (/^(AT|DT)-[A-Z0-9]+$/i.test(value)) {
    return {
      level: value.toUpperCase(),
      number: '1',
    };
  }

  const match = /^([A-Z]+)(\d+)$/.exec(value);
  if (!match) {
    return null;
  }

  return {
    level: match[1],
    number: match[2],
  };
}

function compareWorksheetRows(left: AssignmentRow, right: AssignmentRow) {
  if (left.isWriting !== right.isWriting) {
    return Number(left.isWriting) - Number(right.isWriting);
  }

  const leftCode = splitWorksheetCode(left.worksheet);
  const rightCode = splitWorksheetCode(right.worksheet);

  if (!leftCode && !rightCode) {
    return left.worksheet.localeCompare(right.worksheet);
  }

  if (!leftCode) {
    return 1;
  }

  if (!rightCode) {
    return -1;
  }

  const levelCompare = leftCode.level.localeCompare(rightCode.level);
  if (levelCompare !== 0) {
    return levelCompare;
  }

  return Number(leftCode.number) - Number(rightCode.number);
}

function createEmptyAssessmentForm(subjectCode: SubjectCode) {
  return {
    subjectCode,
    testType: 'AT' as 'AT' | 'DT',
    level: normalizeAssessmentLevel(subjectCode, 'AT', ''),
    correctAnswers: '0',
    totalQuestions: '100',
    actualMinutes: '0',
    standardMinutes: '30',
    groupNo: '1',
    testDate: new Date().toISOString().slice(0, 10),
  };
}

function createMainWorksheetEntry(level = 'A', number = '1'): MainWorksheetEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    number,
  };
}

export default function StudentWorksheetLogPage() {
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const studentId = Number(params.studentId);
  const subjectFromQuery = searchParams.get('subject');
  const initialSubject: SubjectCode = subjectFromQuery === 'EFL' ? 'EFL' : 'MATH';

  const [data, setData] = useState<AcademicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectCode, setSubjectCode] = useState<SubjectCode>(initialSubject);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [includeMainWorksheet, setIncludeMainWorksheet] = useState(false);
  const [mainWorksheetEntries, setMainWorksheetEntries] = useState<MainWorksheetEntry[]>([createMainWorksheetEntry()]);
  const [includeWriting, setIncludeWriting] = useState(false);
  const [writingLevel, setWritingLevel] = useState('ZI');
  const [writingNumber, setWritingNumber] = useState('21');
  const [saving, setSaving] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [assignmentNote, setAssignmentNote] = useState(DEFAULT_ASSIGNMENT_NOTE);
  const [currentLevelInput, setCurrentLevelInput] = useState('');
  const [savingCurrentLevel, setSavingCurrentLevel] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [assessmentFormOpen, setAssessmentFormOpen] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');
  const [assessmentForm, setAssessmentForm] = useState(() => createEmptyAssessmentForm(initialSubject));

  const student = useMemo(() => (data?.students ?? []).find((item) => item.id === studentId) ?? null, [data, studentId]);
  const selectedEnrollmentLevel = useMemo(
    () => student?.enrollmentLevels?.find((item) => item.subjectCode === subjectCode) ?? null,
    [student, subjectCode]
  );
  const isDtTrackSelected = useMemo(() => isDtLevel(currentLevelInput), [currentLevelInput]);

  useEffect(() => {
    const fallbackLevel = levelBySubject[subjectCode][0];
    setCurrentLevelInput(selectedEnrollmentLevel?.currentLevel ?? fallbackLevel);
  }, [selectedEnrollmentLevel?.currentLevel, subjectCode]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/hoc-thuat', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu worksheet');
        }

        const payload = (await response.json()) as AcademicPayload;
        setData(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Có lỗi xảy ra');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const assignmentBatchMap = useMemo(() => {
    const entries = (data?.worksheetBatches ?? [])
      .filter((batch) => batch.note?.startsWith(WORKSHEET_ASSIGNMENT_BATCH_NOTE_PREFIX))
      .map((batch) => [batch.id, batch] as const);

    return new Map<number, AcademicWorksheetBatch>(entries);
  }, [data]);

  const allRows = useMemo(() => {
    return (data?.worksheetUsages ?? [])
      .filter((usage) => usage.studentId === studentId && isWorksheetAssignmentUsage(usage))
      .map((usage) => {
        const batch = assignmentBatchMap.get(usage.batchId);
        const worksheet = extractWorksheetCodeFromNote(usage.note);
        if (!batch || !usage.studentId) {
          return null;
        }

        return {
          id: usage.id,
          studentId: usage.studentId,
          date: toDateInputValue(usage.usedAt),
          worksheet,
          subjectCode: batch.subjectCode,
          isWriting: isWritingUsage(usage),
          note: extractAssignmentNoteFromUsage(usage.note),
        } satisfies AssignmentRow;
      })
      .filter((item): item is AssignmentRow => Boolean(item));
  }, [assignmentBatchMap, data, studentId]);

  const subjectRows = useMemo(() => allRows.filter((row) => row.subjectCode === subjectCode), [allRows, subjectCode]);
  const allAssessments = useMemo(() => {
    return (data?.assessments ?? [])
      .filter((item) => item.studentId === studentId && item.subjectCode === subjectCode)
      .slice()
      .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
  }, [data?.assessments, studentId, subjectCode]);
  const monthDays = useMemo(() => getMonthDateRange(month), [month]);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  const rowsByDate = useMemo(() => {
    const grouped = new Map<string, AssignmentRow[]>();
    subjectRows
      .filter((row) => row.date.startsWith(monthKey))
      .forEach((row) => {
        const current = grouped.get(row.date) ?? [];
        current.push(row);
        grouped.set(row.date, current);
      });

    return grouped;
  }, [monthKey, subjectRows]);

  const selectedDateRows = useMemo(() => {
    if (!selectedDate) {
      return [] as AssignmentRow[];
    }

    return rowsByDate.get(selectedDate) ?? [];
  }, [rowsByDate, selectedDate]);

  const assignmentNoteWordCount = useMemo(() => {
    if (!assignmentNote.trim()) {
      return 0;
    }

    return assignmentNote.trim().split(/\s+/).length;
  }, [assignmentNote]);

  const selectedMainWorksheets = useMemo(() => {
    if (!selectedDate || !includeMainWorksheet) {
      return [] as string[];
    }

    return mainWorksheetEntries
      .filter((entry) => isWorksheetCodeValid(entry.level, entry.number))
      .map((entry) => composeWorksheetCode(entry.level, entry.number));
  }, [includeMainWorksheet, mainWorksheetEntries, selectedDate]);

  const selectedWritingWorksheet = useMemo(() => {
    if (!selectedDate || !includeWriting) {
      return '';
    }

    return isWorksheetCodeValid(writingLevel, writingNumber) ? composeWorksheetCode(writingLevel, writingNumber) : '';
  }, [includeWriting, selectedDate, writingLevel, writingNumber]);

  const mainPastCount = useMemo(() => {
    if (!selectedDate || selectedMainWorksheets.length === 0) {
      return 0;
    }

    const selectedSet = new Set(selectedMainWorksheets);
    return subjectRows.filter((row) => !row.isWriting && selectedSet.has(row.worksheet) && row.date < selectedDate).length;
  }, [selectedDate, selectedMainWorksheets, subjectRows]);

  const mainWorksheetPastStats = useMemo(() => {
    if (!selectedDate || selectedMainWorksheets.length === 0) {
      return [] as Array<{ worksheet: string; count: number }>;
    }

    return selectedMainWorksheets.map((worksheet) => ({
      worksheet,
      count: subjectRows.filter((row) => !row.isWriting && row.worksheet === worksheet && row.date < selectedDate).length,
    }));
  }, [selectedDate, selectedMainWorksheets, subjectRows]);

  const writingPastCount = useMemo(() => {
    if (!selectedDate || !selectedWritingWorksheet) {
      return 0;
    }

    return subjectRows.filter((row) => row.isWriting && row.worksheet === selectedWritingWorksheet && row.date < selectedDate).length;
  }, [selectedDate, selectedWritingWorksheet, subjectRows]);

  async function refreshData() {
    const response = await fetch('/api/hoc-thuat', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Không thể tải dữ liệu worksheet');
    }

    const payload = (await response.json()) as AcademicPayload;
    setData(payload);
  }

  async function ensureAssignmentBatch(trackSubjectCode: SubjectCode) {
    const existing = (data?.worksheetBatches ?? []).find((batch) => (
      batch.subjectCode === trackSubjectCode
      && batch.note?.startsWith(WORKSHEET_ASSIGNMENT_BATCH_NOTE_PREFIX)
    ));

    if (existing) {
      return existing.id;
    }

    const response = await fetch('/api/hoc-thuat/worksheet-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectCode: trackSubjectCode,
        level: 'ASSIGNMENT',
        codeRange: `TRACK-${trackSubjectCode}`,
        quantity: 0,
        receivedAt: new Date().toISOString().slice(0, 10),
        note: `${WORKSHEET_ASSIGNMENT_BATCH_NOTE_PREFIX} tracking`,
      }),
    });

    if (!response.ok) {
      throw new Error('Không thể tạo assignment batch');
    }

    const created = (await response.json()) as AcademicWorksheetBatch;
    return created.id;
  }

  async function saveWorksheetForDay() {
    if (!selectedDate) {
      return;
    }

    if (isDtTrackSelected) {
      setPanelError('Level DT chỉ dùng cho nhập kho/tồn kho và bài thi, không soạn worksheet.');
      return;
    }

    if (includeMainWorksheet) {
      if (mainWorksheetEntries.length === 0) {
        setPanelError('Vui lòng thêm ít nhất 1 worksheet chính.');
        return;
      }

      const hasInvalidMainWorksheet = mainWorksheetEntries.some((entry) => isDtLevel(entry.level) || !isWorksheetCodeValid(entry.level, entry.number));
      if (hasInvalidMainWorksheet) {
        setPanelError('Có worksheet chính chưa hợp lệ.');
        return;
      }
    }

    if (includeWriting && !isWorksheetCodeValid(writingLevel, writingNumber)) {
      setPanelError('Worksheet kỹ năng viết chưa hợp lệ.');
      return;
    }

    if (includeWriting && !isWritingNumberAllowed(writingLevel, writingNumber)) {
      setPanelError('Mã kỹ năng viết phải theo quy tắc: ZI21..ZI91 hoặc ZII11..ZII91 (bước 10).');
      return;
    }

    const mainCodes = includeMainWorksheet
      ? mainWorksheetEntries.map((entry) => composeWorksheetCode(entry.level, entry.number))
      : [];

    if (includeMainWorksheet && new Set(mainCodes).size !== mainCodes.length) {
      setPanelError('Có worksheet chính bị trùng trong cùng ngày. Vui lòng kiểm tra lại.');
      return;
    }

    const writingCode = includeWriting ? composeWorksheetCode(writingLevel, writingNumber) : '';

    setPanelError('');
    setSaving(true);

    try {
      const batchId = await ensureAssignmentBatch(subjectCode);
      const todayRows = (rowsByDate.get(selectedDate) ?? []);

      const deleteResponses = await Promise.all(
        todayRows.map((row) => fetch(`/api/hoc-thuat/worksheet-usages/${row.id}`, { method: 'DELETE' }))
      );

      if (deleteResponses.some((response) => !response.ok)) {
        throw new Error('Không thể cập nhật worksheet trong ngày');
      }

      const payloads: Array<{
        batchId: number;
        studentId: number;
        quantity: number;
        usedAt: string;
        preparedBy: null;
        note: string;
      }> = [];

      if (includeMainWorksheet) {
        mainCodes.forEach((mainCode) => {
          payloads.push({
            batchId,
            studentId,
            quantity: 1,
            usedAt: selectedDate,
            preparedBy: null,
            note: composeAssignmentUsageNote(WORKSHEET_ASSIGNMENT_NOTE_PREFIX, mainCode, assignmentNote),
          });
        });
      }

      if (includeWriting) {
        payloads.push({
          batchId,
          studentId,
          quantity: 1,
          usedAt: selectedDate,
          preparedBy: null,
          note: composeAssignmentUsageNote(WORKSHEET_WRITING_ASSIGNMENT_NOTE_PREFIX, writingCode, assignmentNote),
        });
      }

      if (payloads.length === 0 && assignmentNote.trim()) {
        payloads.push({
          batchId,
          studentId,
          quantity: 1,
          usedAt: selectedDate,
          preparedBy: null,
          note: `${WORKSHEET_DAILY_NOTE_PREFIX}${assignmentNote.trim()}`,
        });
      }

      if (payloads.length === 0) {
        await refreshData();
        setIsPanelOpen(false);
        return;
      }

      const createResponses = await Promise.all(payloads.map((payload) => fetch('/api/hoc-thuat/worksheet-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })));

      if (createResponses.some((response) => !response.ok)) {
        throw new Error('Không thể lưu worksheet assignment');
      }

      await refreshData();
      setIsPanelOpen(false);
    } catch (saveError) {
      setPanelError(saveError instanceof Error ? saveError.message : 'Không thể lưu worksheet.');
    } finally {
      setSaving(false);
    }
  }

  function openDayPanel(dateValue: string) {
    if (isDtTrackSelected) {
      setError('Level DT chỉ dùng cho nhập kho/tồn kho và bài thi, không soạn worksheet.');
      return;
    }

    const dayRows = rowsByDate.get(dateValue) ?? [];
    const mainRows = dayRows.filter((item) => !item.isWriting && item.worksheet);
    const mainRow = mainRows[0];
    const writingRow = dayRows.find((item) => item.isWriting);

    const mainParts = splitWorksheetCode(mainRow?.worksheet ?? '');
    const writingParts = splitWorksheetCode(writingRow?.worksheet ?? '');
    const assignableLevels = getWorksheetAssignableLevels(subjectCode);
    const fallbackAssignableLevel = assignableLevels[0] ?? levelBySubject[subjectCode][0];
    const preferredLevel = mainParts?.level ?? currentLevelInput ?? fallbackAssignableLevel;
    const resolvedMainLevel = isDtLevel(preferredLevel) ? fallbackAssignableLevel : preferredLevel;

    setSelectedDate(dateValue);
    const parsedMainEntries = mainRows
      .map((item) => splitWorksheetCode(item.worksheet))
      .filter((item): item is { level: string; number: string } => Boolean(item))
      .map((item) => createMainWorksheetEntry(item.level, item.number));

    if (parsedMainEntries.length > 0) {
      setIncludeMainWorksheet(true);
      setMainWorksheetEntries(parsedMainEntries);
    } else {
      setIncludeMainWorksheet(Boolean(mainRow?.worksheet));
      setMainWorksheetEntries([createMainWorksheetEntry(resolvedMainLevel, mainParts?.number ?? '1')]);
    }
    setIncludeWriting(Boolean(mainRow?.worksheet) && Boolean(writingRow?.worksheet));
    setWritingLevel(writingParts?.level ?? 'ZI');
    setWritingNumber(writingParts?.number ?? '21');
    setAssignmentNote(mainRow?.note || writingRow?.note || DEFAULT_ASSIGNMENT_NOTE);
    setPanelError('');
    setIsPanelOpen(true);
  }

  async function saveCurrentLevel() {
    if (!selectedEnrollmentLevel?.id) {
      setError('Học viên chưa đăng ký môn học này nên chưa thể lưu trình độ.');
      return;
    }

    setSavingCurrentLevel(true);
    try {
      const response = await fetch(`/api/enrollments/${selectedEnrollmentLevel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLevel: currentLevelInput }),
      });

      if (!response.ok) {
        throw new Error('Không thể lưu trình độ hiện tại');
      }

      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu trình độ hiện tại');
    } finally {
      setSavingCurrentLevel(false);
    }
  }

  async function submitAssessment() {
    setSavingAssessment(true);
    setAssessmentError('');
    try {
      const payload = {
        studentId,
        subjectCode: assessmentForm.subjectCode,
        level: assessmentForm.level,
        correctAnswers: Number(assessmentForm.correctAnswers),
        totalQuestions: Number(assessmentForm.totalQuestions),
        actualMinutes: Number(assessmentForm.actualMinutes),
        standardMinutes: Number(assessmentForm.standardMinutes),
        groupNo: Number(assessmentForm.groupNo),
        testDate: assessmentForm.testDate,
      };

      const response = await fetch('/api/hoc-thuat/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Không thể thêm bài thi');
      }

      await refreshData();
      setAssessmentForm(createEmptyAssessmentForm(subjectCode));
      setAssessmentFormOpen(false);
    } catch (saveError) {
      setAssessmentError(saveError instanceof Error ? saveError.message : 'Không thể thêm bài thi');
    } finally {
      setSavingAssessment(false);
    }
  }

  function goPreviousMonth() {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
    setIsPanelOpen(false);
    setSelectedDate('');
  }

  function goNextMonth() {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
    setIsPanelOpen(false);
    setSelectedDate('');
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Đang tải nhật ký worksheet...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Link href="/hoc-thuat?tab=hoc-thuat&subtab=soan-bai" className="text-base text-kumon-600 hover:underline">
          <ArrowLeftFromLine className="mr-1 inline h-6 w-6" />
          Quay lại
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Không tìm thấy học viên.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/hoc-thuat?tab=hoc-thuat&subtab=soan-bai" className="text-base text-kumon-600 hover:underline">
            <ArrowLeftFromLine className="mr-1 inline h-6 w-6" />
            Quay lại
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Nhật ký worksheet - {student.fullName}</h1>
          <p className="text-sm text-muted-foreground">Chọn từng dòng để mở cửa sổ và gán worksheet.</p>
        </div>
        <div className="w-full max-w-[440px] rounded-2xl border bg-white p-3">
          <div className="grid gap-3 md:grid-cols-[150px_1fr_auto]">
            <div className="space-y-1">
              <Label>Môn học</Label>
              <Select value={subjectCode} onValueChange={(value) => setSubjectCode(value as SubjectCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MATH">Toán</SelectItem>
                  <SelectItem value="EFL">Tiếng Anh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Trình độ hiện tại</Label>
              <Select value={currentLevelInput} onValueChange={setCurrentLevelInput}>
                <SelectTrigger><SelectValue placeholder="Chọn level" /></SelectTrigger>
                <SelectContent>
                  {levelBySubject[subjectCode].map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="self-end">
              <Button type="button" onClick={() => void saveCurrentLevel()} disabled={savingCurrentLevel}>
                {savingCurrentLevel ? 'Đang lưu...' : 'Lưu trình độ'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="border bg-white">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{getSubjectLabel(subjectCode)} - {formatMonthLabel(month)}</CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={goPreviousMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="outline" onClick={goNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isDtTrackSelected ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Level DT chỉ hỗ trợ Nhập kho/Tồn kho và Thêm bài thi. Không áp dụng Soạn bài theo ngày.
            </div>
          ) : null}
          <div className="max-h-[620px] overflow-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Worksheet đã gán</TableHead>
                  <TableHead className="min-w-[320px]">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthDays.map((dateValue) => {
                  const rows = rowsByDate.get(dateValue) ?? [];
                  const rowNote = rows.find((item) => item.note.trim())?.note ?? DEFAULT_ASSIGNMENT_NOTE;
                  const worksheetRows = rows
                    .filter((row) => Boolean(row.worksheet))
                    .slice()
                    .sort(compareWorksheetRows);
                  return (
                    <TableRow key={dateValue} onClick={() => !isDtTrackSelected && openDayPanel(dateValue)} className={isDtTrackSelected ? 'opacity-70' : 'cursor-pointer hover:bg-kumon-500/5'}>
                      <TableCell>{formatDate(dateValue)}</TableCell>
                      <TableCell>
                        {rows.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Chưa gán</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {worksheetRows.map((row) => (
                              <Badge
                                key={row.id}
                                variant={row.isWriting ? 'warning' : 'secondary'}
                                style={row.subjectCode === 'MATH'
                                  ? { backgroundColor: '#2e8db714', color: '#2e8db7', borderColor: '#2e8db740' }
                                  : { backgroundColor: '#f0890014', color: '#f08900', borderColor: '#f0890040' }}
                              >
                                {row.isWriting ? `Viết ${row.worksheet}` : row.worksheet}
                              </Badge>
                            ))}
                            {rows.every((row) => !row.worksheet) ? <span className="text-xs text-muted-foreground">Chỉ ghi chú</span> : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div
                          className="max-w-[520px] text-sm leading-6 text-slate-700"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                          title={rowNote}
                        >
                          {rowNote}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border bg-white">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Toàn bộ kết quả bài thi {getSubjectLabel(subjectCode)}</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => {
                setAssessmentForm(createEmptyAssessmentForm(subjectCode));
                setAssessmentFormOpen(true);
                setAssessmentError('');
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />Thêm bài thi
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[320px] overflow-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày thi</TableHead>
                  <TableHead>Môn</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Điểm</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Nhóm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAssessments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.testDate)}</TableCell>
                    <TableCell>{getSubjectLabel(item.subjectCode)}</TableCell>
                    <TableCell><Badge variant="secondary">{item.level}</Badge></TableCell>
                    <TableCell>{item.correctAnswers}/{item.totalQuestions}</TableCell>
                    <TableCell>{item.actualMinutes}/{item.standardMinutes}</TableCell>
                    <TableCell>{item.groupNo}</TableCell>
                  </TableRow>
                ))}
                {allAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Học viên chưa có kết quả bài thi.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {portalReady && assessmentFormOpen ? createPortal(
        <div className="fixed inset-0 z-[130]">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setAssessmentFormOpen(false)}
            aria-label="Đóng form thêm bài thi"
          />
          <div className="relative z-[131] flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-2xl border bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Thêm bài thi cho {student.fullName}</h2>
                <p className="text-sm text-muted-foreground">Nhập thông tin bài thi và lưu vào kết quả học viên.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setAssessmentFormOpen(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-4">
              {assessmentError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{assessmentError}</div> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Môn học</Label>
                  <Select value={assessmentForm.subjectCode} onValueChange={(value) => {
                    const subjectCode = value as SubjectCode;
                    setAssessmentForm((current) => ({
                      ...current,
                      subjectCode,
                      level: normalizeAssessmentLevel(subjectCode, current.testType, current.level),
                    }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[260]">
                      <SelectItem value="MATH">Toán</SelectItem>
                      <SelectItem value="EFL">Tiếng Anh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ngày thi</Label>
                  <Input type="date" value={assessmentForm.testDate} onChange={(event) => setAssessmentForm((current) => ({ ...current, testDate: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
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
                    <SelectContent className="z-[260]">
                      <SelectItem value="DT">Bài kiểm tra đầu vào</SelectItem>
                      <SelectItem value="AT">Bài kiểm tra kết thúc trình độ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trình độ</Label>
                  <Select value={assessmentForm.level} onValueChange={(value) => setAssessmentForm((current) => ({ ...current, level: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[260]">
                      {getAssessmentLevelOptions(assessmentForm.subjectCode, assessmentForm.testType).map((level) => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Số câu đúng</Label>
                  <Input type="number" value={assessmentForm.correctAnswers} onChange={(event) => setAssessmentForm((current) => ({ ...current, correctAnswers: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tổng số câu</Label>
                  <Input type="number" value={assessmentForm.totalQuestions} onChange={(event) => setAssessmentForm((current) => ({ ...current, totalQuestions: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Thời gian thực tế (phút)</Label>
                  <Input type="number" value={assessmentForm.actualMinutes} onChange={(event) => setAssessmentForm((current) => ({ ...current, actualMinutes: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Thời gian chuẩn (phút)</Label>
                  <Input type="number" value={assessmentForm.standardMinutes} onChange={(event) => setAssessmentForm((current) => ({ ...current, standardMinutes: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nhóm</Label>
                <Input type="number" value={assessmentForm.groupNo} onChange={(event) => setAssessmentForm((current) => ({ ...current, groupNo: event.target.value }))} />
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={() => void submitAssessment()} disabled={savingAssessment}>
                  {savingAssessment ? 'Đang lưu...' : 'Lưu bài thi'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setAssessmentFormOpen(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>,
        document.body
      ) : null}

      {portalReady ? createPortal(
        <div className={`fixed inset-0 z-[120] transition ${isPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <button
            type="button"
            className={`absolute inset-0 transition ${isPanelOpen ? 'bg-black/30' : 'bg-transparent'}`}
            onClick={() => setIsPanelOpen(false)}
            aria-label="Đóng"
          />
          <div className={`absolute inset-y-0 right-0 h-dvh w-full max-w-[460px] bg-white p-6 shadow-2xl transition-transform duration-300 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Gán worksheet theo ngày</h2>
              <p className="text-sm text-muted-foreground">{selectedDate ? formatDate(selectedDate) : ''}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setIsPanelOpen(false)}><X className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-4">
            {panelError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{panelError}</div> : null}
            <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">Ghi chú ngày học</p>
              <Textarea
                className="mt-2 min-h-[116px] bg-white"
                value={assignmentNote}
                onChange={(event) => setAssignmentNote(event.target.value)}
                placeholder={DEFAULT_ASSIGNMENT_NOTE}
              />
              <p className="mt-1 text-xs text-muted-foreground">Số từ hiện tại: {assignmentNoteWordCount}</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={includeMainWorksheet}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIncludeMainWorksheet(checked);
                    if (!checked) {
                      setIncludeWriting(false);
                    }
                    if (checked && mainWorksheetEntries.length === 0) {
                      const defaultLevel = getWorksheetAssignableLevels(subjectCode)[0] ?? levelBySubject[subjectCode][0];
                      setMainWorksheetEntries([createMainWorksheetEntry(defaultLevel, '1')]);
                    }
                  }}
                />
                Gán worksheet chính
              </label>
              {includeMainWorksheet ? (
                <div className="space-y-2">
                  {mainWorksheetEntries.map((entry, index) => (
                    <div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Select
                        value={entry.level}
                        onValueChange={(value) => setMainWorksheetEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, level: value } : item)))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[210]">
                          {getWorksheetAssignableLevels(subjectCode).map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={entry.number}
                        disabled={isFixedWorksheetCodeLevel(entry.level)}
                        onChange={(event) => setMainWorksheetEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, number: event.target.value } : item)))}
                        placeholder={isFixedWorksheetCodeLevel(entry.level) ? 'Level cố định không cần số' : 'Số worksheet'}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={mainWorksheetEntries.length === 1}
                        onClick={() => setMainWorksheetEntries((current) => current.filter((item) => item.id !== entry.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMainWorksheetEntries((current) => {
                      const fallbackLevel = getWorksheetAssignableLevels(subjectCode)[0] ?? levelBySubject[subjectCode][0];
                      const defaultLevel = current[0]?.level ?? fallbackLevel;
                      return [...current, createMainWorksheetEntry(defaultLevel, '1')];
                    })}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm worksheet
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">Worksheet đang chọn: {includeMainWorksheet ? (selectedMainWorksheets.join(', ') || '-') : 'Không gán'}</p>
              <p className="text-xs text-slate-700">
                Thống kê: {includeMainWorksheet
                  ? (selectedMainWorksheets.length >= 2
                    ? `${selectedMainWorksheets.length} worksheet chính, tổng cộng đã làm ${mainPastCount} lần trong quá khứ.`
                    : `${selectedMainWorksheets.length} worksheet chính, đã làm ${mainPastCount} lần trong quá khứ.`)
                  : 'Bạn có thể chỉ lưu ghi chú mà không gán worksheet.'}
              </p>
              {includeMainWorksheet && mainWorksheetPastStats.length >= 2 ? (
                <p className="text-xs text-muted-foreground">
                  {mainWorksheetPastStats.map((item) => `${item.worksheet}: ${item.count} lần`).join(' • ')}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={includeWriting} disabled={!includeMainWorksheet} onChange={(event) => setIncludeWriting(event.target.checked)} />
                Kỹ năng viết
              </label>

              {includeWriting ? (
                <>
                  <div className="grid grid-cols-[1fr_1fr] gap-2">
                    <Select value={writingLevel} onValueChange={setWritingLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[210]">
                        <SelectItem value="ZI">ZI</SelectItem>
                        <SelectItem value="ZII">ZII</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} value={writingNumber} onChange={(event) => setWritingNumber(event.target.value)} placeholder="Số worksheet" />
                  </div>
                  <p className="text-xs text-muted-foreground">Worksheet đang chọn: {selectedWritingWorksheet || '-'}</p>
                  <p className="text-xs text-slate-700">Thống kê: worksheet này đã làm {writingPastCount} lần trong quá khứ.</p>
                </>
              ) : null}
            </div>

            {selectedDateRows.length > 0 ? (
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-medium text-slate-900">Worksheet đã gán ngày này</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDateRows.filter((row) => Boolean(row.worksheet)).slice().sort(compareWorksheetRows).map((row) => (
                    <Badge
                      key={row.id}
                      style={row.subjectCode === 'MATH'
                        ? { backgroundColor: '#2e8db714', color: '#2e8db7', borderColor: '#2e8db740' }
                        : { backgroundColor: '#f0890014', color: '#f08900', borderColor: '#f0890040' }}
                      variant="outline"
                    >
                      {row.isWriting ? `Viết ${row.worksheet}` : row.worksheet}
                    </Badge>
                  ))}
                  {selectedDateRows.every((row) => !row.worksheet) ? <span className="text-xs text-muted-foreground">Chỉ ghi chú</span> : null}
                </div>
                {selectedDateRows.every((row) => !row.worksheet) ? (
                  <p className="mt-2 text-xs text-muted-foreground">Ngày này chỉ có ghi chú, không gán worksheet.</p>
                ) : null}
              </div>
            ) : null}

            <Button type="button" className="w-full" disabled={saving} onClick={() => void saveWorksheetForDay()}>
              {saving ? 'Đang lưu...' : 'Lưu worksheet ngày này'}
            </Button>
          </div>
        </div>
      </div>,
      document.body
      ) : null}
    </div>
  );
}
