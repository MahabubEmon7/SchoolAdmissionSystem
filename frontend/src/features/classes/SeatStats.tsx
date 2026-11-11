import { cn, pluralize } from '../../lib/format';
import type { SchoolClass } from '../../lib/types';

const stats = [
  { key: 'totalSeats', label: 'Total', dot: 'bg-slate-500' },
  { key: 'availableSeats', label: 'Available', dot: 'bg-slate-200' },
  { key: 'heldSeats', label: 'Held', dot: 'bg-amber-400' },
  { key: 'confirmedSeats', label: 'Confirmed', dot: 'bg-emerald-500' },
] as const;

export function SeatStats({ seats }: { seats: SchoolClass }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {stats.map(({ key, label, dot }) => {
        const count = seats[key];
        return (
          <div key={key} className="flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-xs font-semibold text-white tabular-nums">
              {pluralize(count, 'seat', 'seats')}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
