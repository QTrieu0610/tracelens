import { ReactNode } from 'react';
import { Layers } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-studio-800 rounded-xl bg-studio-900/30">
      <div className="p-3 mb-4 rounded-full bg-studio-800/50 text-studio-400">
        {icon || <Layers className="w-8 h-8" />}
      </div>
      <h3 className="text-base font-semibold text-studio-200 mb-1">{title}</h3>
      <p className="text-xs text-studio-400 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
