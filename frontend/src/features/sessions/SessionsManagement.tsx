import { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Archive,
  Clock,
  Play,
  AlertTriangle,
  Users,
  Layers,
  Info,
  Calendar,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSessions,
  useCreateSession,
  useArchiveSession,
  useActivateSession,
  useSeedDatabase,
} from '../../hooks/useAdmissions';
import { useAppStore } from '../../store/useAppStore';
import { formatFutureCountdown, pluralize } from '../../lib/format';
import type { AcademicSessionDetail, SessionStatus } from '../../lib/types';

export function SessionsManagement() {
  const { data: sessions, isLoading } = useSessions();
  const createSession = useCreateSession();
  const archiveSession = useArchiveSession();
  const activateSession = useActivateSession();
  const seedDatabase = useSeedDatabase();
  const setTab = useAppStore((s) => s.setTab);

  // Modal & Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AcademicSessionDetail | null>(null);
  const [activateTarget, setActivateTarget] = useState<AcademicSessionDetail | null>(null);

  // Form State
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear() + 1);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formStatus, setFormStatus] = useState<SessionStatus>('UPCOMING');
  const [formStartsAt, setFormStartsAt] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Countdown timer trigger
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeSession = sessions?.find((s) => s.status === 'ACTIVE');
  const upcomingSessions = sessions?.filter((s) => s.status === 'UPCOMING') ?? [];
  const archivedSessions = sessions?.filter((s) => s.status === 'ARCHIVED') ?? [];

  const handleOpenCreate = () => {
    const maxYear = sessions?.length ? Math.max(...sessions.map((s) => s.academicYear)) : new Date().getFullYear();
    const nextYear = Math.max(maxYear + 1, new Date().getFullYear());
    setFormYear(nextYear);
    setFormTitle(`Academic Session ${nextYear}–${nextYear + 1}`);
    setFormStatus('UPCOMING');

    // Default startsAt to tomorrow at 09:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFormStartsAt(localIso);
    setFormNotes('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleYearChange = (year: number) => {
    setFormYear(year);
    if (!formTitle || formTitle.startsWith('Academic Session')) {
      setFormTitle(`Academic Session ${year}–${year + 1}`);
    }
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formYear < 2000 || formYear > 2100) {
      setFormError('Academic year must be between 2000 and 2100.');
      return;
    }

    if (sessions?.some((s) => s.academicYear === formYear)) {
      setFormError(`An academic session for year ${formYear} already exists.`);
      return;
    }

    let startsAtIso: string | null = null;
    if (formStatus === 'UPCOMING') {
      if (!formStartsAt) {
        setFormError('Start date and time is required for an Upcoming session.');
        return;
      }
      const parsedDate = new Date(formStartsAt);
      if (isNaN(parsedDate.getTime())) {
        setFormError('Please enter a valid start date and time.');
        return;
      }
      if (parsedDate.getTime() <= Date.now()) {
        setFormError('Upcoming session start time must be in the future.');
        return;
      }
      startsAtIso = parsedDate.toISOString();
    }

    try {
      await createSession.mutateAsync({
        academicYear: formYear,
        title: formTitle.trim() || `Academic Session ${formYear}–${formYear + 1}`,
        status: formStatus,
        startsAt: startsAtIso,
        notes: formNotes.trim() || null,
      });
      setIsCreateOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create academic session.');
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveSession.mutateAsync(archiveTarget.academicYear);
      setArchiveTarget(null);
    } catch {
      // toast shown by hook
    }
  };

  const handleConfirmActivate = async () => {
    if (!activateTarget) return;
    try {
      await activateSession.mutateAsync(activateTarget.academicYear);
      setActivateTarget(null);
    } catch {
      // toast shown by hook
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/25">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Admission Sessions</h1>
              <p className="text-xs text-slate-400">
                Control active admissions, schedule upcoming cycles with exact start times, and archive historical cohorts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (window.confirm("Seed database with 3 full sessions (Archived 2025, Active 2026, Upcoming 2027) and 300 realistic student records?")) {
                seedDatabase.mutate();
              }
            }}
            disabled={seedDatabase.isPending}
            className="gap-2 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border-sky-800/60"
          >
            <Database className="size-3.5" />
            <span>{seedDatabase.isPending ? 'Seeding...' : 'Seed 3 Sessions & 300 Students'}</span>
          </Button>

          <Button
            type="button"
            onClick={handleOpenCreate}
            className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm text-xs"
          >
            <Plus className="size-4" />
            <span>New Session</span>
          </Button>
        </div>
      </div>

      {/* 1. CURRENT ACTIVE SESSION HERO */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Current Admission Cycle
          </h2>
          {activeSession && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              Accepting Applications
            </span>
          )}
        </div>

        {activeSession ? (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-slate-900/80 to-slate-900 p-6 shadow-lg shadow-emerald-950/10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2 max-w-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success" className="px-2.5 py-0.5 text-xs font-semibold">
                    ACTIVE
                  </Badge>
                  <span className="text-xs text-slate-400">
                    Created on {new Date(activeSession.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {activeSession.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeSession.notes ||
                    'Students can currently apply for available classes in this session. One active seat hold per student.'}
                </p>

                {/* Key Metrics Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Classes</p>
                    <p className="mt-1 text-lg font-bold text-white">{activeSession.classCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Capacity</p>
                    <p className="mt-1 text-lg font-bold text-sky-400">{pluralize(activeSession.totalCapacity, 'seat')}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-3">
                    <p className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider">Admitted Students</p>
                    <p className="mt-1 text-lg font-bold text-emerald-400">{pluralize(activeSession.confirmedCount, 'student')}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Holds & Waitlist</p>
                    <p className="mt-1 text-lg font-bold text-amber-400">
                      {activeSession.heldCount} held / {activeSession.waitlistCount} queued
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 justify-center"
                  onClick={() => setTab('admin-classes')}
                >
                  <Layers className="size-4" />
                  <span>Manage Classes</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 justify-center"
                  onClick={() => setTab('admin-ledger')}
                >
                  <Users className="size-4" />
                  <span>View Student Ledger</span>
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="gap-2 justify-center"
                  onClick={() => setArchiveTarget(activeSession)}
                >
                  <Archive className="size-4" />
                  <span>Archive Session</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <AlertTriangle className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No Active Admission Session</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Admissions are currently paused across the school. The public class catalog is hidden until an active session is established.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="gap-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs"
            >
              <Plus className="size-3.5" />
              <span>Create Active Session</span>
            </Button>
          </div>
        )}
      </section>

      {/* 2. UPCOMING ADMISSION SESSIONS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-sky-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Upcoming Admission Cycles ({upcomingSessions.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">Auto-starts at scheduled exact time</span>
        </div>

        {upcomingSessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-center">
            <p className="text-xs text-slate-500">
              No upcoming sessions scheduled. Create one to set a future launch date & time.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingSessions.map((session) => {
              const countdown = formatFutureCountdown(session.startsAt);
              const startsAtDate = session.startsAt ? new Date(session.startsAt) : null;

              return (
                <div
                  key={session.academicYear}
                  className="rounded-2xl border border-sky-500/20 bg-slate-900/60 p-5 space-y-4 hover:border-sky-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="info" className="px-2 py-0.5 text-[11px] font-semibold">
                          UPCOMING
                        </Badge>
                        <span className="text-xs font-semibold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
                          Starts in {countdown}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white pt-1">{session.title}</h3>
                      <p className="text-xs text-slate-400">Academic Year {session.academicYear}</p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Capacity</p>
                      <p className="text-xs font-semibold text-white">
                        {session.classCount} classes • {session.totalCapacity} seats
                      </p>
                    </div>
                  </div>

                  {/* Scheduled Exact Datetime Box */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-500" />
                        Exact Start Date & Time
                      </span>
                      <span className="font-medium text-slate-200">
                        {startsAtDate ? startsAtDate.toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }) : 'Unspecified'}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/50 italic">
                        “{session.notes}”
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => setArchiveTarget(session)}
                    >
                      <Archive className="size-3.5" />
                      <span>Cancel / Archive</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => setActivateTarget(session)}
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>Activate Immediately</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. HISTORICAL & ARCHIVED SESSIONS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="size-4 text-slate-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Historical & Archived Sessions ({archivedSessions.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Admissions closed • Only confirmed students retained
          </span>
        </div>

        {archivedSessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-center">
            <p className="text-xs text-slate-500">No archived sessions.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
            <div className="divide-y divide-slate-800/80">
              {archivedSessions.map((session) => (
                <div
                  key={session.academicYear}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-850/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">{session.title}</h4>
                      <Badge tone="neutral" className="text-[10px]">
                        ARCHIVED
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Cohort {session.academicYear}–{session.academicYear + 1}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {session.classCount} classes • {pluralize(session.confirmedCount, 'admitted student')} permanently preserved.
                      {session.archivedAt && (
                        <span className="text-slate-500 ml-1">
                          (Archived {new Date(session.archivedAt).toLocaleDateString()})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => setTab('admin-ledger')}
                    >
                      <Users className="size-3.5" />
                      <span>View Confirmed Ledger</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5 text-sky-400 hover:text-sky-300"
                      onClick={() => setActivateTarget(session)}
                    >
                      <Play className="size-3.5" />
                      <span>Re-activate</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CREATE SESSION MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">Create Academic Session</h3>
                <p className="text-xs text-slate-400">
                  Configure an upcoming admission cycle or activate immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Academic Year <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="number"
                    min={2000}
                    max={2100}
                    value={formYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    required
                  />
                  <p className="text-[10px] text-slate-500">e.g. 2027</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Initial Status <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as SessionStatus)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="UPCOMING">Upcoming (Scheduled)</option>
                    <option value="ACTIVE">Active (Start Now)</option>
                    <option value="ARCHIVED">Archived (Historical Record)</option>
                  </select>
                  <p className="text-[10px] text-slate-500">Upcoming is recommended</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Session Title <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Academic Session 2027–2028"
                  required
                />
              </div>

              {formStatus === 'UPCOMING' && (
                <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                    <Clock className="size-3.5" />
                    <span>Exact Start Date & Time</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    required
                    className="bg-slate-950"
                  />
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Student applications will be strictly blocked until this exact local timestamp. At that moment, admissions will open automatically.
                  </p>
                </div>
              )}

              {formStatus === 'ACTIVE' && (
                <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-start gap-2">
                  <Info className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    Setting this session as <strong>ACTIVE</strong> immediately will automatically transition any currently active session to <strong>ARCHIVED</strong> and prune its unconfirmed seat holds.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Announcements / Notes (Optional)
                </label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Grade 1 to 5 admissions open. Birth certificates required."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createSession.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createSession.isPending}
                  className="bg-sky-600 hover:bg-sky-500 text-white"
                >
                  {createSession.isPending ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border border-rose-900/40 bg-slate-900 p-6 shadow-2xl space-y-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/25">
                <Archive className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Archive Admission Session?</h3>
                <p className="text-xs text-slate-400">{archiveTarget.title}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-400" />
                This action stops taking student applications:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>Admissions will be marked historical and closed immediately.</li>
                <li>All unconfirmed seat holds and waitlist entries will be safely pruned.</li>
                <li>
                  <strong className="text-emerald-400">{archiveTarget.confirmedCount} confirmed student record(s)</strong> will be permanently preserved in the historical cohort ledger.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setArchiveTarget(null)}
                disabled={archiveSession.isPending}
              >
                Keep Active
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmArchive}
                disabled={archiveSession.isPending}
              >
                {archiveSession.isPending ? 'Archiving...' : 'Confirm & Archive Session'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATE CONFIRMATION MODAL */}
      {activateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border border-sky-900/40 bg-slate-900 p-6 shadow-2xl space-y-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/25">
                <Play className="size-5 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Activate Admission Session?</h3>
                <p className="text-xs text-slate-400">{activateTarget.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Activating <strong>{activateTarget.title}</strong> will immediately open public applications for its classes. If another session is currently active, it will be automatically archived and closed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActivateTarget(null)}
                disabled={activateSession.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleConfirmActivate}
                disabled={activateSession.isPending}
              >
                {activateSession.isPending ? 'Activating...' : 'Activate Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
