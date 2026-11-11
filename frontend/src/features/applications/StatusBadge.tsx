import { Badge, type Tone } from '@/components/ui/badge';
import type { HoldStatus } from '../../lib/types';

const config: Record<HoldStatus, { tone: Tone; label: string }> = {
  WAITLISTED: { tone: 'info', label: 'On waitlist' },
  HELD: { tone: 'warning', label: 'Held · awaiting payment' },
  CONFIRMED: { tone: 'success', label: 'Confirmed' },
  EXPIRED: { tone: 'neutral', label: 'Expired' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
};

export function StatusBadge({ status, position }: { status: HoldStatus; position?: number | null }) {
  const { tone, label } = config[status];
  return <Badge tone={tone}>{position ? `${label} · #${position}` : label}</Badge>;
}
