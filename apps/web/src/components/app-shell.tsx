import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { Bell, LogOut, Menu, MonitorX, Search, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@tarbya/ui';
import { useMe, useSignOut } from '../auth/session';
import { ImpersonateButton, ImpersonationBanner } from './impersonation';
import { LanguageSwitch } from './language-switch';
import { LogoMark } from './logo';
import { LogProvider } from './mentor/log-dialog';
import { MessagesMenu } from './messages/messages-menu';
import { useLiveEvents } from '../lib/live-events';
import { Avatar } from './profile/avatar';
import { sectionsFor } from './nav';

/**
 * Sidebar with one section per role, plus the sticky header (design/screens/Main.dc.html).
 * Below md the sidebar moves into a drawer opened from the header's menu button.
 */
export function AppShell() {
  const { t } = useTranslation();
  const top = useStickyHeight();
  const [menuOpen, setMenuOpen] = useState(false);
  const me = useMe();
  useLiveEvents(me.id);

  return (
    <LogProvider>
      <div className="pattern-corner pattern-fixed flex min-h-screen bg-surface [--pattern-opacity:0.3]">
        {/* From md up the sidebar stays put and scrolls on its own. */}
        <nav
          aria-label={t('app.name')}
          className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-e border-border bg-card px-4 py-6 md:block"
        >
          <NavContent />
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={top} className="sticky top-0 z-20">
            <ImpersonationBanner />
            <header className="flex h-14 items-center gap-1 border-b border-border bg-card/95 px-4 backdrop-blur sm:gap-3 md:px-6">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('header.menu')}
                    className="md:hidden"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  title={t('header.menu')}
                  closeLabel={t('admin.common.close')}
                  className="px-4 py-6"
                >
                  <nav aria-label={t('app.name')}>
                    <NavContent onNavigate={() => setMenuOpen(false)} />
                  </nav>
                </SheetContent>
              </Sheet>
              <Link to="/" aria-label={t('app.name')} className="md:hidden">
                <LogoMark className="h-8 w-auto" />
              </Link>
              <label className="relative hidden flex-[0_1_380px] md:block">
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
              <MessagesMenu />
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
          {/* Room at the bottom for the mentor's "+" button. */}
          <main className="flex flex-col gap-4 px-4 pb-24 pt-4 md:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </LogProvider>
  );
}

/** Brand and one link section per role; shared by the sidebar and the mobile drawer. */
function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const me = useMe();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 px-2">
        <LogoMark className="h-10 w-auto shrink-0" />
        <div className="flex flex-col">
          <span className="text-base font-bold text-brand">
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
              onClick={onNavigate}
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
    </div>
  );
}

/**
 * Keeps `--app-top` at the height of the sticky header (and the impersonation
 * banner, when shown), so page headers can stick just below it.
 */
function useStickyHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty('--app-top', `${el.offsetHeight}px`),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--app-top');
    };
  }, []);
  return ref;
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
          <div className="font-semibold text-brand">{me.name}</div>
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
