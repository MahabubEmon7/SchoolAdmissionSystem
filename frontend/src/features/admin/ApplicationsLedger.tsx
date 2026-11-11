import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Archive, History } from 'lucide-react';
import { useAdminApplications, useArchivePastYears, useSessions } from '../../hooks/useAdmissions';
import { CURRENT_ACADEMIC_YEAR, type HoldStatus, type SchoolClass } from '../../lib/types';
import { formatCountdown, secondsUntil } from '../../lib/format';

interface ApplicationsLedgerProps {
  classes: SchoolClass[];
  selectedClassId?: string;
  onClearSelectedClass?: () => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Statuses' },
  { value: 'CONFIRMED', label: 'Confirmed (Enrolled)' },
  { value: 'HELD', label: 'Held (Pending Payment)' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function statusTone(status: HoldStatus): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'HELD':
      return 'warning';
    case 'WAITLISTED':
      return 'danger';
    case 'EXPIRED':
    case 'CANCELLED':
    default:
      return 'neutral';
  }
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const shortTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short',
});

export function ApplicationsLedger({
  classes,
  selectedClassId,
  onClearSelectedClass,
}: ApplicationsLedgerProps) {
  const [yearFilter, setYearFilter] = useState('');
  const [classFilter, setClassFilter] = useState(selectedClassId ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: sessionsList } = useSessions();
  const archivePast = useArchivePastYears();

  const activeClassId = selectedClassId !== undefined ? selectedClassId : classFilter;
  const parsedYear = yearFilter ? Number(yearFilter) : undefined;

  const { data: applications = [], isLoading, refetch } = useAdminApplications({
    year: parsedYear,
    classId: activeClassId || undefined,
    status: statusFilter || undefined,
    search: search.trim() || undefined,
  });

  const handleClassChange = (newClassId: string) => {
    setClassFilter(newClassId);
    if (onClearSelectedClass && newClassId === '') {
      onClearSelectedClass();
    }
  };

  const handleClearFilters = () => {
    setYearFilter('');
    setClassFilter('');
    setStatusFilter('');
    setSearch('');
    if (onClearSelectedClass) onClearSelectedClass();
  };

  const isViewingPastYear = parsedYear !== undefined && parsedYear < CURRENT_ACADEMIC_YEAR;

  const handleArchive = () => {
    if (
      window.confirm(
        'Archive previous years? This will retain ONLY confirmed/admitted student records for all past years and remove expired, waitlisted, or cancelled holds.',
      )
    ) {
      archivePast.mutate(CURRENT_ACADEMIC_YEAR);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/70 shadow-lg">
      <CardHeader className="pb-3 border-b border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-white">
                Student Applications & Queue Ledger
              </CardTitle>
              <Badge tone="neutral" className="text-[11px] tabular-nums">
                {applications.length} Records
              </Badge>
              {parsedYear && (
                <Badge tone="info" className="text-[11px]">
                  Session {parsedYear}–{parsedYear + 1}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Real-time audit log of student admissions, basic info, payment deadlines, and queue order
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleArchive}
              loading={archivePast.isPending}
              className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              title="Prune unconfirmed records from past academic sessions"
            >
              <Archive className="size-3.5 mr-1" />
              Archive Past Years
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Historical Archive Policy Banner */}
        {isViewingPastYear && (
          <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-300 flex items-center gap-2">
            <History className="size-4 shrink-0 text-sky-400" />
            <span>
              <strong>Historical Session Archive:</strong> In past academic years, only officially admitted (CONFIRMED) student records are preserved.
            </span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
          <Select
            label="Filter by Academic Year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            options={[
              { value: '', label: 'All Academic Years' },
              ...(sessionsList && sessionsList.length > 0
                ? sessionsList.map((s) => ({
                    value: String(s.academicYear),
                    label: `${s.title} (${s.status})`,
                  }))
                : [
                    { value: '2026', label: 'Academic Session 2026–2027 (ACTIVE)' },
                    { value: '2025', label: 'Academic Session 2025–2026 (ARCHIVED)' },
                  ]),
            ]}
          />
          <Select
            label="Filter by Class"
            value={activeClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            options={[
              { value: '', label: 'All Classes' },
              ...classes.map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear})` })),
            ]}
          />
          <Select
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_OPTIONS}
          />
          <div>
            <label htmlFor="student-search" className="mb-1.5 block text-sm font-medium text-slate-300">
              Search Student (ID or Name)
            </label>
            <input
              id="student-search"
              name="studentSearch"
              type="text"
              autoComplete="off"
              placeholder="e.g. Walter or 1234…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
            />
          </div>
        </div>

        {(yearFilter || activeClassId || statusFilter || search) && (
          <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
            <span>Filtered view active.</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-sky-400 hover:text-sky-300 underline font-medium"
            >
              Reset filters
            </button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading applications…</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-300">No applications match the criteria</p>
            <p className="text-xs text-slate-500 mt-1">
              Applications submitted by students will appear in this ledger in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[760px]">
              <thead className="bg-slate-950/50 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Student & Basic Info</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Session</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Class & Shift</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Queue / Waitlist</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Timeline & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-normal text-slate-300">
                {applications.map((app) => {
                  const now = Date.now();
                  const isExpiring =
                    app.status === 'HELD' &&
                    app.expiresAt &&
                    Date.parse(app.expiresAt) > now;

                  return (
                    <tr key={app.holdId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {app.studentName && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white text-xs">{app.studentName}</span>
                              {app.age && (
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                                  {app.age} yrs
                                </span>
                              )}
                            </div>
                          )}
                          <span className="font-mono text-[11px] text-slate-400 tracking-wider">
                            ID: {app.studentId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="neutral" className="text-[11px]">
                          {app.academicYear}–{app.academicYear + 1}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-200 block">{app.className}</span>
                        <span className="text-[11px] text-slate-500">
                          Grade {app.grade} {app.shift ? `• ${app.shift}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(app.status)} className="text-xs">
                          {app.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {app.status === 'WAITLISTED' ? (
                          <div className="text-xs">
                            <span className="font-semibold text-rose-400">
                              Position #{app.waitlistPosition ?? '?'}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Queue #{app.queueNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 tabular-nums">
                            Queue #{app.queueNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isExpiring && app.expiresAt ? (
                          <div className="text-amber-400 font-medium">
                            Holds seat: {formatCountdown(secondsUntil(app.expiresAt, now))} left
                          </div>
                        ) : app.status === 'CONFIRMED' && app.confirmedAt ? (
                          <div className="text-emerald-400 font-medium">
                            Confirmed on {dateFormatter.format(new Date(app.confirmedAt))}
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            Created {shortTimeFormatter.format(new Date(app.createdAt))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
