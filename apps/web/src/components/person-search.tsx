import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonRefDto } from '@tarbya/api-client';
import { cn } from '@tarbya/ui';
import { useDebounced } from '../lib/use-debounced';
import { Avatar } from './profile/avatar';

export interface PersonOption extends PersonRefDto {
  /** A second line under the name, e.g. the phone number. */
  hint?: string | null;
  /** A short tag after the name, e.g. "My mentee". */
  tag?: string | null;
}

interface PersonSearchProps {
  /** Distinguishes this search's cached results from other searches'. */
  queryKey: string;
  search: (q: string, signal: AbortSignal) => Promise<PersonOption[]>;
  onPick: (person: PersonOption) => void;
  placeholder: string;
  /** The field's accessible name. */
  label: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

/** A search field with a drop-down of people, picked by click or keyboard (BR-USR-6). */
export function PersonSearch({
  queryKey,
  search,
  onPick,
  placeholder,
  label,
  className,
  inputClassName,
  autoFocus,
}: PersonSearchProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 200);

  const results = useQuery({
    queryKey: ['person-search', queryKey, q],
    queryFn: ({ signal }) => search(q, signal),
    enabled: open && q.length > 0,
    staleTime: 30_000,
  });
  const options = results.data ?? [];
  useEffect(() => setActive(0), [q]);

  const choose = (person: PersonOption) => {
    setText('');
    setOpen(false);
    onPick(person);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && q.length > 0;
  return (
    <div className={cn('relative', className)}>
      <input
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && options[active]
            ? `${listId}-${options[active].id}`
            : undefined
        }
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className={cn(
          'h-10 w-full rounded-control border border-border bg-card pe-3 ps-10 text-[15px]',
          inputClassName,
        )}
      />
      <Search
        className="pointer-events-none absolute start-3 top-2.5 size-5 text-ink-subtle"
        aria-hidden
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-card border border-border bg-card p-1 shadow-lg"
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
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2',
                i === active && 'bg-primary-tint',
              )}
            >
              <Avatar
                name={person.name}
                url={person.avatarUrl}
                className="size-8 shrink-0"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium">
                    {person.name}
                  </span>
                  {person.tag && (
                    <span className="shrink-0 rounded-full bg-primary-tint px-2 text-xs text-primary-hover">
                      {person.tag}
                    </span>
                  )}
                </span>
                {person.hint && (
                  <span className="text-[13px] text-ink-subtle">
                    <bdi dir="ltr">{person.hint}</bdi>
                  </span>
                )}
              </span>
            </li>
          ))}
          {results.isSuccess && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-subtle">
              {t('admin.picker.noResults')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
