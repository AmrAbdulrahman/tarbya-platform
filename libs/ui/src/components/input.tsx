import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-control border border-border bg-card px-3 text-base text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary aria-[invalid=true]:border-trend-down disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
