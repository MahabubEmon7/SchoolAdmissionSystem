import { Icon } from '@/components/ui/icon';

/** Explains what happens while a student waits for a seat. */
export function WaitlistNotice({ position }: { position: number | null }) {
  return (
    <div className="flex gap-3 rounded-lg bg-sky-500/10 px-3 py-2.5 text-sm text-sky-200">
      <Icon name="clock" className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        {position === 1 ? "You're next in line." : `You're #${position ?? '–'} in line.`} If a student doesn't pay in
        time, their seat is held for you automatically and your payment timer starts. Keep this page open or check
        back.
      </p>
    </div>
  );
}
