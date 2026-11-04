import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

const LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are in. */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Six single-digit boxes (US-1.2). Always left-to-right, like the code in the email. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
}: OtpInputProps) {
  const { t } = useTranslation();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const focus = (i: number) =>
    refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const update = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
  };

  const setDigit = (i: number, digit: string) => {
    const chars = digits.slice();
    chars[i] = digit;
    update(chars.join(''));
  };

  const onInput = (i: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    if (typed.length > 1) {
      // Autofill or a fast typist: spread the digits from here.
      update(value.slice(0, i) + typed);
      focus(i + typed.length);
      return;
    }
    setDigit(i, typed);
    focus(i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) setDigit(i, '');
      else if (i > 0) {
        setDigit(i - 1, '');
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    update(pasted);
    focus(pasted.length);
  };

  return (
    <div dir="ltr" className="flex justify-between gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={t('login.digit', { n: i + 1 })}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="h-14 w-full min-w-0 max-w-[52px] rounded-control border border-border bg-card text-center font-figures text-[22px] font-semibold text-brand focus:outline-2 focus:-outline-offset-1 focus:outline-primary aria-[invalid=true]:border-trend-down"
        />
      ))}
    </div>
  );
}
