import type { ReactNode } from 'react';

interface FieldProps {
  id: string;
  label: ReactNode;
  /** Shown beside the label, at the end of the line. */
  aside?: ReactNode;
  error?: string;
  children: ReactNode;
}

export function Field({ id, label, aside, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline">
        <label
          htmlFor={id}
          className="flex-1 text-sm font-semibold text-ink-muted"
        >
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-trend-down">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-control border border-trend-down/30 bg-trend-down/5 px-3 py-2.5 text-sm text-trend-down"
    >
      {message}
    </p>
  );
}
