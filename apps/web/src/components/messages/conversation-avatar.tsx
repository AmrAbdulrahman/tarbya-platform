import { Users } from 'lucide-react';
import type { ConversationDto } from '@tarbya/api-client';
import { cn } from '@tarbya/ui';
import { Avatar } from '../profile/avatar';
import { conversationName } from './format';

/**
 * The picture beside a conversation: the other person's in a direct one; in a
 * group's or a chat, a rounded square with people in it, so they never pass for
 * one person (green for a group, gold for a chat).
 */
export function ConversationAvatar({
  conversation: c,
  className,
}: {
  conversation: ConversationDto;
  className?: string;
}) {
  if (c.kind !== 'GROUP' && c.kind !== 'CHAT')
    return (
      <Avatar
        name={conversationName(c)}
        url={c.other?.avatarUrl ?? null}
        className={className}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        c.kind === 'GROUP'
          ? 'bg-brand text-white'
          : 'bg-accent-tint text-accent-strong ring-1 ring-accent/40',
        className,
      )}
    >
      <Users className="size-[55%]" />
    </span>
  );
}
