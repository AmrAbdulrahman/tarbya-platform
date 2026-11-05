import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import {
  messagesControllerList,
  type ConversationDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDayTile, formatTime, toZoned } from '@tarbya/shared';

export const conversationsQueryKey = ['conversations'];

/** Every conversation the user takes part in; refetched on live events. */
export function useConversations() {
  return useQuery({
    queryKey: conversationsQueryKey,
    queryFn: async ({ signal }) =>
      (await messagesControllerList({ signal })).data as ConversationDto[],
  });
}

/** The other person's name, or the group's. */
export const conversationName = (c: ConversationDto) =>
  c.other?.name ?? c.group?.name ?? '';

/** The second line under the name: how they relate to me, or the group's size. */
export function conversationRole(t: TFunction, c: ConversationDto): string {
  if (c.relation) return t(`messages.relation.${c.relation}`);
  if (c.group)
    return `${t('groups.eyebrow')} · ${t('groups.members', { count: c.memberCount ?? 0 })}`;
  return '';
}

/** The time for today's messages, else the day. */
export function when(at: string, locale: Language): string {
  if (toZoned(new Date(at)).date === toZoned(new Date()).date)
    return formatTime(at, { locale });
  const tile = formatDayTile(at, { locale });
  return `${tile.day} ${tile.month}`;
}
