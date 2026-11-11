import { isValidStudentId } from '../lib/format';
import { useAppStore } from '../store/useAppStore';

/** The saved student ID, plus whether it is a complete 17-digit number. */
export function useStudentId() {
  const studentId = useAppStore((s) => s.studentId);
  return { studentId, isValid: isValidStudentId(studentId) };
}
