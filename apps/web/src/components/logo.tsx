import { useId } from 'react';

/** Arch, crescent, dome and open book (design/brand/brand-sheet.webp). */
export function LogoMark({
  tone = 'onLight',
  className,
}: {
  /** `onDark` for brand-green backgrounds such as the sign-in hero. */
  tone?: 'onLight' | 'onDark';
  className?: string;
}) {
  const mask = useId();
  const frame =
    tone === 'onDark' ? 'var(--color-surface)' : 'var(--color-brand)';
  const dome = tone === 'onDark' ? '#cfe0d6' : 'var(--color-secondary)';
  const gold = 'var(--color-accent)';

  return (
    <svg viewBox="0 0 100 108" aria-hidden className={className}>
      <mask id={mask}>
        <rect width="100" height="108" fill="#fff" />
        <circle cx="55" cy="34.5" r="8" fill="#000" />
      </mask>
      <path
        d="M10.5 84V46C10.5 31 22 23 33 17C42 12 47 9 50 4C53 9 58 12 67 17C78 23 89.5 31 89.5 46V84"
        fill="none"
        stroke={frame}
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="38" r="10" fill={gold} mask={`url(#${mask})`} />
      <path
        d="M28 77C27 68 31 61.5 39 57C45 53.5 48.5 52 50 49C51.5 52 55 53.5 61 57C69 61.5 73 68 72 77Z"
        fill={dome}
      />
      <path
        d="M50 99.5C38 91 22 86.5 3 87.5V95.5C22 94.5 37 98.5 50 107C63 98.5 78 94.5 97 95.5V87.5C78 86.5 62 91 50 99.5Z"
        fill={frame}
      />
      <path
        d="M50 92C39 82 25 76.5 9 76.5V86C25 85.5 39 89 50 97Z"
        fill={gold}
      />
      <path
        d="M50 92C61 82 75 76.5 91 76.5V86C75 85.5 61 89 50 97Z"
        fill={gold}
      />
    </svg>
  );
}
