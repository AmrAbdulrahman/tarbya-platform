import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  mentorshipsControllerActive,
  mentorshipsControllerAssign,
  mentorshipsControllerEnd,
  type AssignResultDto,
  type MentorshipDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { Button } from '@tarbya/ui';
import { UserPicker } from '../../../components/admin/user-picker';
import { Field, FormError } from '../../../components/login/fields';
import { errorMessage } from '../../../auth/error-message';
import { meQuery } from '../../../auth/session';

/** US-3.3 · design/screens/Admin.dc.html (assign panel and mentoring tree) */
export const Route = createFileRoute('/_app/admin/mentorships')({
  component: MentorshipsPage,
});

const queryKey = ['mentorships'];

function MentorshipsPage() {
  const { t } = useTranslation();
  const active = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await mentorshipsControllerActive({ signal })).data as MentorshipDto[],
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-navy">
          {t('mentoring.mentorships.title')}
        </h1>
        <p className="text-[15px] text-ink-subtle">
          {t('mentoring.mentorships.lead')}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <AssignCard />
        <section className="flex min-w-0 flex-[2_1_480px] flex-col gap-4 rounded-card border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-navy">
            {t('mentoring.mentorships.treeTitle')}
          </h2>
          {active.isPending && (
            <p className="text-ink-subtle">{t('admin.common.loading')}</p>
          )}
          {active.data && active.data.length === 0 && (
            <p className="text-ink-subtle">
              {t('mentoring.mentorships.treeEmpty')}
            </p>
          )}
          {active.data && active.data.length > 0 && (
            <MentoringTree mentorships={active.data} />
          )}
        </section>
      </div>
    </>
  );
}

function AssignCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mentor, setMentor] = useState<UserRefDto | null>(null);
  const [mentee, setMentee] = useState<UserRefDto | null>(null);
  const [result, setResult] = useState<AssignResultDto>();

  const assign = useMutation({
    mutationFn: async (replace: boolean) =>
      (
        await mentorshipsControllerAssign({
          mentorId: mentor?.id ?? '',
          menteeId: mentee?.id ?? '',
          replace,
        })
      ).data as AssignResultDto,
    onSuccess: async (data) => {
      setResult(data);
      setMentee(null);
      // The admin may have just become a mentor (or stopped being one): roles drive the sidebar.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
      ]);
    },
  });

  // The API names the current mentor when the mentee already has one.
  const current =
    assign.error instanceof ApiError &&
    assign.error.code === 'MENTEE_HAS_MENTOR'
      ? assign.error.body?.detail
      : undefined;

  return (
    <section className="flex flex-[1_1_320px] flex-col gap-4 rounded-card border border-border bg-card p-6">
      <h2 className="text-lg font-bold text-navy">
        {t('mentoring.mentorships.assignTitle')}
      </h2>
      <Field id="ms-mentor" label={t('mentoring.mentorships.mentor')}>
        <UserPicker
          id="ms-mentor"
          value={mentor}
          onChange={(u) => {
            setMentor(u);
            assign.reset();
            setResult(undefined);
          }}
          excludeIds={mentee ? [mentee.id] : []}
        />
      </Field>
      <Field id="ms-mentee" label={t('mentoring.mentorships.mentee')}>
        <UserPicker
          id="ms-mentee"
          value={mentee}
          onChange={(u) => {
            setMentee(u);
            assign.reset();
            setResult(undefined);
          }}
          excludeIds={mentor ? [mentor.id] : []}
        />
      </Field>

      {current ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-control border border-warn/30 bg-amber-50 p-3 text-sm text-ink"
        >
          {t('mentoring.mentorships.replaceAsk', { name: current })}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => assign.mutate(true)}
              disabled={assign.isPending}
            >
              {t('mentoring.mentorships.replace')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => assign.reset()}>
              {t('admin.common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <FormError
          message={assign.isError ? errorMessage(t, assign.error) : undefined}
        />
      )}
      {result && (
        <div role="status" className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-trend-up">
            {t('mentoring.mentorships.assigned')}
          </span>
          {result.warnings.includes('MENTOR_HAS_NO_MANAGER') && (
            <span className="text-warn">
              {t('mentoring.mentorships.noManagerWarning')}
            </span>
          )}
        </div>
      )}
      <Button
        onClick={() => assign.mutate(false)}
        disabled={!mentor || !mentee || assign.isPending || !!current}
        className="self-start"
      >
        {t('mentoring.mentorships.assign')}
      </Button>
    </section>
  );
}

interface Node {
  user: UserRefDto;
  /** The mentorship to this node's mentor; absent for roots. */
  mentorship?: MentorshipDto;
  children: Node[];
}

/** Roots are mentors nobody mentors; each mentee hangs under their one mentor (BR-MEN-2). */
function buildTree(mentorships: MentorshipDto[]): Node[] {
  const nodes = new Map<string, Node>();
  const node = (user: UserRefDto) => {
    let n = nodes.get(user.id);
    if (!n) nodes.set(user.id, (n = { user, children: [] }));
    return n;
  };
  for (const m of mentorships) {
    const child = node(m.mentee);
    child.mentorship = m;
    node(m.mentor).children.push(child);
  }
  const byName = (a: Node, b: Node) => a.user.name.localeCompare(b.user.name);
  for (const n of nodes.values()) n.children.sort(byName);
  return [...nodes.values()].filter((n) => !n.mentorship).sort(byName);
}

function MentoringTree({ mentorships }: { mentorships: MentorshipDto[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {buildTree(mentorships).map((n) => (
        <TreeNode key={n.user.id} node={n} />
      ))}
    </ul>
  );
}

function TreeNode({ node }: { node: Node }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const end = useMutation({
    mutationFn: () => mentorshipsControllerEnd(node.mentorship?.id ?? ''),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
      ]),
  });

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-divider px-3 py-2">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-primary-tint text-sm font-bold text-primary-hover"
        >
          {node.user.name.charAt(0)}
        </span>
        <span className="font-semibold text-navy">{node.user.name}</span>
        {node.children.length > 0 && (
          <span className="text-[13px] text-ink-subtle">
            {t('mentoring.mentorships.menteeCount', {
              count: node.children.length,
            })}
          </span>
        )}
        <span className="flex-1" />
        {node.mentorship &&
          (confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              {t('mentoring.mentorships.endAsk', {
                mentor: node.mentorship.mentor.name,
                mentee: node.user.name,
              })}
              <Button
                size="sm"
                className="bg-trend-down hover:bg-trend-down/90"
                onClick={() => end.mutate()}
                disabled={end.isPending}
              >
                {t('mentoring.mentorships.confirmEnd')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                {t('admin.common.cancel')}
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-trend-down"
              onClick={() => setConfirming(true)}
            >
              {t('mentoring.mentorships.end')}
            </Button>
          ))}
      </div>
      {node.children.length > 0 && (
        <ul className="flex flex-col gap-2 border-s-2 border-divider ps-5">
          {node.children.map((c) => (
            <TreeNode key={c.user.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}
