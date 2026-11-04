import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/** A panel that slides in from the start edge (right in Arabic, left in English). */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

interface SheetContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  /** Read by screen readers only; the panel shows its own heading. */
  title: ReactNode;
  /** Label for the close button (translated by the caller). */
  closeLabel: string;
}

export function SheetContent({
  title,
  closeLabel,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand/40" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'sheet-in fixed inset-y-0 start-0 z-50 flex w-[min(300px,85vw)] flex-col overflow-y-auto bg-card shadow-xl',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute end-3 top-3 grid size-9 place-items-center rounded-lg text-ink-subtle hover:bg-surface hover:text-primary"
        >
          <X className="size-5" aria-hidden />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
