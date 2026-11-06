import type { ReactNode } from 'react';
import { cn } from '@tarbya/ui';

/**
 * A page's title block. It stays in view just below the app header while the
 * page scrolls, running edge to edge over the page's padding.
 */
export function PageHeader({
  className,
  children,
}: {
  /** Layout of the header's contents; a column by default. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <header
      className={cn(
        'sticky top-[var(--app-top,3.5rem)] z-10 -mx-4 -my-2 flex flex-col gap-1 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6',
        className,
      )}
    >
      {children}
    </header>
  );
}
