import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Native select styled like Input; native keeps keyboard and screen-reader
 * behaviour for free. Our own chevron sits as far from the end edge as from
 * the top and bottom.
 */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          'peer h-11 w-full appearance-none rounded-control border border-border bg-card pe-10 ps-3 text-[15px] text-ink focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary aria-[invalid=true]:border-trend-down disabled:opacity-60',
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle peer-disabled:opacity-60"
      />
    </div>
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
  warn: 'bg-amber-50 text-warn',
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

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-control border border-border bg-card px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-2 focus:-outline-offset-1 focus:outline-primary aria-[invalid=true]:border-trend-down',
        className,
      )}
      {...props}
    />
  );
}
