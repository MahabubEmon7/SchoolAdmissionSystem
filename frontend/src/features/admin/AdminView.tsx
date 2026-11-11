import { useState } from 'react';
import { useClasses, useAdminStats, useSessions } from '../../hooks/useAdmissions';
import { useAppStore } from '../../store/useAppStore';
import { CURRENT_ACADEMIC_YEAR } from '../../lib/types';
import { Select } from '@/components/ui/select';
import { Calendar, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AdminKpis } from './AdminKpis';
import { AdminCharts } from './AdminCharts';
import { CreateClassForm } from './CreateClassForm';
import { SeatOverview } from './SeatOverview';
import { ClassCardsGrid } from './ClassCardsGrid';
import { ApplicationsLedger } from './ApplicationsLedger';
import { SessionsManagement } from '../sessions/SessionsManagement';

export function AdminOverviewSection() {
  const { data: sessionsList } = useSessions();
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_ACADEMIC_YEAR);

  const statsQuery = useAdminStats(selectedYear);
  const classesQuery = useClasses({ academicYear: selectedYear });
  const stats = statsQuery.data;
  const classes = classesQuery.data ?? [];

  const currentSession = sessionsList?.find((s) => s.academicYear === selectedYear);
  const isArchived = currentSession ? currentSession.status === 'ARCHIVED' : selectedYear < CURRENT_ACADEMIC_YEAR;
  const isUpcoming = currentSession?.status === 'UPCOMING';

  return (
    <div className="space-y-6">
      {/* Header Bar with Academic Session Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/25">
            <Calendar className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                {currentSession?.title ?? `Academic Session ${selectedYear}–${selectedYear + 1}`}
              </h2>
              {isArchived ? (
                <Badge tone="neutral" className="text-[10px]">
                  Archived Past Session
                </Badge>
              ) : isUpcoming ? (
                <Badge tone="info" className="text-[10px]">
                  Upcoming Cycle
                </Badge>
              ) : (
                <Badge tone="success" className="text-[10px]">
                  Active Admission Cycle
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isArchived
                ? 'Historical cohort record: Displays confirmed admitted students only.'
                : isUpcoming
                ? 'Scheduled future cohort: Class catalog prepared in advance.'
                : 'Live capacity, payment timers, and real-time waitlist metrics.'}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <Select
            label="Switch Session"
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={(sessionsList && sessionsList.length > 0 ? sessionsList : [
              { academicYear: 2026, title: 'Academic Session 2026–2027', status: 'ACTIVE' },
              { academicYear: 2025, title: 'Academic Session 2025–2026', status: 'ARCHIVED' },
            ]).map((s) => ({
              value: String(s.academicYear),
              label: `${s.title} (${s.status})`,
            }))}
          />
        </div>
      </div>

      <AdminKpis stats={stats} isLoading={statsQuery.isLoading} />
      <AdminCharts stats={stats} />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Live Class Seat Overview</h3>
          <span className="text-xs text-slate-500">Auto-polled every few seconds</span>
        </div>
        <SeatOverview classes={classes} />
      </div>
    </div>
  );
}

export function AdminClassesSection() {
  const { data: sessionsList } = useSessions();
  const [selectedSessionYear, setSelectedSessionYear] = useState<number | 'ALL'>('ALL');

  const classesQuery = useClasses({
    academicYear: selectedSessionYear === 'ALL' ? -1 : selectedSessionYear,
  });
  const classes = classesQuery.data ?? [];
  const setTab = useAppStore((s) => s.setTab);

  return (
    <div className="space-y-4">
      {/* Session Scope & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/25">
            <Layers className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Class Operations & Session Scoping</h2>
              <Badge tone="neutral" className="text-[10px]">
                {classes.length} {classes.length === 1 ? 'Class' : 'Classes'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage classes for upcoming, active, or past admission cycles.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-72">
          <Select
            label="Viewing Session"
            value={String(selectedSessionYear)}
            onChange={(e) => setSelectedSessionYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            options={[
              { value: 'ALL', label: 'All Sessions (Active, Upcoming & Past)' },
              ...(sessionsList ?? []).map((s) => ({
                value: String(s.academicYear),
                label: `${s.title} (${s.status})`,
              })),
            ]}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[20.5rem_1fr] items-start">
        <div className="xl:sticky xl:top-20">
          <CreateClassForm
            existing={classes}
            selectedYear={selectedSessionYear}
            onYearChange={(year) => {
              setSelectedSessionYear(year);
            }}
          />
        </div>
        <div className="min-w-0">
          <ClassCardsGrid
            classes={classes}
            onSelectClass={() => setTab('admin-ledger')}
          />
        </div>
      </div>
    </div>
  );
}

export function AdminLedgerSection() {
  const classesQuery = useClasses({ academicYear: -1 });
  const classes = classesQuery.data ?? [];

  return (
    <div>
      <ApplicationsLedger classes={classes} />
    </div>
  );
}

export function AdminView() {
  const currentTab = useAppStore((s) => s.tab);

  if (currentTab === 'admin-classes') return <AdminClassesSection />;
  if (currentTab === 'admin-sessions') return <SessionsManagement />;
  if (currentTab === 'admin-ledger') return <AdminLedgerSection />;
  return <AdminOverviewSection />;
}
