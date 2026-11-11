import { Menu, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { queryKeys, useClasses, useAdminStats, useMyHolds } from '../../hooks/useAdmissions';
import { StudentIdField } from './StudentIdField';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  classes: {
    title: 'Browse Classes',
    subtitle: 'Live seat availability for the current admission session',
  },
  applications: {
    title: 'My Applications',
    subtitle: 'Review seat holds, complete admissions payment, or manage waitlists',
  },
  'admin-overview': {
    title: 'Analytics & Telemetry',
    subtitle: 'School-wide capacity metrics, enrollment ratios, and distribution charts',
  },
  'admin-classes': {
    title: 'Class Operations',
    subtitle: 'Create, monitor, and manage grade levels, shifts, and seating quotas',
  },
  'admin-ledger': {
    title: 'Student Applications Ledger',
    subtitle: 'Live audit log of all applicant queues, timers, and transactions',
  },
  admin: {
    title: 'Analytics & Telemetry',
    subtitle: 'School-wide capacity metrics, enrollment ratios, and distribution charts',
  },
};

export function DashboardHeader({ onOpenMobileMenu }: DashboardHeaderProps) {
  const tab = useAppStore((s) => s.tab);
  const queryClient = useQueryClient();
  const classesQuery = useClasses();
  const statsQuery = useAdminStats();
  const holdsQuery = useMyHolds();

  const isRefreshing = classesQuery.isFetching || statsQuery.isFetching || holdsQuery.isFetching;

  const handleRefresh = () => {
    // Every class list on screen (any filter or year), plus the session they belong to.
    queryClient.refetchQueries({ queryKey: ['classes'] });
    queryClient.refetchQueries({ queryKey: queryKeys.activeSession });
    statsQuery.refetch();
    holdsQuery.refetch();
  };

  const currentInfo = TAB_TITLES[tab] ?? TAB_TITLES.classes;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-3 backdrop-blur-md sm:px-5 lg:px-6">
      {/* Left: Mobile Trigger & Breadcrumb Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex size-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" aria-hidden="true" />
        </button>

        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white sm:text-base">
            {currentInfo.title}
          </h2>
          <p className="hidden text-[11px] text-slate-400 sm:block">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Student ID input & Refresh button */}
      <div className="flex items-center gap-3">
        <StudentIdField />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="size-9 p-0 text-slate-400 hover:text-white"
          title="Refresh telemetry"
          aria-label="Refresh telemetry data"
        >
          <RefreshCw
            className={`size-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`}
            aria-hidden="true"
          />
        </Button>
      </div>
    </header>
  );
}
