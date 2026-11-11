import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminStats } from '../../lib/types';

interface AdminKpisProps {
  stats?: AdminStats;
  isLoading?: boolean;
}

export function AdminKpis({ stats, isLoading }: AdminKpisProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse h-24 border-slate-800 bg-slate-900/60 p-4" />
        ))}
      </div>
    );
  }

  const items = [
    {
      title: 'Total Capacity',
      value: stats.totalCapacity.toLocaleString(),
      subtext: `${stats.classCount} ${stats.classCount === 1 ? 'class' : 'classes'} total`,
      badge: 'All Classes',
      tone: 'neutral' as const,
      border: 'hover:border-slate-700',
    },
    {
      title: 'Confirmed',
      value: stats.totalConfirmed.toLocaleString(),
      subtext: `${stats.occupancyRate}% of capacity`,
      badge: 'Enrolled',
      tone: 'success' as const,
      border: 'hover:border-emerald-500/40',
    },
    {
      title: 'Active Holds',
      value: stats.totalHeld.toLocaleString(),
      subtext: 'Payment pending',
      badge: stats.totalHeld > 0 ? 'Expiring' : 'None',
      tone: 'warning' as const,
      border: 'hover:border-amber-500/40',
    },
    {
      title: 'Available Seats',
      value: stats.totalAvailable.toLocaleString(),
      subtext: 'Open for apply',
      badge: 'Vacant',
      tone: 'info' as const,
      border: 'hover:border-sky-500/40',
    },
    {
      title: 'Waitlist',
      value: stats.totalWaitlist.toLocaleString(),
      subtext: 'Students in queue',
      badge: stats.totalWaitlist > 0 ? 'Queued' : 'Empty',
      tone: (stats.totalWaitlist > 0 ? 'danger' : 'neutral') as 'danger' | 'neutral',
      border: 'hover:border-rose-500/40',
    },
    {
      title: 'Occupancy Rate',
      value: `${stats.occupancyRate}%`,
      subtext: `${stats.totalConfirmed + stats.totalHeld} / ${stats.totalCapacity}`,
      badge: stats.occupancyRate >= 90 ? 'High' : stats.occupancyRate >= 50 ? 'Moderate' : 'Low',
      tone: (stats.occupancyRate >= 90 ? 'warning' : 'info') as 'warning' | 'info',
      border: 'hover:border-purple-500/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <Card
          key={item.title}
          className={`flex flex-col justify-between border-slate-800 bg-slate-900/60 p-4 transition-colors duration-150 shadow-sm ${item.border}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {item.title}
            </span>
            <Badge tone={item.tone} className="text-[10px] px-1.5 py-0">
              {item.badge}
            </Badge>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-white tabular-nums">
              {item.value}
            </span>
            <p className="mt-0.5 text-[11px] text-slate-400 truncate">{item.subtext}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

