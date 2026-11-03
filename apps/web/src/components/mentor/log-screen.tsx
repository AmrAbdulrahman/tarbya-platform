import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  mentorshipsControllerMine,
  trackablesControllerList,
  type MyMenteeDto,
  type MyMentoringDto,
  type TrackableSummaryDto,
} from '@tarbya/api-client';
import { Badge, Button, cn, Select, useToast } from '@tarbya/ui';
import { FeedList } from '../feed/feed-list';
import { ChallengesPanel } from '../mentee/challenges-panel';
import { TasksPanel } from '../mentee/tasks-panel';
import { TrackableCard } from '../trackables/trackable-card';
import { TrackableDialog } from '../trackables/trackable-dialog';
import { trackablesQueryKey } from '../trackables/trackables-board';
import { EntryKind } from './entry-kind';
import { mineQueryKey } from './form-parts';
import { Breadcrumbs } from '../breadcrumbs';

type Kind = 'follow-up' | 'activity';

const tone = { REGULAR: 'success', DUE: 'warn', LATE: 'danger' } as const;

/**
 * The follow-up and activity screens (US-4.3, US-4.4): pick a mentee first, see
 * where things stand with them, and open the form when ready. Saving closes
 * the form and confirms with a toast.
 */
export function LogScreen({
  kind,
  menteeId,
  form,
}: {
  kind: Kind;
  menteeId?: string;
  form: (mentee: MyMenteeDto, onSaved: () => void) => ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const mine = useQuery({
    queryKey: mineQueryKey,
    queryFn: async ({ signal }) =>
      (await mentorshipsControllerMine({ signal })).data as MyMentoringDto,
  });
  const mentees = mine.data?.mentees ?? [];
  const selected = mentees.find((m) => m.mentee.id === menteeId);

  const choose = (id: string) => {
    setOpen(false);
    void navigate({
      to: '.',
      search: { menteeId: id || undefined },
      replace: true,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: t('nav.menteeDashboard'), to: '/mentor' },
          {
            label:
              kind === 'follow-up'
                ? t('mentoring.log.followUpTitle')
                : t('mentoring.log.activityTitle'),
          },
        ]}
      />
      <h1 className="text-2xl font-bold text-navy">
        {kind === 'follow-up'
          ? t('mentoring.log.followUpTitle')
          : t('mentoring.log.activityTitle')}
      </h1>
      <EntryKind current={kind} menteeId={menteeId} />

      <section className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
        <label
          htmlFor="log-mentee"
          className="text-sm font-semibold text-ink-muted"
        >
          {t('mentoring.log.mentee')}
        </label>
        <Select
          id="log-mentee"
          value={selected ? selected.mentee.id : ''}
          onChange={(e) => choose(e.target.value)}
          className="h-11 max-w-md text-[15px]"
        >
          <option value="">{t('mentoring.log.chooseMentee')}</option>
          {mentees.map((m) => (
            <option key={m.mentee.id} value={m.mentee.id}>
              {m.mentee.name}
            </option>
          ))}
        </Select>
        <span className="text-[13px] text-ink-subtle">
          {mine.isSuccess && !mentees.length
            ? t('mentoring.log.noMentees')
            : !selected && t('mentoring.log.pickFirst')}
        </span>
      </section>

      {selected && (
        <>
          <section className="overflow-hidden rounded-card border-2 border-primary/40 bg-card">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center gap-3 px-6 py-4 text-start hover:bg-primary-tint/40"
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary text-white">
                <Plus className="size-4" aria-hidden />
              </span>
              <span className="flex-1 text-base font-bold text-navy">
                {kind === 'follow-up'
                  ? t('mentoring.log.newFollowUpWith', {
                      name: selected.mentee.name,
                    })
                  : t('mentoring.log.newActivityWith', {
                      name: selected.mentee.name,
                    })}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-5 text-ink-subtle transition-transform',
                  open && 'rotate-180',
                )}
              />
            </button>
            {open && (
              <div
                id={panelId}
                className="border-t border-border bg-surface/60 p-6"
              >
                {form(selected, () => {
                  setOpen(false);
                  toast(
                    kind === 'follow-up'
                      ? t('mentoring.log.savedFollowUp')
                      : t('mentoring.log.savedActivity'),
                  );
                })}
              </div>
            )}
          </section>

          <Summary mentee={selected} />

          <div className="flex flex-wrap items-start gap-4">
            <section
              aria-labelledby="log-history"
              className="flex min-w-0 flex-[3_1_420px] flex-col gap-4 rounded-card border border-border bg-card p-4"
            >
              <h2 id="log-history" className="text-base font-bold text-navy">
                {t('feed.title')}
              </h2>
              <FeedList userId={selected.mentee.id} />
            </section>
            <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-4">
              <Progress menteeId={selected.mentee.id} />
              <ChallengesPanel menteeId={selected.mentee.id} canManage />
              <TasksPanel menteeId={selected.mentee.id} canManage />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Last contact and open tasks at a glance. */
function Summary({ mentee }: { mentee: MyMenteeDto }) {
  const { t } = useTranslation();
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-card border border-border bg-card px-6 py-4 text-sm">
      <div className="flex items-center gap-2">
        <dt className="text-ink-subtle">{t('mentoring.log.lastContact')}</dt>
        <dd className="flex items-center gap-2 font-medium">
          {mentee.lastContactAt
            ? t('mentoring.log.daysAgo', { count: mentee.daysSinceContact })
            : t('mentoring.log.neverContacted')}
          <Badge tone={tone[mentee.contactStatus]}>
            {t(`mentoring.log.status.${mentee.contactStatus}`)}
          </Badge>
          {mentee.lastContactKind && (
            <span className="text-ink-subtle">
              {t(`feed.kind.${mentee.lastContactKind}`)}
            </span>
          )}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-ink-subtle">{t('mentoring.log.openTasks')}</dt>
        <dd className="font-figures font-semibold">{mentee.openTasks}</dd>
      </div>
    </dl>
  );
}

/** The mentee's active trackables with their trend, and "new trackable" for the mentor (US-4.5). */
function Progress({ menteeId }: { menteeId: string }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const trackables = useQuery({
    queryKey: trackablesQueryKey(menteeId),
    queryFn: async ({ signal }) =>
      (await trackablesControllerList({ menteeId }, { signal }))
        .data as TrackableSummaryDto[],
  });
  const active = (trackables.data ?? []).filter((x) => !x.archivedAt);
  return (
    <section aria-labelledby="log-progress" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 id="log-progress" className="flex-1 text-base font-bold text-navy">
          {t('mentoring.log.progress')}
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t('trackables.add')}
        </Button>
      </div>
      {trackables.isSuccess && !active.length && (
        <p className="text-sm text-ink-subtle">{t('trackables.noActive')}</p>
      )}
      {active.map((x) => (
        <TrackableCard key={x.id} trackable={x} />
      ))}
      <TrackableDialog
        menteeId={menteeId}
        open={adding}
        onOpenChange={setAdding}
      />
    </section>
  );
}
