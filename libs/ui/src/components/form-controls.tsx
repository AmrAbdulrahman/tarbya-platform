import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/** Native select styled like Input; native keeps keyboard and screen-reader behaviour for free. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-control border border-border bg-card px-3 text-[15px] text-ink focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary aria-[invalid=true]:border-trend-down disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({
  label,
  hint,
  className,
  id,
  ...props
}: CheckboxProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex items-start gap-2.5 text-[15px]', className)}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={hintId}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-primary"
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer">
          {label}
        </label>
        {hint && (
          <span id={hintId} className="text-[13px] text-ink-subtle">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

const badgeTones = {
  neutral: 'bg-slate-100 text-ink-muted',
  success: 'bg-emerald-50 text-trend-up',
  danger: 'bg-red-50 text-trend-down',
  primary: 'bg-primary-tint text-primary-hover',
  manager: 'bg-manager-tint text-manager',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}
