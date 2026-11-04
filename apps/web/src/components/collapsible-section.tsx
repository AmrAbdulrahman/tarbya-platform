import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@tarbya/ui';

/** A card whose body opens on demand; closed, it doesn't render (or fetch) its content. */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col rounded-card border border-border bg-card',
        className,
      )}
    >
      <h2 className="text-base font-bold text-navy">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-card px-4 py-3 text-start hover:text-primary"
        >
          {icon}
          <span className="flex-1">{title}</span>
          <ChevronDown
            className={cn('size-4 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
