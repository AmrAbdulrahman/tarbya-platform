import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  usersControllerList,
  type UserDto,
  type UserPageDto,
} from '@tarbya/api-client';
import { Badge, Button, Input } from '@tarbya/ui';
import { UserDialog } from '../../../components/admin/user-dialog';
import { useDebounced } from '../../../lib/use-debounced';

/** US-3.1 · design/screens/Admin.dc.html (users table) */
export const Route = createFileRoute('/_app/admin/users')({
  component: UsersPage,
});

function UsersPage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 250);
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null);

  const users = useInfiniteQuery({
    queryKey: ['users', q],
    queryFn: async ({ pageParam, signal }) =>
      (
        await usersControllerList(
          { q: q || undefined, cursor: pageParam, limit: 25 },
          { signal },
        )
      ).data as UserPageDto,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-navy">
          {t('admin.users.title')}
        </h1>
        <p className="text-[15px] text-ink-subtle">{t('admin.users.lead')}</p>
      </div>

      <section className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-divider px-6 py-4">
          <label className="relative flex-[1_1_280px]">
            <span className="sr-only">{t('admin.users.searchLabel')}</span>
            <Input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('admin.users.search')}
              className="h-11 ps-10 text-[15px]"
            />
            <Search
              className="pointer-events-none absolute start-3 top-3 size-5 text-ink-subtle"
              aria-hidden
            />
          </label>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('admin.users.add')}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[15px]">
            <thead className="bg-surface text-start text-[13px] font-semibold text-ink-subtle">
              <tr>
                {(
                  [
                    'name',
                    'roles',
                    'manager',
                    'phone',
                    'email',
                    'signIn',
                  ] as const
                ).map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-6 py-3 text-start font-semibold"
                  >
                    {t(`admin.users.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <UserRow key={u.id} user={u} onOpen={() => setEditing(u)} />
              ))}
            </tbody>
          </table>
        </div>
        {users.isPending && (
          <p className="px-6 py-5 text-ink-subtle">
            {t('admin.common.loading')}
          </p>
        )}
        {users.isSuccess && rows.length === 0 && (
          <p className="px-6 py-5 text-ink-subtle">{t('admin.users.empty')}</p>
        )}
        {users.hasNextPage && (
          <div className="border-t border-divider px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => users.fetchNextPage()}
              disabled={users.isFetchingNextPage}
            >
              {t('admin.common.loadMore')}
            </Button>
          </div>
        )}
      </section>

      <UserDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing === 'new' || editing === null ? undefined : editing}
      />
    </>
  );
}

function UserRow({ user, onOpen }: { user: UserDto; onOpen: () => void }) {
  const { t } = useTranslation();
  const muted = 'text-ink-subtle/70';
  return (
    <tr className="border-t border-divider hover:bg-slate-50">
      <td className="px-6 py-3.5">
        <button
          type="button"
          onClick={onOpen}
          className="text-start font-semibold text-navy hover:text-primary"
        >
          {user.name}
        </button>
      </td>
      <td className="px-6 py-3.5 text-ink-muted">
        {user.roles.length ? (
          user.roles.map((r) => t(`admin.roles.${r}`)).join(' · ')
        ) : (
          <span className={muted}>{t('admin.roles.none')}</span>
        )}
      </td>
      <td className="px-6 py-3.5">
        {user.manager ? (
          user.manager.name
        ) : (
          <span className={muted}>{t('admin.users.topLevel')}</span>
        )}
      </td>
      <td className="px-6 py-3.5">
        {user.phone ? (
          <bdi>{user.phone}</bdi>
        ) : (
          <span className={muted}>{t('admin.common.none')}</span>
        )}
      </td>
      <td className="px-6 py-3.5">
        {user.email ? (
          <bdi>{user.email}</bdi>
        ) : (
          <span className={muted}>{t('admin.common.none')}</span>
        )}
      </td>
      <td className="px-6 py-3.5">
        {user.deactivatedAt ? (
          <Badge tone="danger">{t('admin.users.deactivated')}</Badge>
        ) : user.canSignIn ? (
          <Badge tone="success">{t('admin.users.canSignIn')}</Badge>
        ) : (
          <Badge>{t('admin.users.cannotSignIn')}</Badge>
        )}
      </td>
    </tr>
  );
}
