import type { ReactNode } from 'react';

export function Section({
  id,
  title,
  hint,
  aside,
  children,
}: {
  id: string;
  title: string;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h2 id={`${id}-title`} className="text-base font-bold text-brand">
            {title}
          </h2>
          {hint && <p className="text-[13px] text-ink-subtle">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
