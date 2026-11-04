import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@tarbya/ui';

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
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
      {title && <h2 className="text-base font-bold text-brand">{title}</h2>}
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

/** A titled part of a form in a dialog: set off by a rule, or boxed on grey. */
export function Section({
  title,
  icon,
  boxed = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  boxed?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3',
        boxed
          ? 'rounded-lg border border-border bg-surface p-3'
          : 'border-t border-divider pt-4',
      )}
    >
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-brand [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Upcoming or done, worked out from the date and time as they're typed (BR-FU-3). */
export function WhenStatus({ upcoming }: { upcoming: boolean }) {
  const { t } = useTranslation();
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
      <span
        className={cn(
          'inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-medium',
          upcoming
            ? 'bg-manager-tint text-manager'
            : 'bg-emerald-50 text-trend-up',
        )}
      >
        {upcoming ? t('mentoring.log.upcoming') : t('mentoring.log.done')}
      </span>
      {upcoming ? t('mentoring.log.upcomingHint') : t('mentoring.log.doneHint')}
    </p>
  );
}
