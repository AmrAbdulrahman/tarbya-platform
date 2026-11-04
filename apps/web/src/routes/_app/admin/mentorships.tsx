import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Flag, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hierarchyControllerManagement,
  mentorshipsControllerActive,
  mentorshipsControllerEnd,
  type ManagementNodeDto,
  type MentorRefDto,
  type MentorshipDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../../auth/error-message';
import { meQuery } from '../../../auth/session';
import {
  mentorshipsQueryKey,
  useAssignMentee,
} from '../../../components/admin/use-assign-mentee';
import { UserPicker } from '../../../components/admin/user-picker';
import { Field, FormError } from '../../../components/login/fields';
import { Breadcrumbs } from '../../../components/breadcrumbs';

/** US-3.3 · design/screens/Admin.dc.html (assign panel and mentoring tree) */
export const Route = createFileRoute('/_app/admin/mentorships')({
  component: MentorshipsPage,
});

function MentorshipsPage() {
  const { t } = useTranslation();
  return (
    <>
      <Breadcrumbs
        items={[{ label: t('nav.admin') }, { label: t('nav.mentorships') }]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand">
          {t('mentoring.mentorships.title')}
        </h1>
        <p className="text-[15px] text-ink-subtle">
          {t('mentoring.mentorships.lead')}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <AssignCard />
        <TreeSection />
      </div>
    </>
  );
}

type View = 'mentoring' | 'management';

/** The mentoring tree or the management tree: two separate lines, never mixed (BR-MGR-4). */
function TreeSection() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('mentoring');
  const active = useQuery({
    queryKey: mentorshipsQueryKey,
    queryFn: async ({ signal }) =>
      (await mentorshipsControllerActive({ signal })).data as MentorshipDto[],
  });
  const management = useQuery({
    queryKey: ['hierarchy', 'management'],
    queryFn: async ({ signal }) =>
      (await hierarchyControllerManagement({ signal }))
        .data as ManagementNodeDto[],
    enabled: view === 'management',
  });
  const current = view === 'mentoring' ? active : management;

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-base font-bold text-brand">
          {t('mentoring.mentorships.treeTitle')}
        </h2>
        <div
          role="tablist"
          aria-label={t('mentoring.mentorships.treeView')}
          className="inline-flex rounded-full border border-border p-1"
        >
          {(['mentoring', 'management'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'h-8 rounded-full px-4 text-sm font-semibold',
                view !== v && 'text-ink-muted hover:text-primary',
                view === v &&
                  v === 'mentoring' &&
                  'bg-primary text-primary-foreground',
                view === v && v === 'management' && 'bg-manager text-white',
              )}
            >
              {v === 'mentoring'
                ? t('mentoring.mentorships.treeMentoring')
                : t('mentoring.mentorships.treeManagement')}
            </button>
          ))}
        </div>
      </div>
      {current.isPending && (
        <p className="text-ink-subtle">{t('admin.common.loading')}</p>
      )}
      {view === 'mentoring' &&
        active.data &&
        (active.data.length === 0 ? (
          <p className="text-ink-subtle">
            {t('mentoring.mentorships.treeEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {buildTree(active.data).map((n) => (
              <TreeNode key={n.user.id} node={n} />
            ))}
          </ul>
        ))}
      {view === 'management' &&
        management.data &&
        (management.data.length === 0 ? (
          <p className="text-ink-subtle">
            {t('mentoring.mentorships.managementEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {buildManagementTree(management.data).map((n) => (
              <ManagerNode key={n.id} node={n} />
            ))}
          </ul>
        ))}
    </section>
  );
}

interface ManagerTreeNode extends ManagementNodeDto {
  reports: ManagerTreeNode[];
}

function buildManagementTree(nodes: ManagementNodeDto[]): ManagerTreeNode[] {
  const byId = new Map(
    nodes.map((n) => [n.id, { ...n, reports: [] as ManagerTreeNode[] }]),
  );
  const roots: ManagerTreeNode[] = [];
  for (const n of byId.values()) {
    const manager = n.managerId ? byId.get(n.managerId) : undefined;
    if (manager) manager.reports.push(n);
    else roots.push(n);
  }
  return roots;
}

/** The management line in the manager blue, so it never reads as mentoring. */
function ManagerNode({ node }: { node: ManagerTreeNode }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-manager/25 bg-manager-tint/40 px-3 py-2">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-manager-tint text-sm font-bold text-manager"
        >
          {node.name.charAt(0)}
        </span>
        <Link
          to="/people/$id"
          params={{ id: node.id }}
          className="font-semibold text-brand hover:text-manager"
        >
          {node.name}
        </Link>
        {node.reports.length > 0 && (
          <span className="text-[13px] text-manager">
            {t('mentoring.mentorships.reportCount', {
              count: node.reports.length,
            })}
          </span>
        )}
      </div>
      {node.reports.length > 0 && (
        <ul className="flex flex-col gap-2 border-s-2 border-manager/30 ps-5">
          {node.reports.map((r) => (
            <ManagerNode key={r.id} node={r} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** For a mentor who isn't in the tree yet. */
function AssignCard() {
  const { t } = useTranslation();
  const [mentor, setMentor] = useState<UserRefDto | null>(null);
  const [mentee, setMentee] = useState<UserRefDto | null>(null);
  const assign = useAssignMentee(() => setMentee(null));

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
      <h2 className="text-base font-bold text-brand">
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
  /** Mentors carry their direct manager. */
  user: UserRefDto & Partial<Pick<MentorRefDto, 'manager'>>;
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
    const mentor = node(m.mentor);
    // A mentor may have been added first as someone's mentee, without their manager.
    mentor.user = m.mentor;
    mentor.children.push(child);
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
          className="font-semibold text-brand hover:text-primary"
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
        {node.children.length > 0 && (
          <ReportsTo manager={node.user.manager ?? null} />
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

/** On mentors: who they report to in the management line, or a flag when nobody. */
function ReportsTo({ manager }: { manager: UserRefDto | null }) {
  const { t } = useTranslation();
  if (!manager) {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-[13px] font-medium text-warn">
        <Flag className="size-3.5" aria-hidden />
        {t('mentoring.mentorships.noManager')}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-manager-tint px-2.5 text-[13px] text-manager">
      {t('mentoring.mentorships.reportsTo')}
      <Link
        to="/people/$id"
        params={{ id: manager.id }}
        className="font-semibold hover:underline"
      >
        {manager.name}
      </Link>
    </span>
  );
}
