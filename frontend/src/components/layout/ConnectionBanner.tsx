import { useClasses } from '../../hooks/useAdmissions';
import { Icon } from '@/components/ui/icon';

/** Shown while the API is unreachable; polling continues and it disappears on recovery. */
export function ConnectionBanner() {
  const { isError, data } = useClasses();
  if (!isError) return null;

  return (
    <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
      <Icon name="offline" className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Server offline — retrying automatically.
        {data && ' Showing the last known seat counts.'}
      </span>
    </div>
  );
}
