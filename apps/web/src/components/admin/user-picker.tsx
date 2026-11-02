import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  usersControllerList,
  type UserDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { cn, Input } from '@tarbya/ui';
import { useDebounced } from '../../lib/use-debounced';

interface UserPickerProps {
  id: string;
  value: UserRefDto | null;
  onChange: (user: UserRefDto | null) => void;
  /** Users that can't be picked, e.g. the user being edited. */
  excludeIds?: string[];
  invalid?: boolean;
  describedBy?: string;
  /** Offer only moderators and the super admin (who can be managers). */
  moderatorsOnly?: boolean;
  /** Focus the field when it appears, e.g. after an "add" button opened it. */
  autoFocus?: boolean;
}

/** Typeahead over name, email and phone (BR-USR-6), active users only. */
export function UserPicker({
  id,
  value,
  onChange,
  excludeIds = [],
  invalid,
  describedBy,
  moderatorsOnly,
  autoFocus,
}: UserPickerProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 200);

  const results = useQuery({
    queryKey: ['user-picker', q, !!moderatorsOnly],
    queryFn: async ({ signal }) =>
      (
        await usersControllerList(
          { q, status: 'active', limit: 8, moderatorsOnly },
          { signal },
        )
      ).data,
    enabled: open && q.length > 0,
    staleTime: 30_000,
  });
  const options: UserDto[] =
    results.data && 'items' in results.data
      ? results.data.items.filter((u) => !excludeIds.includes(u.id))
      : [];

  useEffect(() => setActive(0), [q]);

  if (value) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-control border border-border bg-surface px-3">
        <span className="flex-1 truncate text-[15px] font-medium">
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('admin.picker.clear', { name: value.name })}
          className="grid size-7 place-items-center rounded text-ink-subtle hover:bg-card hover:text-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  const choose = (user: UserDto) => {
    onChange({ id: user.id, name: user.name });
    setText('');
    setOpen(false);
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
    <div className="relative">
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
        aria-describedby={describedBy}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={t('admin.picker.placeholder')}
        className="h-11 text-[15px]"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-card border border-border bg-card p-1 shadow-lg"
        >
          {options.map((user, i) => (
            <li
              key={user.id}
              id={`${listId}-${user.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(user)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer flex-col rounded-lg px-3 py-2',
                i === active && 'bg-primary-tint',
              )}
            >
              <span className="text-[15px] font-medium">{user.name}</span>
              <span className="text-[13px] text-ink-subtle">
                <bdi>
                  {[user.email, user.phone].filter(Boolean).join(' · ')}
                </bdi>
              </span>
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
  );
}
