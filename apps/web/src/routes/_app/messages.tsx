import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Search, SquarePen, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  messagesControllerContacts,
  messagesControllerDirect,
  type ConversationRefDto,
  type PersonRefDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { matchesSearch } from '@tarbya/shared';
import { Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import {
  conversationName,
  conversationRole,
  conversationsQueryKey,
  useConversations,
  when,
} from '../../components/messages/format';
import { FormError } from '../../components/login/fields';
import { NewChatDialog } from '../../components/messages/chat-dialogs';
import { PersonSearch } from '../../components/person-search';
import { Thread } from '../../components/messages/thread';
import { ConversationAvatar } from '../../components/messages/conversation-avatar';
import { PageHeader } from '../../components/page-header';

/** US-7.3 · design/screens/Messages.dc.html */
export const Route = createFileRoute('/_app/messages')({
  validateSearch: (search: Record<string, unknown>): { c?: string } =>
    typeof search['c'] === 'string' ? { c: search['c'] } : {},
  component: MessagesPage,
});

function MessagesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const { c: selected } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [starting, setStarting] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const conversations = useConversations();
  const all = conversations.data ?? [];
  const shown = all.filter((c) => matchesSearch(q, conversationName(c)));
  const current = all.find((c) => c.id === selected);
  const pick = (c?: string) => navigate({ search: c ? { c } : {} });
  const start = useMutation({
    mutationFn: async (userId: string) =>
      (await messagesControllerDirect({ userId })).data as ConversationRefDto,
    onSuccess: async ({ id }) => {
      setStarting(false);
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      await pick(id);
    },
  });

  return (
    <>
      <PageHeader>
        <h1 className="text-2xl font-bold text-brand">{t('messages.title')}</h1>
      </PageHeader>
      <div className="flex h-[calc(100dvh-var(--app-top,56px)-11rem)] min-h-[480px] overflow-hidden rounded-card border border-border bg-card">
        <aside
          className={cn(
            'flex w-full flex-col border-e border-border md:w-80 md:shrink-0',
            current && 'hidden md:flex',
          )}
        >
          <div className="m-3 flex items-center gap-2">
            {starting ? (
              <PersonSearch
                queryKey="contacts"
                label={t('messages.newWith')}
                placeholder={t('messages.newWith')}
                className="flex-1"
                autoFocus
                search={async (text, signal) =>
                  (await messagesControllerContacts({ q: text }, { signal }))
                    .data as PersonRefDto[]
                }
                onPick={(p) => start.mutate(p.id)}
              />
            ) : (
              <label className="relative flex-1">
                <span className="sr-only">{t('messages.search')}</span>
                <input
                  type="search"
                  placeholder={t('messages.search')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-10 w-full rounded-control border border-border bg-card pe-3 ps-10 text-[15px]"
                />
                <Search
                  className="pointer-events-none absolute start-3 top-2.5 size-5 text-ink-subtle"
                  aria-hidden
                />
              </label>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={
                starting ? t('admin.common.cancel') : t('messages.new')
              }
              title={starting ? t('admin.common.cancel') : t('messages.new')}
              onClick={() => {
                start.reset();
                setStarting((v) => !v);
              }}
            >
              {starting ? <X aria-hidden /> : <SquarePen aria-hidden />}
            </Button>
            {!starting && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t('messages.chat.new')}
                title={t('messages.chat.new')}
                onClick={() => setNewChat(true)}
              >
                <Users aria-hidden />
              </Button>
            )}
          </div>
          <NewChatDialog
            open={newChat}
            onOpenChange={setNewChat}
            onCreated={(id) => {
              setNewChat(false);
              void pick(id);
            }}
          />
          {start.isError && (
            <div className="px-4 pb-2">
              <FormError message={errorMessage(t, start.error)} />
            </div>
          )}
          {conversations.isError && (
            <p className="px-4 text-sm text-ink-subtle">
              {errorMessage(t, conversations.error)}
            </p>
          )}
          {conversations.isSuccess && shown.length === 0 && (
            <p className="px-4 text-sm text-ink-subtle">
              {all.length ? t('messages.noMatch') : t('messages.none')}
            </p>
          )}
          <ul className="flex-1 overflow-y-auto">
            {shown.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={c.id === selected || undefined}
                  onClick={() => pick(c.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-divider px-4 py-3 text-start hover:bg-surface',
                    c.id === selected && 'bg-primary-tint/60',
                  )}
                >
                  <ConversationAvatar
                    conversation={c}
                    className="size-10 shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          'flex-1 truncate text-[15px] text-brand',
                          c.unread ? 'font-bold' : 'font-semibold',
                        )}
                      >
                        {conversationName(c)}
                      </span>
                      {c.lastMessage && (
                        <span className="shrink-0 text-xs text-ink-subtle">
                          {when(c.lastMessage.at, locale)}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-ink-subtle">
                      {conversationRole(t, c)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex-1 truncate text-[13px]',
                          c.unread ? 'text-ink' : 'text-ink-subtle',
                        )}
                      >
                        {c.lastMessage
                          ? `${c.lastMessage.author.id === me.id ? t('messages.you') : ''}${c.lastMessage.body}`
                          : t('messages.noMessages')}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 font-figures text-[11px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {current ? (
          <Thread
            key={current.id}
            conversation={current}
            onBack={() => pick()}
          />
        ) : (
          <p className="m-auto hidden text-ink-subtle md:block">
            {t('messages.pick')}
          </p>
        )}
      </div>
    </>
  );
}
