import { useState, type ReactNode } from 'react';
import { CalendarClock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  useActiveApplication,
  useActiveSession,
  useApply,
  useClasses,
  useJoinWaitlist,
} from '../../hooks/useAdmissions';
import { useCountdown } from '../../hooks/useCountdown';
import { useStudentId } from '../../hooks/useStudentId';
import { useAppStore } from '../../store/useAppStore';
import type { AcademicSessionDetail, ClassFilters, SchoolClass } from '../../lib/types';
import { formatFutureCountdown } from '../../lib/format';
import { getApplyState } from './applyState';
import { ActiveApplicationBanner } from './ActiveApplicationBanner';
import { ClassCard } from './ClassCard';
import { ClassFilterBar } from './ClassFilterBar';

/**
 * What a family sees, in order of priority:
 *   1. "open"     — a session is accepting applications: only its classes.
 *   2. "upcoming" — nothing open, a session is announced: its opening date and a preview.
 *   3. "closed"   — nothing open or announced: check back later.
 */
type View =
  | { kind: 'open'; session: AcademicSessionDetail }
  | { kind: 'upcoming'; session: AcademicSessionDetail }
  | { kind: 'closed' };

function pickView(active?: AcademicSessionDetail | null, upcoming?: AcademicSessionDetail | null): View {
  if (active && active.classCount > 0) return { kind: 'open', session: active };
  if (upcoming) return { kind: 'upcoming', session: upcoming };
  return { kind: 'closed' };
}

function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }) : '';
}

export function ClassList() {
  const [filters, setFilters] = useState<ClassFilters>({});
  const sessions = useActiveSession();
  const view = pickView(sessions.data?.activeSession, sessions.data?.nextUpcomingSession);

  // Only the classes of the session being shown. Filters apply to open admissions only.
  const year = view.kind === 'closed' ? undefined : view.session.academicYear;
  const classes = useClasses(
    view.kind === 'open' ? { ...filters, academicYear: year } : { academicYear: year },
    { enabled: year !== undefined },
  );

  if (sessions.isPending || (year !== undefined && classes.isPending)) return <LoadingView />;

  if (sessions.isError || (year !== undefined && classes.isError && !classes.data)) {
    return (
      <EmptyState
        icon={<Icon name="offline" aria-hidden="true" />}
        title="Server offline"
        description="We can't reach the admissions server right now. We'll keep retrying."
        action={
          <Button type="button" variant="secondary" onClick={() => { sessions.refetch(); classes.refetch(); }}>
            Try again
          </Button>
        }
      />
    );
  }

  if (view.kind === 'open') {
    return (
      <OpenAdmissions
        session={view.session}
        classes={classes.data ?? []}
        filters={filters}
        onFiltersChange={setFilters}
      />
    );
  }
  if (view.kind === 'upcoming') {
    return <UpcomingAdmissions session={view.session} classes={classes.data ?? []} />;
  }
  return <ClosedAdmissions />;
}

function LoadingView() {
  return (
    <section className="space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-16" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
      </div>
    </section>
  );
}

function PageHeader({ title, badge, description }: { title: string; badge: ReactNode; description: string }) {
  return (
    <div className="border-b border-slate-800/60 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
        {badge}
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{description}</p>
    </div>
  );
}

// --- 1. Admissions open ------------------------------------------------------------

function OpenAdmissions({
  session,
  classes,
  filters,
  onFiltersChange,
}: {
  session: AcademicSessionDetail;
  classes: SchoolClass[];
  filters: ClassFilters;
  onFiltersChange: (filters: ClassFilters) => void;
}) {
  const active = useActiveApplication();
  const apply = useApply();
  const waitlist = useJoinWaitlist();
  const { isValid } = useStudentId();
  const setTab = useAppStore((s) => s.setTab);
  const showApplication = { onSuccess: () => setTab('applications') };

  return (
    <section className="space-y-4">
      <PageHeader
        title={session.title}
        badge={
          <Badge tone="success" className="flex items-center gap-1.5 text-[10px] font-semibold">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Admissions open
          </Badge>
        }
        description="Choose a grade and shift. Seat counts update live. Each student can apply to one class."
      />

      {active && <ActiveApplicationBanner application={active} onView={() => setTab('applications')} />}

      <ClassFilterBar filters={filters} onChange={onFiltersChange} resultCount={classes.length} />

      {classes.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" aria-hidden="true" />}
          title="No matching classes"
          description="No classes match your grade, shift or search."
          action={
            <Button type="button" variant="secondary" onClick={() => onFiltersChange({})}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const state = getApplyState({ seats: c, hasValidId: isValid, active });
            const busy =
              (apply.isPending && apply.variables === c.id) || (waitlist.isPending && waitlist.variables === c.id);
            const onAction = () => {
              if (state.action === 'apply') apply.mutate(c.id, showApplication);
              else if (state.action === 'waitlist') waitlist.mutate(c.id, showApplication);
              else if (state.action === 'view') setTab('applications');
            };
            return <ClassCard key={c.id} seats={c} state={state} busy={busy} onAction={onAction} />;
          })}
        </div>
      )}
    </section>
  );
}

// --- 2. Next session announced ---------------------------------------------------------

function UpcomingAdmissions({ session, classes }: { session: AcademicSessionDetail; classes: SchoolClass[] }) {
  // Ticks every second for the countdown. When it reaches zero the server opens the
  // session on the next poll and this page switches to "Admissions open" by itself.
  useCountdown(session.startsAt, true);
  const totalSeats = classes.reduce((sum, c) => sum + c.totalSeats, 0);

  return (
    <section className="space-y-5">
      <PageHeader
        title={session.title}
        badge={<Badge tone="info" className="text-[10px] font-semibold">Opening soon</Badge>}
        description="Admissions are not open yet. Applications start automatically at the time below."
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-sky-500/30 bg-sky-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <CalendarClock className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Applications open on</p>
            <p className="text-sm font-semibold text-white">{formatDateTime(session.startsAt)}</p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-slate-400">Starts in</p>
          <p className="text-xl font-bold tabular-nums text-sky-300" aria-live="polite">
            {formatFutureCountdown(session.startsAt)}
          </p>
        </div>
      </div>

      {classes.length > 0 ? (
        <>
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{classes.length} classes</span> and{' '}
            <span className="font-semibold text-slate-200">{totalSeats} seats</span> will be offered. You can
            apply as soon as admissions open.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                seats={c}
                state={{ label: 'Applications open soon', action: null }}
                busy={false}
                onAction={() => {}}
                isUpcoming
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">The class list for this session will be published before it opens.</p>
      )}
    </section>
  );
}

// --- 3. Nothing open or announced --------------------------------------------------------

function ClosedAdmissions() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
        <Clock className="size-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-white">No admissions right now</h1>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
        The next admission session hasn't been announced yet. Please check back later. Classes and opening
        dates will appear here as soon as the school publishes them.
      </p>
    </section>
  );
}
