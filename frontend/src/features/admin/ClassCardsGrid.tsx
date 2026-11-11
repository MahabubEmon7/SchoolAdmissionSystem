import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Pencil, Trash2 } from 'lucide-react';
import { useDeleteClass, useSessions } from '../../hooks/useAdmissions';
import type { SchoolClass } from '../../lib/types';
import { pluralize } from '../../lib/format';
import { SeatBar } from '../classes/SeatBar';
import { EditClassSeatsDialog } from './EditClassSeatsDialog';

interface ClassCardsGridProps {
  classes: SchoolClass[];
  onSelectClass?: (classId: string) => void;
}

export function ClassCardsGrid({ classes, onSelectClass }: ClassCardsGridProps) {
  const { data: sessionsList } = useSessions();
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'MORNING' | 'DAY'>('ALL');
  const [search, setSearch] = useState('');
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [classToEdit, setClassToEdit] = useState<SchoolClass | null>(null);
  const deleteClassMutation = useDeleteClass();

  const filtered = classes.filter((c) => {
    if (shiftFilter === 'MORNING' && c.shift !== 'MORNING') return false;
    if (shiftFilter === 'DAY' && c.shift !== 'DAY') return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return c.name.toLowerCase().includes(q) || String(c.grade).includes(q);
    }
    return true;
  });

  const confirmDelete = () => {
    if (!classToDelete) return;
    deleteClassMutation.mutate(classToDelete.id, {
      onSettled: () => setClassToDelete(null),
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Shift Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'ALL', label: 'All Classes' },
              { id: 'MORNING', label: 'Morning Shift' },
              { id: 'DAY', label: 'Day Shift' },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={shiftFilter === tab.id ? 'default' : 'outline'}
              size="sm"
              className="text-xs whitespace-nowrap"
              onClick={() => setShiftFilter(tab.id)}
            >
              {tab.label}
              {tab.id !== 'ALL' && (
                <span className="ml-1.5 opacity-70">
                  ({classes.filter((c) => c.shift === tab.id).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <label htmlFor="class-search" className="sr-only">
            Search class or grade
          </label>
          <input
            id="class-search"
            name="classSearch"
            type="text"
            autoComplete="off"
            placeholder="Search class or grade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-sm font-medium text-slate-300">No matching classes found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your shift filter or search keyword.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const occupied = c.confirmedSeats + c.heldSeats;
            const pct = c.totalSeats > 0 ? Math.round((occupied / c.totalSeats) * 100) : 0;

            return (
              <Card
                key={c.id}
                className="border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-colors duration-150 shadow-md flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="pb-3">
                    {(() => {
                      const session = sessionsList?.find((s) => s.academicYear === c.academicYear);
                      const sessionStatus = session?.status ?? (c.academicYear === 2026 ? 'ACTIVE' : c.academicYear > 2026 ? 'UPCOMING' : 'ARCHIVED');

                      return (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base font-semibold text-white truncate">
                              {c.name}
                            </CardTitle>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Grade {c.grade} • {c.shift === 'MORNING' ? 'Morning Shift' : 'Day Shift'} • Cohort {c.academicYear}–{c.academicYear + 1}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            <Badge
                              tone={sessionStatus === 'ACTIVE' ? 'success' : sessionStatus === 'UPCOMING' ? 'info' : 'neutral'}
                              className="text-[10px] font-semibold px-2 py-0.5"
                            >
                              {sessionStatus === 'UPCOMING'
                                ? `Upcoming ${c.academicYear}`
                                : sessionStatus === 'ACTIVE'
                                ? `Active ${c.academicYear}`
                                : `Archived ${c.academicYear}`}
                            </Badge>
                            <Badge
                              tone={c.shift === 'MORNING' ? 'info' : 'warning'}
                              className="text-[10px] font-medium px-2 py-0.5"
                            >
                              {c.shift === 'MORNING' ? 'Morning' : 'Day'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })()}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Visual Occupancy Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Occupancy</span>
                        <span className="font-medium text-slate-200 tabular-nums">
                          <strong className="text-white font-semibold">{occupied}</strong> / {c.totalSeats} seats{' '}
                          <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <SeatBar seats={c} />
                    </div>

                    {/* Clean 2x2 Metric Breakdown */}
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between rounded-lg bg-slate-950/50 px-2.5 py-1.5 border border-slate-800/60">
                        <dt className="flex items-center gap-1.5 text-slate-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          Enrolled
                        </dt>
                        <dd className="font-semibold text-emerald-400 tabular-nums">
                          {pluralize(c.confirmedSeats, 'seat', 'seats')}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-950/50 px-2.5 py-1.5 border border-slate-800/60">
                        <dt className="flex items-center gap-1.5 text-slate-400">
                          <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                          Held
                        </dt>
                        <dd className="font-semibold text-amber-400 tabular-nums">
                          {pluralize(c.heldSeats, 'seat', 'seats')}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-950/50 px-2.5 py-1.5 border border-slate-800/60">
                        <dt className="flex items-center gap-1.5 text-slate-400">
                          <span className="size-1.5 rounded-full bg-sky-400" aria-hidden="true" />
                          Available
                        </dt>
                        <dd className="font-semibold text-sky-400 tabular-nums">
                          {pluralize(c.availableSeats, 'seat', 'seats')}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-950/50 px-2.5 py-1.5 border border-slate-800/60">
                        <dt className="flex items-center gap-1.5 text-slate-400">
                          <span className="size-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                          Waitlist
                        </dt>
                        <dd className={c.waitlistCount > 0 ? 'font-semibold text-rose-400 tabular-nums' : 'font-semibold text-slate-400 tabular-nums'}>
                          {pluralize(c.waitlistCount, 'waiting', 'waiting')}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </div>

                {/* Footer Controls */}
                <div className="border-t border-slate-800/80 p-2.5 sm:p-3 bg-slate-950/30 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {onSelectClass && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-2 sm:px-2.5"
                        onClick={() => onSelectClass(c.id)}
                      >
                        <Icon name="id" className="size-3.5 mr-1" aria-hidden="true" /> View
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-2 sm:px-2.5 text-sky-300 hover:text-sky-200 hover:bg-sky-500/10 hover:border-sky-500/30"
                      onClick={() => setClassToEdit(c)}
                    >
                      <Pencil className="size-3.5 mr-1" aria-hidden="true" /> Edit Seats
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-2 sm:px-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 ml-auto shrink-0"
                    onClick={() => setClassToDelete(c)}
                  >
                    <Trash2 className="size-3.5 mr-1" aria-hidden="true" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Class Capacity Dialog */}
      <EditClassSeatsDialog
        schoolClass={classToEdit}
        open={Boolean(classToEdit)}
        onOpenChange={(open) => !open && setClassToEdit(null)}
      />

      {/* Accessible Delete Class Dialog */}
      <Dialog open={Boolean(classToDelete)} onOpenChange={(open: boolean) => !open && setClassToDelete(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white">Delete Class</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              This action permanently removes the class from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3 text-sm text-slate-300">
            <p>
              Are you sure you want to delete <strong className="text-white">{classToDelete?.name}</strong>?
            </p>
            <p className="text-xs text-rose-400">
              This will permanently remove this class along with all associated seat holds and waitlist records.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setClassToDelete(null)}
              disabled={deleteClassMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteClassMutation.isPending}
              onClick={confirmDelete}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
