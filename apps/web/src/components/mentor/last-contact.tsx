import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  mentorshipsControllerMine,
  type MyMenteeDto,
  type MyMentoringDto,
} from '@tarbya/api-client';
import { Badge, cn } from '@tarbya/ui';
import { useMe } from '../../auth/session';
import { mineQueryKey } from './form-parts';

const tone = { REGULAR: 'success', DUE: 'warn', LATE: 'danger' } as const;

/** The signed-in mentor's mentees; empty for anyone who mentors no one. */
export function useMyMentees() {
  const me = useMe();
  const mine = useQuery({
    queryKey: mineQueryKey,
    queryFn: async ({ signal }) =>
      (await mentorshipsControllerMine({ signal })).data as MyMentoringDto,
    enabled: me.roles.includes('MENTOR'),
  });
  return { mentees: mine.data?.mentees ?? [], isSuccess: mine.isSuccess };
}

/** How long since the mentor last met the mentee, with its status (BR-FU-5). */
export function LastContact({
  mentee,
  className,
}: {
  mentee: MyMenteeDto;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-subtle',
        className,
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      <span>{t('mentoring.log.lastContact')}:</span>
      <span className="font-medium text-ink">
        {mentee.lastContactAt
          ? t('mentoring.log.daysAgo', { count: mentee.daysSinceContact })
          : t('mentoring.log.neverContacted')}
      </span>
      {mentee.lastContactKind && (
        <span>· {t(`feed.kind.${mentee.lastContactKind}`)}</span>
      )}
      <Badge tone={tone[mentee.contactStatus]}>
        {t(`mentoring.log.status.${mentee.contactStatus}`)}
      </Badge>
    </p>
  );
}
