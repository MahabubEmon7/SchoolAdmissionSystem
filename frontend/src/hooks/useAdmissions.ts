import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { api, friendlyError } from '../lib/api';
import { CLASSES_POLL_MS, HOLDS_POLL_MS } from '../lib/config';
import { ACTIVE_STATUSES, type ClassFilters, type ClassShift, type CreateSessionRequest } from '../lib/types';
import { useStudentId } from './useStudentId';

export const queryKeys = {
  activeSession: ['active-session'] as const,
  sessions: ['admin-sessions'] as const,
  classes: (filters?: ClassFilters) =>
    [
      'classes',
      filters?.grade ?? 0,
      filters?.shift ?? '',
      filters?.availableOnly ?? false,
      filters?.search ?? '',
      filters?.academicYear ?? 0,
    ] as const,
  myHolds: (studentId: string) => ['my-holds', studentId] as const,
  adminStats: (year?: number) => ['admin-stats', year ?? 0] as const,
  adminApplications: (filters?: { year?: number; classId?: string; status?: string; search?: string }) =>
    [
      'admin-applications',
      filters?.year ?? 0,
      filters?.classId ?? '',
      filters?.status ?? '',
      filters?.search ?? '',
    ] as const,
  academicYears: ['academic-years'] as const,
};

/** All classes with live seat counts, polled every few seconds. Supports server-side filters. */
export function useClasses(filters?: ClassFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.classes(filters),
    queryFn: () => api.listClasses(filters),
    refetchInterval: CLASSES_POLL_MS,
    enabled: options?.enabled ?? true,
  });
}

/** The current student's applications (only when a valid ID is entered). */
export function useMyHolds() {
  const { studentId, isValid } = useStudentId();
  return useQuery({
    queryKey: queryKeys.myHolds(studentId),
    queryFn: () => api.myHolds(studentId),
    enabled: isValid,
    refetchInterval: HOLDS_POLL_MS,
  });
}

/**
 * The student's one active application (waitlisted, held or confirmed), if any.
 * A hold whose timer ran out on this device no longer counts.
 */
export function useActiveApplication() {
  const { data } = useMyHolds();
  const now = Date.now();
  return data?.find(
    (h) => ACTIVE_STATUSES.includes(h.status) && !(h.status === 'HELD' && h.expiresAt && Date.parse(h.expiresAt) <= now),
  );
}

/** Refreshes seat counts and the student's applications after any change. */
export function useRefreshAdmissions() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        ['classes', 'my-holds', 'admin-stats', 'admin-applications', 'admin-sessions', 'active-session'].includes(
          String(q.queryKey[0]),
        ),
    });
}

const notifyError = (error: unknown) => toast.error(friendlyError(error));

export function useCreateClass() {
  const refresh = useRefreshAdmissions();
  return useMutation({
    mutationFn: ({
      grade,
      shift,
      totalSeats,
      academicYear,
    }: {
      grade: number;
      shift: ClassShift;
      totalSeats: number;
      academicYear?: number;
    }) => api.createClass(grade, shift, totalSeats, academicYear),
    onSuccess: (created) => toast.success(`“${created.name}” created with ${created.totalSeats} seats.`),
    onError: notifyError,
    onSettled: refresh,
  });
}

export function useUpdateClassSeats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, totalSeats }: { classId: string; totalSeats: number }) =>
      api.updateClassSeats(classId, totalSeats),
    onSuccess: (updated) => {
      toast.success(`“${updated.name}” capacity updated to ${updated.totalSeats} seats.`);
      queryClient.invalidateQueries({ predicate: (q) => ['classes', 'admin-stats'].includes(String(q.queryKey[0])) });
    },
    onError: notifyError,
  });
}

export function useApply() {
  const { studentId } = useStudentId();
  const refresh = useRefreshAdmissions();
  return useMutation({
    mutationFn: (classId: string) => api.applyForClass(classId, studentId),
    onSuccess: () => toast.success('Seat held! Pay the admission fee before the timer runs out.'),
    onError: notifyError,
    onSettled: refresh,
  });
}

