import { cn } from '@tarbya/ui';

/** A member's picture, or their initial when they haven't uploaded one. */
export function Avatar({
  name,
  url,
  className,
}: {
  name: string;
  url: string | null | undefined;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-primary-tint font-bold text-primary-hover',
        className,
      )}
    >
      {name.trim().charAt(0)}
    </span>
  );
}
