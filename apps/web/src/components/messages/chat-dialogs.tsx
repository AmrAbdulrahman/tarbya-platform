import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  messagesControllerAddMembers,
  messagesControllerContacts,
  messagesControllerCreateChat,
  messagesControllerLeave,
  messagesControllerMembers,
  type ConversationDto,
  type ConversationRefDto,
  type PersonRefDto,
} from '@tarbya/api-client';
import { Button, Dialog, DialogContent, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { Field, FormError } from '../login/fields';
import { PersonSearch } from '../person-search';
import { Avatar } from '../profile/avatar';
import { conversationName, conversationsQueryKey } from './format';

const searchContacts = async (q: string, signal: AbortSignal) =>
  (await messagesControllerContacts({ q }, { signal })).data as PersonRefDto[];

/** People picked so far, each removable. */
function PickedPeople({
  people,
  onRemove,
}: {
  people: PersonRefDto[];
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (!people.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {people.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-1.5 rounded-full bg-primary-tint py-1 pe-1 ps-1.5 text-sm text-primary-hover"
        >
          <Avatar name={p.name} url={p.avatarUrl} className="size-6" />
          {p.name}
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            aria-label={t('messages.chat.remove', { name: p.name })}
            className="grid size-6 place-items-center rounded-full hover:bg-primary/10"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Starts a group chat: a name and the people in it (BR-MSG-4). */
export function NewChatDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [people, setPeople] = useState<PersonRefDto[]>([]);
  const create = useMutation({
    mutationFn: async () =>
      (
        await messagesControllerCreateChat({
          title,
          userIds: people.map((p) => p.id),
        })
      ).data as ConversationRefDto,
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      setTitle('');
      setPeople([]);
      onCreated(id);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() && people.length) create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('messages.chat.new')}
        closeLabel={t('admin.common.close')}
        className="min-h-[min(28rem,90vh)]"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field id="chat-title" label={t('messages.chat.name')}>
            <Input
              id="chat-title"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-muted">
              {t('messages.chat.people')}
            </span>
            <PersonSearch
              queryKey="chat-contacts"
              label={t('messages.chat.add')}
              placeholder={t('messages.chat.add')}
              search={searchContacts}
              onPick={(p) =>
                setPeople((list) =>
                  list.some((x) => x.id === p.id) ? list : [...list, p],
                )
              }
            />
            <PickedPeople
              people={people}
              onRemove={(id) =>
                setPeople((list) => list.filter((p) => p.id !== id))
              }
            />
          </div>
          <FormError
            message={create.isError ? errorMessage(t, create.error) : undefined}
          />
          <Button
            type="submit"
            className="self-start"
            disabled={!title.trim() || !people.length || create.isPending}
          >
            {t('messages.chat.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Who's in a conversation. In a chat, any member adds people (who see what's
 * written from then on) or leaves.
 */
export function MembersDialog({
  conversation: c,
  open,
  onOpenChange,
  onLeft,
}: {
  conversation: ConversationDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeft: () => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const queryClient = useQueryClient();
  const queryKey = ['conversation-members', c.id];
  const members = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await messagesControllerMembers(c.id, { signal }))
        .data as PersonRefDto[],
    enabled: open,
  });
  const isChat = c.kind === 'CHAT';
  const add = useMutation({
    mutationFn: (userId: string) =>
      messagesControllerAddMembers(c.id, { userIds: [userId] }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
      ]),
  });
  const leave = useMutation({
    mutationFn: () => messagesControllerLeave(c.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      onLeft();
    },
  });
  const error = add.error ?? leave.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={conversationName(c)}
        closeLabel={t('admin.common.close')}
        className="min-h-[min(28rem,90vh)]"
      >
        <div className="flex flex-col gap-4">
          {isChat && (
            <div className="flex flex-col gap-1.5">
              <PersonSearch
                queryKey="chat-contacts"
                label={t('messages.chat.add')}
                placeholder={t('messages.chat.add')}
                search={searchContacts}
                onPick={(p) => add.mutate(p.id)}
              />
              <p className="text-[13px] text-ink-subtle">
                {t('messages.chat.addHint')}
              </p>
            </div>
          )}
          <h3 className="text-sm font-semibold text-ink-muted">
            {t('groups.members', { count: members.data?.length ?? 0 })}
          </h3>
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {members.data?.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar name={p.name} url={p.avatarUrl} className="size-8" />
                <span className="text-[15px]">
                  {p.name}
                  {p.id === me.id && (
                    <span className="text-ink-subtle">
                      {' '}
                      ({t('messages.chat.me')})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <FormError message={error ? errorMessage(t, error) : undefined} />
          {isChat && (
            <Button
              variant="outline"
              className="self-start"
              disabled={leave.isPending}
              onClick={() => leave.mutate()}
            >
              <LogOut className="rtl:-scale-x-100" aria-hidden />
              {t('messages.chat.leave')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
