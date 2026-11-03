import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import {
  Bell,
  LogOut,
  MessageSquare,
  MonitorX,
  Search,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tarbya/ui';
import { useMe, useSignOut } from '../auth/session';
import { ImpersonateButton, ImpersonationBanner } from './impersonation';
import { LanguageSwitch } from './language-switch';
import { Avatar } from './profile/avatar';
import { sectionsFor } from './nav';

/** Sidebar with one section per role, plus the sticky header (design/screens/Main.dc.html). */
export function AppShell() {
  const { t } = useTranslation();
  const me = useMe();

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      <nav
        aria-label={t('app.name')}
        // From md up the sidebar stays put and scrolls on its own; below that it stacks above the page.
        className="flex flex-col gap-4 border-e border-border bg-card px-4 py-6 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto"
      >
        <div className="flex items-center gap-2.5 px-2">
          <div className="grid size-9 place-items-center rounded-card bg-primary text-lg font-bold text-primary-foreground">
            ت
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-navy">
              {t('app.name')}
            </span>
            <span className="text-xs text-ink-subtle">{t('app.tagline')}</span>
          </div>
        </div>
        {sectionsFor(me.roles).map((section, i) => (
          <div
            key={section.title}
            className={
              i
                ? 'flex flex-col gap-1 border-t border-divider pt-4'
                : 'flex flex-col gap-1'
            }
          >
            <span className="px-3.5 pb-1 text-xs font-semibold text-ink-subtle">
              {t(section.title)}
            </span>
            {section.items.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-[15px] font-medium text-ink hover:bg-surface hover:text-primary"
                activeProps={{
                  className: 'bg-primary-tint text-primary-hover',
                }}
                activeOptions={{ exact: true }}
              >
                <item.icon className="size-5" aria-hidden />
                {t(item.label)}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20">
          <ImpersonationBanner />
          <header className="flex h-14 items-center gap-3 border-b border-border bg-card/95 px-6 backdrop-blur">
            <label className="relative flex-[0_1_380px]">
              <span className="sr-only">{t('header.search')}</span>
              <input
                type="search"
                placeholder={t('header.search')}
                className="h-10 w-full rounded-control border border-border bg-card pe-3 ps-10 text-[15px]"
              />
              <Search
                className="pointer-events-none absolute start-3 top-2.5 size-5 text-ink-subtle"
                aria-hidden
              />
            </label>
            <div className="flex-1" />
            <ImpersonateButton />
            <LanguageSwitch />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('header.messages')}
            >
              <MessageSquare />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('header.notifications')}
            >
              <Bell />
            </Button>
            <AccountMenu />
          </header>
        </div>
        <main className="flex flex-col gap-4 px-6 pb-10 pt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AccountMenu() {
  const { t } = useTranslation();
  const me = useMe();
  const signOut = useSignOut();
  const signOutEverywhere = useSignOut(true);
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('account.menu')}
          className="shrink-0 rounded-full hover:ring-2 hover:ring-primary/30"
        >
          <Avatar name={me.name} url={me.avatarUrl} className="size-10" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="font-semibold text-navy">{me.name}</div>
          {me.email && (
            <div dir="ltr" className="text-start text-xs text-ink-subtle">
              {me.email}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/profile' })}>
          <UserRound aria-hidden />
          {t('me.profileLink')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut.mutate()}>
          <LogOut aria-hidden />
          {t('account.signOut')}
        </DropdownMenuItem>
        {/* Not while impersonating: those sessions belong to the super admin. */}
        {!me.impersonator && (
          <DropdownMenuItem onSelect={() => signOutEverywhere.mutate()}>
            <MonitorX aria-hidden />
            {t('account.signOutEverywhere')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
