import { useInfiniteQuery } from '@tanstack/react-query';
import { Eye, ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  auditControllerList,
  type ChangeDto,
  type ChangePageDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { Badge, Button } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { actedBy } from '../acted-by';
import { CollapsibleSection } from '../collapsible-section';

// Diff keys worth naming; ids and the like are left out.
const FIELDS = [
  'name',
  'email',
  'phone',
  'locale',
  'calendar',
  'managerId',
  'isModerator',
  'deactivatedAt',
] as const;
type Field = (typeof FIELDS)[number];

/**
 * Audited changes to a member and their mentorships, for admins (BR-ADM-4,
 * BR-ADM-5). Closed until opened, so it loads only when wanted.
 */
export function ChangeLog({ userId }: { userId: string }) {
  const { t } = useTranslation();
  return (
    <CollapsibleSection
      title={t('changes.title')}
      icon={<ScrollText className="size-4 text-primary" aria-hidden />}
    >
      <Changes userId={userId} />
    </CollapsibleSection>
  );
}

function Changes({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const changes = useInfiniteQuery({
    queryKey: ['changes', userId],
    queryFn: async ({ pageParam, signal }) =>
      (await auditControllerList({ userId, before: pageParam }, { signal }))
        .data as ChangePageDto,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = changes.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[13px] text-ink-subtle">{t('changes.hint')}</span>
      {changes.isError && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, changes.error)}
        </p>
      )}
      {changes.isSuccess && !items.length && (
        <p className="text-sm text-ink-subtle">{t('changes.empty')}</p>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {items.map((change) => (
          <ChangeRow key={change.id} change={change} />
        ))}
      </ul>
      {changes.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={changes.isFetchingNextPage}
          onClick={() => changes.fetchNextPage()}
        >
          {t('feed.more')}
        </Button>
      )}
    </div>
  );
}

function ChangeRow({ change }: { change: ChangeDto }) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  // The actor did it; onBehalfOf is whose account they were using.
  const who = change.actor
    ? change.onBehalfOf
      ? actedBy(t, change.onBehalfOf, change.actor)
      : change.actor.name
    : t('changes.system');
  const fields = change.fields
    .filter((f): f is Field => (FIELDS as readonly string[]).includes(f))
    .map((f) => t(`changes.field.${f}`))
    .join(i18n.language === 'ar' ? '، ' : ', ');
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-navy">
          {t(`changes.action.${change.action}`)}
        </span>
        {change.onBehalfOf && (
          <Badge tone="warn" className="gap-1">
            <Eye className="size-3.5" aria-hidden />
            {t('changes.impersonated')}
          </Badge>
        )}
      </div>
      <span className="text-[13px] text-ink-subtle">
        {who} ·{' '}
        {formatDate(change.createdAt, {
          locale: i18n.language as Language,
          calendar: me.calendar,
          withTime: true,
        })}
        {fields && <> · {fields}</>}
      </span>
    </li>
  );
}
