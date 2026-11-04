import { Link } from '@tanstack/react-router';
import { ChevronRight, House } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

export interface Crumb {
  label: string;
  /** A route path, with `params` for its `$` segments; absent for the current page. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
}

/** Where this page sits, from home; the last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.breadcrumbs')} className="-mb-1">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-ink-subtle">
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 rounded hover:text-primary"
          >
            <House className="size-3.5" aria-hidden />
            {t('nav.home')}
          </Link>
        </li>
        {items.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            <li aria-hidden>
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </li>
            <li className="min-w-0">
              {c.to && i < items.length - 1 ? (
                <Link
                  // Crumbs name routes by path; TanStack's typed `to` needs a cast here.
                  to={c.to as '/'}
                  params={c.params as never}
                  search={c.search as never}
                  className="hover:text-primary"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="block truncate font-medium text-ink"
                >
                  {c.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
