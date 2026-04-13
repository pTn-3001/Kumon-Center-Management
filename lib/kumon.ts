import type { ClassShift, LeadStatus, SubjectCode, Weekday } from '@/types';

export const MATH_LEVELS = ['4A', '3A', '2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'] as const;
export const EFL_LEVELS = ['7A', '6A', '5A', '4A', '3A', '2A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'] as const;

export const SUBJECTS: Array<{ code: SubjectCode; label: string; color: string }> = [
  { code: 'MATH', label: 'Toán', color: 'bg-emerald-500' },
  { code: 'EFL', label: 'Tiếng Anh', color: 'bg-amber-500' },
];

export const STUDENT_STATUS = ['Chính thức', 'Thôi học', 'Học thử', 'Hết hạn'] as const;
export const LEAD_STATUSES: LeadStatus[] = ['Mới', 'Đang liên hệ', 'Đã đặt hẹn', 'Đã đăng ký', 'Có thể liên hệ lại', 'Không tiềm năng'];
export const LEAD_SOURCES = ['Facebook', 'Website', 'Điện thoại', 'Giới thiệu'] as const;

export const CLASS_SHIFT_OPTIONS: ClassShift[] = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5'];

export const SHIFT_TIME_RANGES: Record<Weekday, Record<ClassShift, string>> = {
  T2: {
    'Ca 1': '16:15 - 17:00',
    'Ca 2': '17:00 - 17:45',
    'Ca 3': '17:45 - 18:30',
    'Ca 4': '18:30 - 19:15',
    'Ca 5': '19:15 - 20:00',
  },
  T3: {
    'Ca 1': '16:15 - 17:00',
    'Ca 2': '17:00 - 17:45',
    'Ca 3': '17:45 - 18:30',
    'Ca 4': '18:30 - 19:15',
    'Ca 5': '19:15 - 20:00',
  },
  T4: {
    'Ca 1': '16:15 - 17:00',
    'Ca 2': '17:00 - 17:45',
    'Ca 3': '17:45 - 18:30',
    'Ca 4': '18:30 - 19:15',
    'Ca 5': '19:15 - 20:00',
  },
  T5: {
    'Ca 1': '16:15 - 17:00',
    'Ca 2': '17:00 - 17:45',
    'Ca 3': '17:45 - 18:30',
    'Ca 4': '18:30 - 19:15',
    'Ca 5': '19:15 - 20:00',
  },
  T6: {
    'Ca 1': '16:15 - 17:00',
    'Ca 2': '17:00 - 17:45',
    'Ca 3': '17:45 - 18:30',
    'Ca 4': '18:30 - 19:15',
    'Ca 5': '19:15 - 20:00',
  },
  T7: {
    'Ca 1': '09:00 - 09:45',
    'Ca 2': '09:45 - 10:30',
    'Ca 3': '10:30 - 11:15',
    'Ca 4': '15:30 - 16:15',
    'Ca 5': '16:15 - 17:00',
  },
};

export const KUMON_SCHEDULE: Record<Weekday, Array<{ shift: ClassShift; time: string }>> = {
  T2: CLASS_SHIFT_OPTIONS.map((shift) => ({ shift, time: SHIFT_TIME_RANGES.T2[shift] })),
  T3: CLASS_SHIFT_OPTIONS.map((shift) => ({ shift, time: SHIFT_TIME_RANGES.T3[shift] })),
  T4: CLASS_SHIFT_OPTIONS.map((shift) => ({ shift, time: SHIFT_TIME_RANGES.T4[shift] })),
  T5: CLASS_SHIFT_OPTIONS.map((shift) => ({ shift, time: SHIFT_TIME_RANGES.T5[shift] })),
  T6: CLASS_SHIFT_OPTIONS.map((shift) => ({ shift, time: SHIFT_TIME_RANGES.T6[shift] })),
  T7: CLASS_SHIFT_OPTIONS.map((shift) => ({ shift, time: SHIFT_TIME_RANGES.T7[shift] })),
};

export const revenuePerSubject = 1500000;

export function getSubjectLabel(code: SubjectCode) {
  return SUBJECTS.find((subject) => subject.code === code)?.label ?? code;
}

export function getScheduleLabel(weekday: Weekday, shift: ClassShift) {
  const slot = KUMON_SCHEDULE[weekday].find((item) => item.shift === shift);
  return slot ? `${weekday} - ${shift} (${slot.time})` : `${weekday} - ${shift}`;
}

export function getShiftTimeRange(weekday: Weekday, shift: ClassShift) {
  return SHIFT_TIME_RANGES[weekday][shift];
}

export function formatClassShiftByWeekday(weekday: Weekday, shift: ClassShift) {
  return `${shift}: ${getShiftTimeRange(weekday, shift)}`;
}

export function getCertificateLevels(subject: SubjectCode) {
  return subject === 'MATH' ? MATH_LEVELS : EFL_LEVELS;
}
