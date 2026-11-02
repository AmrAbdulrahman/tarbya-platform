import type { ReactNode } from 'react';

/** Cache key for the signed-in user's mentor and mentees. */
export const mineQueryKey = ['mentorships', 'mine'];

export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-6">
      {title && <h2 className="text-lg font-bold text-navy">{title}</h2>}
      {children}
    </section>
  );
}

/** Who sees a field, next to its label. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="text-[13px] font-normal text-ink-subtle">
      · {children}
    </span>
  );
}
