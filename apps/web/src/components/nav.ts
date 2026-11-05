import {
  BookMarked,
  ClipboardList,
  Settings,
  Compass,
  CircleDot,
  LayoutDashboard,
  ListTree,
  MessageSquareText,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ParseKeys } from 'i18next';
import { hasAnyRole, type Role } from '@tarbya/shared';

export interface NavItem {
  label: ParseKeys;
  to: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: ParseKeys;
  /** The section shows when the user holds any of these roles. */
  roles: Role[];
  items: NavItem[];
}

// Links point at "/" until each screen's route lands.
export const navSections: NavSection[] = [
  {
    title: 'nav.admin',
    roles: ['SUPER_ADMIN', 'MODERATOR'],
    items: [
      { label: 'nav.users', to: '/admin/users', icon: UserPlus },
      { label: 'nav.mentorships', to: '/admin/mentorships', icon: ListTree },
      { label: 'nav.groups', to: '/groups', icon: CircleDot },
      { label: 'nav.lookups', to: '/admin/lookups', icon: ClipboardList },
      { label: 'nav.settings', to: '/admin/settings', icon: Settings },
    ],
  },
  {
    title: 'nav.myMentees',
    roles: ['MENTOR'],
    items: [
      { label: 'nav.menteeDashboard', to: '/mentor', icon: LayoutDashboard },
      { label: 'nav.library', to: '/trackables/library', icon: BookMarked },
    ],
  },
  {
    // Group admins and moderators, and managers who see their team's groups (BR-GRP-4).
    title: 'nav.groups',
    roles: ['GROUP_ADMIN', 'GROUP_MODERATOR', 'MANAGER'],
    items: [{ label: 'nav.myGroups', to: '/groups', icon: Users }],
  },
  {
    title: 'nav.myJourney',
    roles: ['MENTEE'],
    items: [
      { label: 'nav.journeyOverview', to: '/my', icon: Compass },
      { label: 'nav.myPlans', to: '/my/trackables', icon: TrendingUp },
      { label: 'nav.reportToMentor', to: '/', icon: MessageSquareText },
      { label: 'nav.myGroups', to: '/groups', icon: Users },
    ],
  },
];

/** The sections for the roles a user holds; a link shows once, in the first section that has it. */
export function sectionsFor(roles: readonly Role[]): NavSection[] {
  const seen = new Set<string>();
  return navSections
    .filter((section) => hasAnyRole(roles, section.roles))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (seen.has(item.to)) return false;
        seen.add(item.to);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * US-1.1: where "/" takes someone, from their strongest role (roles are listed
 * strongest first): the console for admins, the dashboard for mentors, the
 * journey for mentees. Null when there is nothing to show yet.
 */
export function homeFor(roles: readonly Role[]): string | null {
  if (hasAnyRole(roles, ['SUPER_ADMIN', 'MODERATOR'])) return '/admin/users';
  if (hasAnyRole(roles, ['MENTOR'])) return '/mentor';
  if (hasAnyRole(roles, ['MENTEE'])) return '/my';
  return null;
}
