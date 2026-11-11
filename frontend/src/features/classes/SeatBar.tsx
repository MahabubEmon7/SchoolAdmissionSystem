import type { SchoolClass } from '../../lib/types';

/** Stacked bar: confirmed (green) + held (amber) out of total seats. */
export function SeatBar({ seats }: { seats: SchoolClass }) {
  const pct = (n: number) => (seats.totalSeats > 0 ? (n / seats.totalSeats) * 100 : 0);

  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-slate-800"
      role="img"
      aria-label={`${seats.confirmedSeats} confirmed, ${seats.heldSeats} held, ${seats.availableSeats} available of ${seats.totalSeats}`}
    >
      <div className="bg-emerald-500 transition-[width] duration-500 ease-out" style={{ width: `${pct(seats.confirmedSeats)}%` }} />
      <div className="bg-amber-400 transition-[width] duration-500 ease-out" style={{ width: `${pct(seats.heldSeats)}%` }} />
    </div>
  );
}
