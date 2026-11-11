import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyHolds } from '../../hooks/useAdmissions';
import { useStudentId } from '../../hooks/useStudentId';
import { friendlyError } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import { ApplicationCard } from './ApplicationCard';

export function MyApplications() {
  const { isValid } = useStudentId();
  const holds = useMyHolds();
  const setTab = useAppStore((s) => s.setTab);

  const header = (
    <SectionHeader
      title="My Applications"
      description="You can apply to one class at a time. Pay the fee before the countdown ends to confirm your seat."
    />
  );

  let body;
  if (!isValid) {
    body = (
      <EmptyState
        icon={<Icon name="id" aria-hidden="true" />}
        title="Enter your Birth Registration Number"
        description="Type your 17-digit student ID in the header to view and manage your applications."
      />
    );
  } else if (holds.isPending) {
    body = (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl border border-slate-800 bg-slate-900/50" />
        ))}
      </div>
    );
  } else if (holds.isError && !holds.data) {
    body = (
      <EmptyState
        icon={<Icon name="offline" aria-hidden="true" />}
        title="Could not load applications"
        description={friendlyError(holds.error)}
        action={
          <Button type="button" variant="secondary" onClick={() => holds.refetch()}>
            Try Again
          </Button>
        }
      />
    );
  } else if (holds.data.length === 0) {
    body = (
      <EmptyState
        icon={<Icon name="inbox" aria-hidden="true" />}
        title="No applications yet"
        description="Browse available classes and select a class to hold your seat."
        action={
          <Button type="button" variant="default" onClick={() => setTab('classes')}>
            Browse Available Classes
          </Button>
        }
      />
    );
  } else {
    body = (
      <div className="grid gap-4 md:grid-cols-2">
        {holds.data.map((hold) => (
          <ApplicationCard key={hold.holdId} hold={hold} />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {header}
      {body}
    </section>
  );
}
