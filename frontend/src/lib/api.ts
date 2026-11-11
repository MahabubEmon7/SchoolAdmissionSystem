import { API_URL } from './config';
import type {
  AcademicSessionDetail,
  AcademicYearsResponse,
  ActiveSessionResponse,
  AdminHoldDetail,
  AdminStats,
  ArchiveSessionResponse,
  ClassFilters,
  ClassShift,
  ConfirmedHold,
  CreatedClass,
  CreatedHold,
  CreateSessionRequest,
  SchoolClass,
  SeedDatabaseResponse,
  StudentHold,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  studentId?: string;
  body?: unknown;
}

const TIMEOUT_MS = 10_000;

export async function request<T>(path: string, { method = 'GET', studentId, body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (studentId !== undefined) headers['X-Student-Id'] = studentId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Server offline. Check that the backend is running, then try again.');
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      error.error ?? 'HTTP_' + response.status,
      error.message ?? 'The server could not complete this request.',
    );
  }
  return data as T;
}

export const api = {
  listClasses: (filters?: ClassFilters) => {
    const query = new URLSearchParams();
    if (filters?.grade) query.set('grade', String(filters.grade));
    if (filters?.shift) query.set('shift', filters.shift);
    if (filters?.availableOnly) query.set('availableOnly', 'true');
    if (filters?.search) query.set('search', filters.search);
    if (filters?.academicYear) query.set('year', String(filters.academicYear));
    const qs = query.toString();
    return request<SchoolClass[]>(`/classes${qs ? `?${qs}` : ''}`);
  },
  createClass: (grade: number, shift: ClassShift, totalSeats: number, academicYear?: number) =>
    request<CreatedClass>('/classes', { method: 'POST', body: { grade, shift, totalSeats, academicYear } }),
  updateClassSeats: (classId: string, totalSeats: number) =>
    request<SchoolClass>(`/classes/${classId}`, { method: 'PATCH', body: { totalSeats } }),
  applyForClass: (classId: string, studentId: string) =>
    request<CreatedHold>(`/classes/${classId}/holds`, { method: 'POST', studentId }),
  joinWaitlist: (classId: string, studentId: string) =>
    request<CreatedHold>(`/classes/${classId}/waitlist`, { method: 'POST', studentId }),
  myHolds: (studentId: string) => request<StudentHold[]>('/me/holds', { studentId }),
  confirmHold: (holdId: string, studentId: string, info?: { studentName?: string; age?: number }) =>
    request<ConfirmedHold>(`/holds/${holdId}/confirm`, { method: 'POST', studentId, body: info ?? {} }),
  updateStudentInfo: (holdId: string, studentId: string, info: { studentName: string; age: number }) =>
    request<StudentHold>(`/holds/${holdId}/info`, { method: 'PATCH', studentId, body: info }),
  cancelHold: (holdId: string, studentId: string) =>
    request<void>(`/holds/${holdId}`, { method: 'DELETE', studentId }),
  adminStats: (year?: number) =>
    request<AdminStats>(`/admin/stats${year ? `?year=${year}` : ''}`),
  adminApplications: (params?: { year?: number; classId?: string; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.year) query.set('year', String(params.year));
    if (params?.classId) query.set('classId', params.classId);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return request<AdminHoldDetail[]>(`/admin/applications${qs ? `?${qs}` : ''}`);
  },
  academicYears: () => request<AcademicYearsResponse>('/admin/academic-years'),
  activeSession: () => request<ActiveSessionResponse>('/sessions/active'),
  listSessions: () => request<AcademicSessionDetail[]>('/admin/sessions'),
  createSession: (data: CreateSessionRequest) =>
    request<AcademicSessionDetail>('/admin/sessions', { method: 'POST', body: data }),
  archiveSession: (year: number) =>
    request<ArchiveSessionResponse>(`/admin/sessions/${year}/archive`, { method: 'POST' }),
  activateSession: (year: number) =>
    request<AcademicSessionDetail>(`/admin/sessions/${year}/activate`, { method: 'POST' }),
  archivePastYears: (cutoffYear?: number) =>
    request<{ prunedCount: number; message: string }>(
      `/admin/academic-years/archive-past${cutoffYear ? `?cutoffYear=${cutoffYear}` : ''}`,
      { method: 'POST' },
    ),
  deleteClass: (classId: string) => request<void>(`/classes/${classId}`, { method: 'DELETE' }),
  seedDatabase: () => request<SeedDatabaseResponse>('/admin/seed', { method: 'POST' }),
};

// Codes whose server message isn't ideal for students. Others (SEATS_FULL, ALREADY_APPLIED, ...)
// already carry a specific, friendly message from the API.
const FRIENDLY: Record<string, string> = {
  INVALID_STUDENT_ID: 'Invalid ID. Enter your 17-digit Birth Registration Number.',
  INVALID_STUDENT_INFO: 'Invalid student details.',
  HOLD_EXPIRED: 'Hold expired. Please apply again.',
  FORBIDDEN: 'This application belongs to a different student.',
  SERVER_ERROR: 'Server could not complete payment. Please try again.',
};

/** A short message that is safe to show to a student. */
export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) return FRIENDLY[error.code] ?? error.message;
  return 'Something went wrong. Please try again.';
}
