import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  peopleControllerSearch,
  type PersonDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { Badge, cn, Input } from '@tarbya/ui';
import { useDebounced } from '../../lib/use-debounced';

interface Props {
  id: string;
  value: UserRefDto[];
  onChange: (people: UserRefDto[]) => void;
  /** One-click additions, e.g. the mentor's mentees. */
  suggestions: UserRefDto[];
  invalid?: boolean;
}

/** Several people at once: any active member, the mentor's mentees first (BR-FU-2, BR-USR-6). */
export function ParticipantsPicker({
  id,
  value,
  onChange,
  suggestions,
  invalid,
}: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 200);
  const picked = new Set(value.map((p) => p.id));

  const results = useQuery({
    queryKey: ['people', q],
    queryFn: async ({ signal }) =>
      (await peopleControllerSearch({ q }, { signal })).data as PersonDto[],
    enabled: open && q.length > 0,
    staleTime: 30_000,
  });
  const options = (results.data ?? []).filter((p) => !picked.has(p.id));
  const add = (p: UserRefDto) => {
    onChange([...value, { id: p.id, name: p.name }]);
    setText('');
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && options[active]) {
      e.preventDefault();
      add(options[active]);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && q.length > 0;
  const unpicked = suggestions.filter((s) => !picked.has(s.id));
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'relative flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-card px-2 py-1.5 focus-within:border-primary focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary',
          invalid ? 'border-trend-down' : 'border-border',
        )}
      >
        {value.map((p) => (
          <span
            key={p.id}
            className="flex h-8 items-center gap-1 rounded-full bg-primary-tint ps-3 pe-1 text-sm font-medium text-primary-hover"
          >
            {p.name}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v.id !== p.id))}
              aria-label={t('mentoring.log.removeParticipant', {
                name: p.name,
              })}
              className="grid size-6 place-items-center rounded-full hover:bg-card"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <Input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && options[active]
              ? `${listId}-${options[active].id}`
              : undefined
          }
          aria-invalid={invalid || undefined}
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="h-8 min-w-32 flex-1 border-0 px-1 text-[15px] focus:outline-none"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-card border border-border bg-card p-1 shadow-lg"
          >
            {options.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(p)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2',
                  i === active && 'bg-primary-tint',
                )}
              >
                <span className="flex-1 text-[15px] font-medium">{p.name}</span>
                {p.isMyMentee && (
                  <Badge tone="primary">{t('mentoring.log.myMentee')}</Badge>
                )}
              </li>
            ))}
            {!results.isFetching && options.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-subtle">
                {t('admin.picker.noResults')}
              </li>
            )}
          </ul>
        )}
      </div>
      {unpicked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-subtle">
          {t('mentoring.log.suggestions')}
          {unpicked.slice(0, 6).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => add(s)}
              aria-label={t('mentoring.log.addParticipant', { name: s.name })}
              className="h-7 rounded-full border border-border px-2.5 text-ink-muted hover:border-primary hover:text-primary"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
