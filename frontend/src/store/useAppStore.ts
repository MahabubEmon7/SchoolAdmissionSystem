import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sanitizeStudentId } from '../lib/format';

export type Tab = 'classes' | 'applications' | 'admin-overview' | 'admin-classes' | 'admin-sessions' | 'admin-ledger' | 'admin';

interface AppState {
  studentId: string;
  tab: Tab;
  setStudentId: (value: string) => void;
  setTab: (tab: Tab) => void;
}

/** Student ID and current tab, saved in localStorage so they survive a refresh. */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      studentId: '',
      tab: 'classes',
      setStudentId: (value) => set({ studentId: sanitizeStudentId(value) }),
      setTab: (tab) => set({ tab }),
    }),
    {
      name: 'school-admission',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
