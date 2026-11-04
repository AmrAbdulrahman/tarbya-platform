import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { meControllerUpdate, type MyProfileDto } from '@tarbya/api-client';
import { setLanguage } from '@tarbya/i18n';
import { cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { FormError } from '../login/fields';
import { Section } from './section';

type Patch = Partial<Pick<MyProfileDto, 'locale' | 'calendar'>>;

/** US-2.1, US-1.4: default language and calendar. */
export function PreferencesSection({
  profile,
  onSaved,
}: {
  profile: MyProfileDto;
  onSaved: (p: MyProfileDto) => void;
}) {
  const { t } = useTranslation();
  const save = useMutation({
    mutationFn: async (patch: Patch) =>
      (await meControllerUpdate(patch)).data as MyProfileDto,
    onSuccess: async (p, patch) => {
      onSaved(p);
      if (patch.locale) await setLanguage(patch.locale);
    },
  });

  return (
    <>
      <Section id="lang" title={t('me.language')} hint={t('me.languageHint')}>
        <Choices
          label={t('me.language')}
          value={profile.locale}
          onChange={(locale) => save.mutate({ locale })}
          options={[
            {
              value: 'ar',
              mark: 'ع',
              label: t('me.arabic'),
              hint: t('me.arabicHint'),
              lang: 'ar',
            },
            {
              value: 'en',
              mark: 'En',
              label: t('me.english'),
              hint: t('me.englishHint'),
              lang: 'en',
            },
          ]}
        />
      </Section>
      <Section
        id="calendar"
        title={t('me.calendar')}
        hint={t('me.calendarHint')}
      >
        <Choices
          label={t('me.calendar')}
          value={profile.calendar}
          onChange={(calendar) => save.mutate({ calendar })}
          options={(['BOTH', 'GREGORIAN', 'HIJRI'] as const).map((c) => ({
            value: c,
            label: t(`admin.calendars.${c}`),
          }))}
        />
        <FormError
          message={save.isError ? errorMessage(t, save.error) : undefined}
        />
      </Section>
    </>
  );
}

interface Option<T> {
  value: T;
  label: string;
  hint?: string;
  mark?: string;
  lang?: string;
}

function Choices<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && onChange(o.value)}
            className={cn(
              'flex items-center gap-3 rounded-card border-2 px-4 py-3 text-start',
              on
                ? 'border-primary bg-primary-tint/60'
                : 'border-border hover:border-primary/50',
            )}
          >
            {o.mark && (
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-lg bg-surface font-bold text-brand"
              >
                {o.mark}
              </span>
            )}
            <span lang={o.lang} className="flex flex-col">
              <span className="font-semibold text-brand">{o.label}</span>
              {o.hint && (
                <span className="text-[13px] text-ink-subtle">{o.hint}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
