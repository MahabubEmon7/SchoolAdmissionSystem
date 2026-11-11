export type HoldStatus = 'WAITLISTED' | 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
export type ClassShift = 'MORNING' | 'DAY';

export const CURRENT_ACADEMIC_YEAR = 2026;

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
export const SHIFTS: Array<{ value: ClassShift; label: string }> = [
  { value: 'MORNING', label: 'Morning Shift' },
  { value: 'DAY', label: 'Day Shift' },
];

export interface ClassFilters {
  grade?: number;
  shift?: ClassShift;
  availableOnly?: boolean;
  search?: string;
  academicYear?: number;
}

/** Applications that still count as "the student's one class". */
export const ACTIVE_STATUSES: HoldStatus[] = ['WAITLISTED', 'HELD', 'CONFIRMED'];

export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  grade: number;
  shift: ClassShift;
  waitlistCount: number;
  academicYear: number;
}

export interface CreatedClass {
  id: string;
  name: string;
  totalSeats: number;
  grade: number;
  shift: ClassShift;
  academicYear: number;
}

export interface CreatedHold {
  holdId: string;
  classId: string;
  studentId: string;
  status: HoldStatus;
  expiresAt: string | null;
  waitlistPosition: number | null;
  academicYear: number;
}

export interface StudentHold {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  /** Payment deadline; null while waitlisted. */
  expiresAt: string | null;
  createdAt: string;
  waitlistPosition: number | null;
  studentName?: string | null;
  age?: number | null;
  academicYear: number;
}

export interface ConfirmedHold {
  holdId: string;
  status: 'CONFIRMED';
  studentName?: string | null;
  age?: number | null;
  academicYear: number;
}

export interface AdminShiftStat {
  shift: string;
  label: string;
  totalSeats: number;
  confirmed: number;
  held: number;
  available: number;
  waitlist: number;
}

export interface AdminClassStat {
  id: string;
  name: string;
  grade: number;
  shift: ClassShift;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  waitlistCount: number;
  occupancyRate: number;
  academicYear: number;
}

export interface AdminStats {
  totalCapacity: number;
  totalHeld: number;
  totalConfirmed: number;
  totalAvailable: number;
  totalWaitlist: number;
  totalCancelled: number;
  totalExpired: number;
  occupancyRate: number;
  classCount: number;
  shiftStats: AdminShiftStat[];
  classes: AdminClassStat[];
  academicYear: number;
  isArchived: boolean;
}

export interface AdminHoldDetail {
  holdId: string;
  classId: string;
  className: string;
  grade: number;
  shift: ClassShift;
  studentId: string;
  status: HoldStatus;
  expiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  queueNumber: number;
  waitlistPosition: number | null;
  studentName?: string | null;
  age?: number | null;
  academicYear: number;
}

export interface AcademicYearInfo {
  year: number;
  label: string;
  isActive: boolean;
  totalClasses: number;
  totalConfirmed: number;
  totalCapacity: number;
}

export interface AcademicYearsResponse {
  activeYear: number;
  years: AcademicYearInfo[];
}

export type SessionStatus = 'ACTIVE' | 'UPCOMING' | 'ARCHIVED';

export interface CreateSessionRequest {
  academicYear: number;
  title?: string;
  status: SessionStatus;
  startsAt?: string | null;
  notes?: string | null;
}

export interface AcademicSessionDetail {
  academicYear: number;
  title: string;
  status: SessionStatus;
  startsAt: string | null;
  createdAt: string;
  archivedAt: string | null;
  classCount: number;
  totalCapacity: number;
  confirmedCount: number;
  heldCount: number;
  waitlistCount: number;
  notes?: string | null;
}

export interface ActiveSessionResponse {
  activeSession: AcademicSessionDetail | null;
  nextUpcomingSession: AcademicSessionDetail | null;
}

export interface ArchiveSessionResponse {
  academicYear: number;
  title: string;
  prunedCount: number;
  admittedRetainedCount: number;
  message: string;
}

export interface SeedDatabaseResponse {
  totalSessions: number;
  totalClasses: number;
  totalStudents: number;
  confirmedStudents: number;
  heldStudents: number;
  waitlistedStudents: number;
  message: string;
}
