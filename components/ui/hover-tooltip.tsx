import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HoverTooltipProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

export function HoverTooltip({ children, content, className }: HoverTooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[300px] -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-xl opacity-0 transition duration-150 group-hover:opacity-100"
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
