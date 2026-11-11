import type { ReactNode } from 'react';
import { Card } from './card';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-4 rounded-full bg-slate-800 p-3 text-slate-400">{icon}</div>}
      <h3 className="font-medium text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
