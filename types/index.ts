export type SubjectCode = 'MATH' | 'EFL';
export type SubjectLabel = 'Toán' | 'Tiếng Anh';
export type StudentStatus = 'Chính thức' | 'Thôi học' | 'Học thử' | 'Hết hạn';
export type Gender = 'Nam' | 'Nữ' | 'Khác';
export type EnrollmentType = '2 buổi/tuần' | 'Hàng ngày';
export type RegistrationType = 'Chính thức' | 'Học thử';
export type ClassShift = 'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca 4' | 'Ca 5';
export type Weekday = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';
export type LeadStatus = 'Mới' | 'Đang liên hệ' | 'Đã đặt hẹn' | 'Đã đăng ký' | 'Có thể liên hệ lại' | 'Không tiềm năng';
export type LeadSource = 'Facebook' | 'Website' | 'Điện thoại' | 'Giới thiệu';
export type AppointmentStatus = 'Chờ đến' | 'Hoàn thành' | 'Hẹn lại' | 'Không đến';
export type FinanceType = 'Lương' | 'Thuê mặt bằng' | 'Văn phòng phẩm' | 'Marketing' | 'Điện nước' | 'Khấu hao' | 'Khác';
export type StaffRole = 'Admin' | 'Giáo viên' | 'Trợ giảng' | 'Tư vấn';
export type StaffEmploymentType = 'Full-time' | 'Part-time';
export type AttendanceStatus = 'Hiện diện' | 'Vắng';
export type WorksheetMode = 'Nhập vào' | 'Sử dụng' | 'Tồn kho';

export interface Center {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
}

export interface Student {
  id: number;
  centerId: number;
  fullName: string;
  birthDate?: string | null;
  gender: Gender;
  admissionDate: string;
  fatherFullName: string | null;
  fatherPhone: string | null;
  motherFullName: string | null;
  motherPhone: string | null;
  address: string | null;
  status: StudentStatus;
  reportB: boolean;
  leaveProofImage?: string | null;
  assignedStaffId?: number | null;
}

export interface Subject {
  id: number;
  code: SubjectCode;
  label: SubjectLabel;
}

export interface Enrollment {
  id: number;
  studentId: number;
  subjectCode: SubjectCode;
  registrationType: RegistrationType;
  enrollmentType: EnrollmentType;
  studyDays: string;
  classShift: ClassShift;
  startDate: string;
  reportBDate?: string | null;
  reenrollDate?: string | null;
  endDate?: string | null;
}

export interface Lead {
  id: number;
  centerId: number;
  fullName: string;
  parentPhone: string;
  parentName: string;
  status: LeadStatus;
  source: LeadSource;
  preferredSubjects: SubjectCode[];
  note?: string | null;
  convertedStudentId?: number | null;
  createdAt: string;
}

export interface Appointment {
  id: number;
  leadId: number;
  scheduledAt: string;
  status: AppointmentStatus;
  note?: string | null;
}

export interface Finance {
  id: number;
  type: FinanceType;
  amount: number;
  spentAt: string;
  proofImage?: string | null;
  note?: string | null;
}

export interface Staff {
  id: number;
  fullName: string;
  role: StaffRole;
  employmentType: StaffEmploymentType;
  salary: number;
  hourlyRate?: number | null;
  leaveDate?: string | null;
  timeEntries?: Array<{
    id: number;
    workDate: string;
    clockIn: string;
    clockOut?: string | null;
    note?: string | null;
  }>;
  active: boolean;
}

export interface ClassGroup {
  id: number;
  subjectCode: SubjectCode;
  weekday: Weekday;
  classShift: ClassShift;
  teacherId?: number | null;
  label: string;
}

export interface Attendance {
  id: number;
  classGroupId: number;
  studentId: number;
  date: string;
  checkOutAt?: string | null;
  status: AttendanceStatus;
  makeUpClassGroupId?: number | null;
}

export interface AssessmentRecord {
  id: number;
  studentId: number;
  subjectCode: SubjectCode;
  level: string;
  correctAnswers: number;
  totalQuestions: number;
  actualMinutes: number;
  standardMinutes: number;
  groupNo: 1 | 2 | 3;
  testDate: string;
}

export interface WorksheetBatch {
  id: number;
  subjectCode: SubjectCode;
  level: string;
  codeRange: string;
  quantity: number;
  receivedAt: string;
  note?: string | null;
}

export interface WorksheetUsage {
  id: number;
  batchId: number;
  studentId?: number | null;
  quantity: number;
  usedAt: string;
  preparedBy?: string | null;
  note?: string | null;
}

export interface CertificateRecord {
  id: number;
  studentName: string;
  subjectCode: SubjectCode;
  size: 'small' | 'large';
  level?: string | null;
  receivedAt: string;
}

export interface CertificateFormData {
  studentName: string;
  subjectCode: SubjectCode;
  size: 'small' | 'large';
  level?: string;
  receivedAt: string;
}

export interface CertificateStudentSuggestion {
  id: number;
  fullName: string;
  currentLevels?: Partial<Record<SubjectCode, string | null>>;
  latestLevel?: string | null;
  latestSubject?: SubjectCode | null;
}

export interface DashboardMonthStat {
  month: string;
  activeStudents: number;
  trialStudents: number;
  droppedStudents: number;
  totalLessons: number;
  revenue: number;
  expense: number;
}
