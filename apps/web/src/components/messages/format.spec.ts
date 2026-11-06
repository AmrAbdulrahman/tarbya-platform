import type { ConversationDto } from '@tarbya/api-client';
import type { TFunction } from 'i18next';
import { conversationName, conversationRole, when } from './format';

const base: ConversationDto = {
  id: 'c',
  kind: 'DIRECT',
  other: { id: 'u', name: 'Yousef', avatarUrl: null },
  relation: 'MY_MENTEE',
  group: null,
  title: null,
  memberCount: null,
  lastMessage: null,
  unread: 0,
  canPost: true,
};
const t = ((key: string, o?: { count?: number }) =>
  o?.count !== undefined ? `${key}:${o.count}` : key) as unknown as TFunction;

describe('conversation formatting (US-7.3)', () => {
  it('names a direct conversation after the other person and says how they relate', () => {
    expect(conversationName(base)).toBe('Yousef');
    expect(conversationRole(t, base)).toBe('messages.relation.MY_MENTEE');
  });

  it('names a group conversation after the group, with its size', () => {
    const group = {
      ...base,
      kind: 'GROUP' as const,
      other: null,
      relation: null,
      group: { id: 'g', name: 'Tuesday circle' },
      memberCount: 14,
    };
    expect(conversationName(group)).toBe('Tuesday circle');
    expect(conversationRole(t, group)).toBe(
      'groups.eyebrow · groups.members:14',
    );
  });

  it('names a group chat after its title, with its size', () => {
    const chat = {
      ...base,
      kind: 'CHAT' as const,
      other: null,
      relation: null,
      title: 'Trip planning',
      memberCount: 4,
    };
    expect(conversationName(chat)).toBe('Trip planning');
    expect(conversationRole(t, chat)).toBe(
      'messages.chat.kind · groups.members:4',
    );
  });

  it('shows the time for today and the day otherwise', () => {
    expect(when(new Date().toISOString(), 'en')).toMatch(/^\d{2}:\d{2}$/);
    expect(when('2020-01-15T10:00:00Z', 'en')).toBe('15 Jan');
  });
});
