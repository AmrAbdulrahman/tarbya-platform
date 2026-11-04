import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  title: ReactNode;
  description?: ReactNode;
  /** Label for the close button (translated by the caller). */
  closeLabel: string;
}

export function DialogContent({
  title,
  description,
  closeLabel,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-0 top-1/2 z-50 mx-auto flex max-h-[90vh] w-[min(560px,calc(100vw-32px))] -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card bg-card p-6 shadow-xl',
          className,
        )}
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <DialogPrimitive.Title className="text-xl font-bold text-brand">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-ink-subtle">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="grid size-9 place-items-center rounded-lg text-ink-subtle hover:bg-surface hover:text-primary"
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
