import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SchoolClass } from '../../lib/types';
import { SeatBar } from '../classes/SeatBar';

const columns = ['Class & Shift', 'Occupancy', 'Total', 'Enrolled', 'Held', 'Available', 'Waitlist'];

/** Polished table of every class's live seat counts. */
export function SeatOverview({ classes }: { classes: SchoolClass[] }) {
  if (classes.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-8 text-center text-sm text-slate-400">
        <p className="font-medium text-slate-300">No classes created yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Use the creation form to add Class 1 to 12 with shifts.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0 border-slate-800 bg-slate-900/70 shadow-md">
      <table className="w-full min-w-[42rem] text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/40 text-left text-[11px] uppercase tracking-wider text-slate-400">
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={
                  i === 0
                    ? 'px-5 py-3 font-semibold'
                    : i === 1
                      ? 'px-3 py-3 font-semibold'
                      : 'px-3 py-3 text-right font-semibold'
                }
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {classes.map((c) => {
            const occupied = c.confirmedSeats + c.heldSeats;
            const pct = c.totalSeats > 0 ? Math.round((occupied / c.totalSeats) * 100) : 0;

            return (
              <tr key={c.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{c.name}</span>
                    <Badge
                      tone={
                        c.shift === 'MORNING'
                          ? 'info'
                          : c.shift === 'DAY'
                            ? 'warning'
                            : 'neutral'
                      }
                      className="text-[10px]"
                    >
                      {c.shift ?? 'NO SHIFT'}
                    </Badge>
                  </div>
                </td>
                <td className="px-3 py-3 min-w-[140px]">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {occupied} / {c.totalSeats} ({pct}%)
                    </span>
                    <SeatBar seats={c} />
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-white">
                  {c.totalSeats}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-400">
                  {c.confirmedSeats}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-400">
                  {c.heldSeats}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-sky-400">
                  {c.availableSeats}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  <span className={c.waitlistCount > 0 ? 'text-rose-400' : 'text-slate-500'}>
                    {c.waitlistCount}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
