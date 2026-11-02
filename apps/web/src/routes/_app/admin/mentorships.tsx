import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  mentorshipsControllerActive,
  mentorshipsControllerEnd,
  type MentorshipDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { Button } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { meQuery } from '../../../auth/session';
import {
  mentorshipsQueryKey,
  useAssignMentee,
} from '../../../components/admin/use-assign-mentee';
import { UserPicker } from '../../../components/admin/user-picker';
import { Field, FormError } from '../../../components/login/fields';

/** US-3.3 · design/screens/Admin.dc.html (assign panel and mentoring tree) */
export const Route = createFileRoute('/_app/admin/mentorships')({
  component: MentorshipsPage,
});

function MentorshipsPage() {
  const { t } = useTranslation();
  const active = useQuery({
    queryKey: mentorshipsQueryKey,
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
      <div className="flex flex-col gap-6">
        <AssignCard />
        <section className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-card p-6">
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
            <ul className="flex flex-col gap-2">
              {buildTree(active.data).map((n) => (
                <TreeNode key={n.user.id} node={n} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/** For a mentor who isn't in the tree yet. */
function AssignCard() {
  const { t } = useTranslation();
  const [mentor, setMentor] = useState<UserRefDto | null>(null);
  const [mentee, setMentee] = useState<UserRefDto | null>(null);
  const assign = useAssignMentee(() => setMentee(null));

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-6">
      <h2 className="text-lg font-bold text-navy">
        {t('mentoring.mentorships.assignTitle')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ms-mentor" label={t('mentoring.mentorships.mentor')}>
          <UserPicker
            id="ms-mentor"
            value={mentor}
            onChange={(u) => {
              setMentor(u);
              assign.reset();
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
            }}
            excludeIds={mentor ? [mentor.id] : []}
          />
        </Field>
      </div>
      <FormError
        message={assign.error ? errorMessage(t, assign.error) : undefined}
      />
      {assign.isSuccess && (
        <p role="status" className="text-sm font-medium text-trend-up">
          {t('mentoring.mentorships.assigned')}
        </p>
      )}
      <Button
        onClick={() => mentor && mentee && assign.assign(mentor, mentee)}
        disabled={!mentor || !mentee || assign.isPending}
        className="self-start"
      >
        {t('mentoring.mentorships.assign')}
      </Button>
      {assign.confirmDialog}
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

function TreeNode({ node }: { node: Node }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const assign = useAssignMentee(() => setAdding(false));
  const end = useMutation({
    mutationFn: () => mentorshipsControllerEnd(node.mentorship?.id ?? ''),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: mentorshipsQueryKey }),
        queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
      ]),
  });
  const pickerId = `add-mentee-${node.user.id}`;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-divider px-3 py-2">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-primary-tint text-sm font-bold text-primary-hover"
        >
          {node.user.name.charAt(0)}
        </span>
        <Link
          to="/people/$id"
          params={{ id: node.user.id }}
          className="font-semibold text-navy hover:text-primary"
        >
          {node.user.name}
        </Link>
        {node.children.length > 0 && (
          <span className="text-[13px] text-ink-subtle">
            {t('mentoring.mentorships.menteeCount', {
              count: node.children.length,
            })}
          </span>
        )}
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={adding}
          aria-controls={adding ? pickerId : undefined}
          aria-label={t('mentoring.mentorships.addMenteeTo', {
            name: node.user.name,
          })}
          onClick={() => {
            setAdding((v) => !v);
            assign.reset();
          }}
        >
          <Plus aria-hidden />
          {t('mentoring.mentorships.addMentee')}
        </Button>
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
      {adding && (
        <div className="flex flex-col gap-2 ps-5">
          <label htmlFor={pickerId} className="sr-only">
            {t('mentoring.mentorships.addMenteeTo', { name: node.user.name })}
          </label>
          <UserPicker
            id={pickerId}
            value={null}
            // Picking is the action: assign straight away, or ask first if they have a mentor.
            onChange={(mentee) => mentee && assign.assign(node.user, mentee)}
            excludeIds={[node.user.id, ...node.children.map((c) => c.user.id)]}
            autoFocus
          />
          <FormError
            message={assign.error ? errorMessage(t, assign.error) : undefined}
          />
        </div>
      )}
      {assign.confirmDialog}
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
