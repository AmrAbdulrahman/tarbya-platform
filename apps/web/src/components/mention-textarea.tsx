import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import {
  Fragment,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  challengesControllerMentionAccess,
  messagesControllerContacts,
  notesControllerMentionAccess,
  type MentionAccessDto,
  type NoteVisibility,
  type PersonRefDto,
} from '@tarbya/api-client';
import {
  plainMentions,
  splitMentions,
  withMentionTokens,
} from '@tarbya/shared';
import { cn, Textarea } from '@tarbya/ui';
import { useDebounced } from '../lib/use-debounced';
import { Avatar } from './profile/avatar';

export interface Mention {
  id: string;
  name: string;
}

/** The `@query` being typed just before the caret, if any. */
function typedMention(text: string, caret: number) {
  const match = /(^|\s)@([^@\n]{0,30})$/.exec(text.slice(0, caret));
  return match ? { query: match[2], start: caret - match[2].length - 1 } : null;
}

/**
 * Where each picked person's `@Name` sits in the text, in order. Longer names
 * claim their place first, as in `withMentionTokens`, so "@Omar Ali" isn't
 * read as "@Omar".
 */
export function mentionRanges(
  text: string,
  picked: readonly Mention[],
): [start: number, end: number][] {
  const names = [...new Set(picked.map((m) => m.name))].sort(
    (a, b) => b.length - a.length,
  );
  const ranges: [number, number][] = [];
  for (const name of names) {
    const needle = `@${name}`;
    for (
      let i = text.indexOf(needle);
      i !== -1;
      i = text.indexOf(needle, i + 1)
    ) {
      const end = i + needle.length;
      if (!ranges.some(([s, e]) => i < e && end > s)) ranges.push([i, end]);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** What the mirror copies from the textarea, so its text lines up exactly. */
const MIRRORED = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textAlign',
  'direction',
  'paddingTop',
  'paddingBottom',
  'paddingInlineStart',
  'paddingInlineEnd',
  'borderTopWidth',
  'borderBottomWidth',
  'borderInlineStartWidth',
  'borderInlineEndWidth',
  'borderRadius',
] as const;

/**
 * A textarea where typing "@" offers any member to mention. The text keeps a
 * plain `@Name`; `picked` remembers who each one is, for `withMentionTokens`.
 */
export function MentionTextarea({
  value,
  onChange,
  picked,
  onPick,
  label,
  placeholder,
  rows = 2,
  maxLength,
  className,
  autoFocus,
  above,
  onKeyDown: onOtherKey,
}: {
  value: string;
  onChange: (text: string) => void;
  picked: Mention[];
  onPick: (mention: Mention) => void;
  label: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  autoFocus?: boolean;
  /** Opens the list above the field, for a composer at the bottom. */
  above?: boolean;
  /** Keys the mention list doesn't take, e.g. Enter to send. */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [typing, setTyping] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [active, setActive] = useState(0);
  const q = useDebounced(typing?.query.trim() ?? '', 150);
  const results = useQuery({
    queryKey: ['person-search', 'mention', q],
    queryFn: async ({ signal }) =>
      (await messagesControllerContacts({ q: q || undefined }, { signal }))
        .data as PersonRefDto[],
    enabled: typing !== null,
    staleTime: 30_000,
  });
  const options = typing ? (results.data ?? []) : [];
  const open = typing !== null && options.length > 0;
  const ranges = mentionRanges(value, picked);

  // The textarea's text is see-through; a mirror behind it draws the same text
  // with each mention marked, since a textarea can't style part of its text.
  const mirror = useRef<HTMLDivElement>(null);
  // Where the caret goes once the new text has rendered (setting the value moves it to the end).
  const caretAfter = useRef<number | null>(null);
  useLayoutEffect(() => {
    const from = ref.current;
    const to = mirror.current;
    if (!from || !to) return;
    const style = getComputedStyle(from);
    for (const key of MIRRORED) to.style[key] = style[key];
    to.scrollTop = from.scrollTop;
    if (caretAfter.current !== null) {
      from.setSelectionRange(caretAfter.current, caretAfter.current);
      caretAfter.current = null;
    }
  });

  const track = (text: string, caret: number) => {
    const typed = typedMention(text, caret);
    // An "@" that starts a mention already picked isn't asking for another.
    const next =
      typed && mentionRanges(text, picked).some(([s]) => s === typed.start)
        ? null
        : typed;
    setTyping(next);
    if (next?.query !== typing?.query) setActive(0);
  };

  const choose = (person: PersonRefDto) => {
    if (!typing) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const insert = `@${person.name} `;
    const text = value.slice(0, typing.start) + insert + value.slice(caret);
    onChange(text);
    if (!picked.some((m) => m.id === person.id))
      onPick({ id: person.id, name: person.name });
    setTyping(null);
    caretAfter.current = typing.start + insert.length;
    ref.current?.focus();
  };

  /** Backspace or Delete next to (or inside) a mention takes the whole of it. */
  const removeMention = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart: at, selectionEnd } = e.currentTarget;
    if (at !== selectionEnd) return false;
    const hit = ranges.find(([s, end]) =>
      e.key === 'Backspace' ? at > s && at <= end : at >= s && at < end,
    );
    if (!hit) return false;
    e.preventDefault();
    const text = value.slice(0, hit[0]) + value.slice(hit[1]);
    onChange(text);
    setTyping(null);
    caretAfter.current = hit[0];
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && removeMention(e))
      return;
    if (!open) {
      onOtherKey?.(e);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTyping(null);
    }
  };

  return (
    <div className="relative">
      <div
        ref={mirror}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-transparent bg-card text-ink [border-style:solid]"
      >
        {marked(value, ranges)}
      </div>
      <Textarea
        ref={ref}
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && options[active]
            ? `${listId}-${options[active].id}`
            : undefined
        }
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          className,
          'relative block bg-transparent text-transparent caret-ink',
        )}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
            track(e.currentTarget.value, e.currentTarget.selectionStart);
        }}
        onClick={(e) =>
          track(e.currentTarget.value, e.currentTarget.selectionStart)
        }
        onBlur={() => setTimeout(() => setTyping(null), 120)}
        onScroll={(e) => {
          if (mirror.current)
            mirror.current.scrollTop = e.currentTarget.scrollTop;
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('mentions.pick')}
          className={cn(
            'absolute inset-x-0 z-30 max-h-64 overflow-y-auto rounded-card border border-border bg-card p-1 shadow-lg',
            above ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {options.map((person, i) => (
            <li
              key={person.id}
              id={`${listId}-${person.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(person)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-[15px]',
                i === active && 'bg-primary-tint',
              )}
            >
              <Avatar
                name={person.name}
                url={person.avatarUrl}
                className="size-7 shrink-0"
              />
              {person.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The text with each mention range marked; a trailing newline keeps its line. */
function marked(text: string, ranges: [number, number][]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s > at) out.push(text.slice(at, s));
    out.push(
      <mark
        key={s}
        className="rounded-sm bg-primary-tint text-primary-hover shadow-[0_0_0_2px_var(--color-primary-tint)]"
      >
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  }
  out.push(text.slice(at) + (text.endsWith('\n') ? ' ' : ''));
  return out;
}

/** The people picked whose `@Name` is still in the text. */
/**
 * A draft with mentions: the text as typed, who was picked, and the body to
 * store, with each `@Name` still in the text turned into a mention.
 */
export function useMentionDraft(storedBody = '') {
  const [text, setText] = useState(() => draftFrom(storedBody).text);
  const [picked, setPicked] = useState<Mention[]>(
    () => draftFrom(storedBody).picked,
  );
  const mentioned = mentionsIn(text, picked);
  return {
    text,
    setText,
    picked,
    pick: (m: Mention) => setPicked((list) => [...list, m]),
    mentioned,
    body: () => withMentionTokens(text.trim(), mentioned),
    /** Back to empty, or to a stored body (e.g. when an edit is cancelled). */
    reset: (body = '') => {
      setText(draftFrom(body).text);
      setPicked(draftFrom(body).picked);
    },
  };
}

export type MentionDraft = ReturnType<typeof useMentionDraft>;

/** A stored body as the box shows it: plain `@Name`s, and who each one is. */
export function draftFrom(body: string): { text: string; picked: Mention[] } {
  const parts = splitMentions(body);
  return {
    text: plainMentions(body),
    picked: parts.flatMap((p) =>
      p.kind === 'mention' ? [{ id: p.userId, name: p.name }] : [],
    ),
  };
}

export const mentionsIn = (text: string, picked: Mention[]) =>
  picked.filter((m) => text.includes(`@${m.name}`));

/**
 * Under a challenge comment being written: the people mentioned who can't
 * see the mentee's challenges, so won't see the comment or hear about it.
 */
export function MentionAccessWarning({
  menteeId,
  mentions,
  noteVisibility,
}: {
  menteeId: string;
  mentions: Mention[];
  /** Checks against who reads a note of this visibility, not the challenges. */
  noteVisibility?: NoteVisibility;
}) {
  const { t } = useTranslation();
  const ids = mentions.map((m) => m.id).sort();
  const access = useQuery({
    queryKey: ['mention-access', menteeId, noteVisibility ?? 'challenges', ids],
    queryFn: async ({ signal }) =>
      (noteVisibility
        ? await notesControllerMentionAccess(
            { menteeId, visibility: noteVisibility, userIds: ids },
            { signal },
          )
        : await challengesControllerMentionAccess(
            { menteeId, userIds: ids },
            { signal },
          )
      ).data as MentionAccessDto,
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  const blocked = mentions.filter((m) => access.data?.blocked.includes(m.id));
  if (!ids.length || !blocked.length) return null;
  return (
    <p role="status" className="flex items-start gap-1.5 text-[13px] text-warn">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {t(noteVisibility ? 'mentions.noteNoAccess' : 'mentions.noAccess', {
        count: blocked.length,
        names: blocked.map((m) => m.name).join(t('mentions.and')),
      })}
    </p>
  );
}

/** Text with its stored mentions shown as highlighted names. */
export function MentionText({ body }: { body: string }) {
  return (
    <>
      {splitMentions(body).map((part, i) => (
        <Fragment key={i}>
          {part.kind === 'text' ? (
            part.text
          ) : (
            <span className="rounded bg-primary-tint px-0.5 font-semibold text-primary-hover">
              @{part.name}
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}
