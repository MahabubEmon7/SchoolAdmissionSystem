import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Users,
  Layers,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Database,
  Building2,
} from 'lucide-react';
import { useAppStore, type Tab } from '../../store/useAppStore';
import { useMyHolds, useClasses, useAdminStats, useActiveSession } from '../../hooks/useAdmissions';
import { useStudentId } from '../../hooks/useStudentId';
import { Badge } from '@/components/ui/badge';

interface AppSidebarProps {
  onNavigate?: () => void;
  onOpenResetDb?: () => void;
}

export function AppSidebar({ onNavigate, onOpenResetDb }: AppSidebarProps) {
  const currentTab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const { studentId, isValid } = useStudentId();

  const holdsQuery = useMyHolds();
  const classesQuery = useClasses();
  const statsQuery = useAdminStats();
  const activeSessionQuery = useActiveSession();
  const activeSession = activeSessionQuery.data?.activeSession;

  const totalClasses = classesQuery.data?.length ?? 0;
  const holds = holdsQuery.data ?? [];
  const activeHold = holds.find(
    (h) =>
      h.status === 'HELD' ||
      h.status === 'WAITLISTED' ||
      h.status === 'CONFIRMED',
  );
  const activeCount = holds.filter((h) => h.status === 'HELD' || h.status === 'WAITLISTED').length;

  const navigateTo = (tab: Tab) => {
    setTab(tab);
    if (onNavigate) onNavigate();
  };

  const navSections = [
    {
      title: 'Portal',
      items: [
        {
          id: 'classes' as Tab,
          label: 'Browse Classes',
          icon: BookOpen,
          // Only classes families can apply to right now.
          badge: activeSession && activeSession.classCount > 0 ? `${activeSession.classCount}` : undefined,
          badgeTone: 'neutral' as const,
        },
        {
          id: 'applications' as Tab,
          label: 'My Applications',
          icon: GraduationCap,
          badge: activeCount > 0 ? `${activeCount} Active` : undefined,
          badgeTone: (activeCount > 0 ? 'warning' : 'neutral') as 'warning' | 'neutral',
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          id: 'admin-overview' as Tab,
          alias: 'admin',
          label: 'Analytics & KPIs',
          icon: LayoutDashboard,
          badge: statsQuery.data ? `${statsQuery.data.occupancyRate}%` : undefined,
          badgeTone: 'info' as const,
        },
        {
          id: 'admin-classes' as Tab,
          label: 'Class Operations',
          icon: Layers,
          badge: totalClasses > 0 ? `${totalClasses}` : undefined,
          badgeTone: 'neutral' as const,
        },
        {
          id: 'admin-sessions' as Tab,
          label: 'Admission Sessions',
          icon: CalendarDays,
          badge: activeSession ? 'Active' : undefined,
          badgeTone: (activeSession ? 'success' : 'neutral') as 'success' | 'neutral',
        },
        {
          id: 'admin-ledger' as Tab,
          label: 'Student Ledger',
          icon: Users,
        },
      ],
    },
  ];

  return (
    <aside className="flex h-full w-full flex-col justify-between border-r border-slate-800/80 bg-slate-950 px-4 py-5 text-slate-300">
      <div className="space-y-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/25">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-white">
              Demo School
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] font-medium text-slate-500">Admissions</p>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] text-sky-400 font-semibold bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.2 rounded">
                {activeSession ? `${activeSession.academicYear}–${activeSession.academicYear + 1}` : 'Closed'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-5" aria-label="Main Navigation">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </span>
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    currentTab === item.id ||
                    (item.id === 'admin-overview' && currentTab === 'admin');

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateTo(item.id)}
                      className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20'
                          : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`size-4 transition-colors ${
                            isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <Badge tone={item.badgeTone} className="px-1.5 py-0 text-[10px]">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer: Student Identity Status & Quick Database Reset */}
      <div className="space-y-3 pt-4 border-t border-slate-900">
        {/* Student Session Card */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Active Applicant
            </span>
            {isValid ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                <AlertCircle className="size-3" aria-hidden="true" />
                No ID
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-white truncate">
            {isValid ? studentId : 'Guest / Enter ID'}
          </p>
          {activeHold && (
            <div className="mt-2 flex items-center justify-between border-t border-slate-800/60 pt-2 text-[11px]">
              <span className="text-slate-400 truncate">{activeHold.className}</span>
              <Badge
                tone={
                  activeHold.status === 'CONFIRMED'
                    ? 'success'
                    : activeHold.status === 'HELD'
                      ? 'warning'
                      : 'danger'
                }
                className="text-[9px] px-1 py-0 uppercase"
              >
                {activeHold.status}
              </Badge>
            </div>
          )}
        </div>

        {/* System & Database Quick Action */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span>Telemetry Online</span>
          </div>
          {onOpenResetDb && (
            <button
              type="button"
              onClick={onOpenResetDb}
              className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 text-[11px]"
              title="Reset Database"
            >
              <Database className="size-3" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