export function useJoinWaitlist() {
  const { studentId } = useStudentId();
  const refresh = useRefreshAdmissions();
  return useMutation({
    mutationFn: (classId: string) => api.joinWaitlist(classId, studentId),
    onSuccess: (entry) =>
      entry.status === 'HELD'
        ? toast.success('A seat just opened up and is now held for you. Pay before the timer runs out.')
        : toast.success(`You're #${entry.waitlistPosition} on the waitlist. We'll hold a seat for you as soon as one frees up.`),
    onError: notifyError,
    onSettled: refresh,
  });
}

export function useConfirmHold() {
  const { studentId } = useStudentId();
  const refresh = useRefreshAdmissions();
  return useMutation({
    mutationFn: ({ holdId, studentName, age }: { holdId: string; studentName: string; age: number }) =>
      api.confirmHold(holdId, studentId, { studentName, age }),
    onSuccess: () => toast.success('Payment complete. Your admission is officially confirmed!'),
    onError: notifyError,
    onSettled: refresh,
  });
}

export function useUpdateStudentInfo() {
  const { studentId } = useStudentId();
  const refresh = useRefreshAdmissions();
  return useMutation({
    mutationFn: ({ holdId, studentName, age }: { holdId: string; studentName: string; age: number }) =>
      api.updateStudentInfo(holdId, studentId, { studentName, age }),
    onSuccess: () => toast.success('Student details updated successfully.'),
    onError: notifyError,
    onSettled: refresh,
  });
}

export function useCancelHold() {
  const { studentId } = useStudentId();
  const refresh = useRefreshAdmissions();
  return useMutation({
    mutationFn: (holdId: string) => api.cancelHold(holdId, studentId),
    onSuccess: () => toast.info('Application cancelled.'),
    onError: notifyError,
    onSettled: refresh,
  });
}

/** Admin real-time stats overview, polled every few seconds. */
export function useAdminStats(year?: number) {
  return useQuery({
    queryKey: queryKeys.adminStats(year),
    queryFn: () => api.adminStats(year),
    refetchInterval: CLASSES_POLL_MS,
  });
}

/** Admin full applications list with optional filters. */
export function useAdminApplications(filters?: { year?: number; classId?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.adminApplications(filters),
    queryFn: () => api.adminApplications(filters),
    refetchInterval: HOLDS_POLL_MS,
  });
}

/** List of all academic years in the system. */
export function useAcademicYears() {
  return useQuery({
    queryKey: queryKeys.academicYears,
    queryFn: () => api.academicYears(),
    staleTime: 30_000,
  });
}

/** Archive previous years (keeping only confirmed students). */
export function useArchivePastYears() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cutoffYear?: number) => api.archivePastYears(cutoffYear),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => api.deleteClass(classId),
    onSuccess: () => {
      toast.info('Class deleted successfully.');
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'classes' });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats() });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'admin-applications' });
    },
    onError: notifyError,
  });
}

export function useResetDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetDatabase(),
    onSuccess: () => {
      toast.success('Database reset: all classes and applications cleared.');
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });
}

export function useSeedDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.seedDatabase(),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });
}

/** Currently active admission session and upcoming announcements. */
export function useActiveSession() {
  return useQuery({
    queryKey: queryKeys.activeSession,
    queryFn: () => api.activeSession(),
    refetchInterval: CLASSES_POLL_MS,
  });
}

/** All academic sessions (active, upcoming, archived). */
export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => api.listSessions(),
    refetchInterval: CLASSES_POLL_MS,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSessionRequest) => api.createSession(data),
    onSuccess: (session) => {
      toast.success(`Session "${session.title}" created successfully.`);
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });
}

export function useArchiveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (year: number) => api.archiveSession(year),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });
}

export function useActivateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (year: number) => api.activateSession(year),
    onSuccess: (session) => {
      toast.success(`Session "${session.title}" is now active! Admissions opened.`);
      queryClient.invalidateQueries();
    },
    onError: notifyError,
  });
}
