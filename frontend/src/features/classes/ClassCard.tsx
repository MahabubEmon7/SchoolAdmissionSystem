import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SchoolClass } from '../../lib/types';
import type { ApplyState } from './applyState';
import { formatRemainingSeats, pluralize, cn } from '../../lib/format';
import { SeatBar } from './SeatBar';
import { SeatStats } from './SeatStats';

interface ClassCardProps {
  seats: SchoolClass;
  state: ApplyState;
  busy: boolean;
  onAction: () => void;
  isUpcoming?: boolean;
}

function AvailabilityBadge({ seats, isUpcoming }: { seats: SchoolClass; isUpcoming?: boolean }) {
  if (isUpcoming) {
    return <Badge tone="info">Upcoming Cycle</Badge>;
  }
  if (seats.availableSeats > 0) {
    if (seats.availableSeats === 1) {
      return <Badge tone="warning">1 Seat Left</Badge>;
    }
    return seats.availableSeats <= Math.ceil(seats.totalSeats * 0.1) ? (
      <Badge tone="warning">Few Left</Badge>
    ) : (
      <Badge tone="success">Open</Badge>
    );
  }
  return seats.heldSeats > 0 ? (
    <Badge tone="info">Waitlist Open</Badge>
  ) : (
    <Badge tone="danger">Full</Badge>
  );
}

export function ClassCard({ seats, state, busy, onAction, isUpcoming }: ClassCardProps) {
  const isPrimary = state.action === 'apply' || state.action === 'waitlist';

  return (
    <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition-colors duration-150">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold leading-snug text-white text-base text-balance">
              {seats.name}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Grade {seats.grade} • {seats.shift === 'MORNING' ? 'Morning' : 'Day'} Shift • Session {seats.academicYear}–{seats.academicYear + 1}
            </p>
          </div>
          <AvailabilityBadge seats={seats} isUpcoming={isUpcoming} />
        </div>

        {/* Prominent Remaining Seats Indicator */}
        <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">
          <span className="text-xs text-slate-400">Available</span>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              seats.availableSeats > 0 ? 'text-emerald-400' : 'text-slate-400',
            )}
          >
            {formatRemainingSeats(seats.availableSeats)}
          </span>
        </div>

        <div className="space-y-1.5">
          <SeatBar seats={seats} />
          {seats.waitlistCount > 0 && (
            <p className="text-xs text-sky-300">
              <span className="font-semibold tabular-nums">
                {pluralize(seats.waitlistCount, 'applicant', 'applicants')}
              </span>{' '}
              on the waitlist
            </p>
          )}
        </div>

        <SeatStats seats={seats} />
      </div>

      <div className="mt-5 space-y-2 pt-2 border-t border-slate-800/60">
        <Button
          type="button"
          className="w-full"
          variant={isPrimary ? 'default' : 'secondary'}
          disabled={!state.action}
          loading={busy}
          onClick={onAction}
        >
          {state.label}
        </Button>
        {state.hint && (
          <p className="text-center text-[11px] leading-relaxed text-slate-400">{state.hint}</p>
        )}
      </div>
    </Card>
  );
}
