import { useTranslation } from 'react-i18next';
import type { MyMenteeDto } from '@tarbya/api-client';
import { Badge } from '@tarbya/ui';

const tone = { REGULAR: 'success', DUE: 'warn', LATE: 'danger' } as const;

/** The side panel next to the form: where things stand with the chosen mentee. */
export function MenteeContext({ mentee }: { mentee?: MyMenteeDto }) {
  const { t } = useTranslation();
  return (
    <aside className="flex flex-[1_1_260px] flex-col gap-4 self-start rounded-card border border-border bg-card p-5">
      {mentee && (
        <>
          <h2 className="font-bold text-navy">{mentee.mentee.name}</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-subtle">
                {t('mentoring.log.lastContact')}
              </dt>
              <dd className="flex items-center gap-2 font-medium">
                {mentee.lastContactAt
                  ? t('mentoring.log.daysAgo', {
                      count: mentee.daysSinceContact,
                    })
                  : t('mentoring.log.neverContacted')}
                <Badge tone={tone[mentee.contactStatus]}>
                  {t(`mentoring.log.status.${mentee.contactStatus}`)}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-subtle">
                {t('mentoring.log.openTasks')}
              </dt>
              <dd className="font-figures font-semibold">{mentee.openTasks}</dd>
            </div>
          </dl>
        </>
      )}
      <p className="text-[13px] leading-relaxed text-ink-subtle">
        {t('mentoring.log.aside')}
      </p>
    </aside>
  );
}
