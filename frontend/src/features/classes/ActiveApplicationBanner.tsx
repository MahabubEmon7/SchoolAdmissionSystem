import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { StudentHold } from '../../lib/types';

const describe: Record<string, string> = {
  HELD: 'has an active seat held for you',
  CONFIRMED: 'is officially confirmed and enrolled',
  WAITLISTED: 'has you on the waiting list',
};

/** "One class per student": explains why other classes can't be applied to. */
export function ActiveApplicationBanner({ application, onView }: { application: StudentHold; onView: () => void }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
      <Icon name="check" className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs sm:text-sm text-slate-300">
        <strong className="font-semibold text-white">{application.className}</strong> {describe[application.status]}. Each
        student may hold one active application at a time.
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={onView} className="text-xs">
        View Application
      </Button>
    </div>
  );
}
