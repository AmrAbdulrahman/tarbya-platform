import { Link, useNavigate } from '@tanstack/react-router';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@tarbya/i18n';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@tarbya/ui';
import { useMe } from '../../auth/session';
import { Avatar } from '../profile/avatar';
import { conversationName, useConversations, when } from './format';

/** The header's messages button: unread badge and the latest conversations (US-7.3). */
export function MessagesMenu() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const navigate = useNavigate();
  const conversations = useConversations();
  const all = conversations.data ?? [];
  const unread = all.filter((c) => c.unread > 0).length;
  const recent = all.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t('header.messages')}${unread ? ` · ${t('messages.unread', { count: unread })}` : ''}`}
        >
          <MessageSquare />
          {unread > 0 && (
            <span className="absolute end-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-trend-down px-1 font-figures text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel className="flex items-center">
          <span className="flex-1 font-bold text-brand">
            {t('messages.title')}
          </span>
          <Link
            to="/messages"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t('messages.all')}
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 && (
          <p className="px-3 py-4 text-sm text-ink-subtle">
            {t('messages.noMessages')}
          </p>
        )}
        {recent.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={() => navigate({ to: '/messages', search: { c: c.id } })}
            className="items-start gap-3 py-2.5"
          >
            <Avatar
              name={conversationName(c)}
              url={c.other?.avatarUrl ?? null}
              className="size-9 shrink-0"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'flex-1 truncate',
                    c.unread ? 'font-bold text-brand' : 'font-semibold',
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
              <span className="truncate text-[13px] text-ink-subtle">
                {c.lastMessage
                  ? `${c.lastMessage.author.id === me.id ? t('messages.you') : ''}${c.lastMessage.body}`
                  : t('messages.noMessages')}
              </span>
            </span>
            {c.unread > 0 && (
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
