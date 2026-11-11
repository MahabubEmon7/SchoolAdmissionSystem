import { Icon } from '@/components/ui/icon';
import { cn, formatCountdown } from '../../lib/format';

/** Time left on a hold; turns red in the final minute. */
export function Countdown({ secondsLeft }: { secondsLeft: number }) {
  const urgent = secondsLeft <= 60;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        urgent ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-200',
      )}
      role="timer"
      aria-live="off"
    >
      <Icon name="clock" className="size-4" aria-hidden="true" />
      <span>Pay within</span>
      <span className="ml-auto font-mono text-base font-semibold tabular-nums">{formatCountdown(secondsLeft)}</span>
    </div>
  );
}
