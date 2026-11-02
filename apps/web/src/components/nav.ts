import {
  ClipboardList,
  Settings,
  Calendar,
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
      { label: 'nav.mentorships', to: '/', icon: ListTree },
      { label: 'nav.groups', to: '/', icon: CircleDot },
      { label: 'nav.lookups', to: '/admin/lookups', icon: ClipboardList },
      { label: 'nav.settings', to: '/admin/settings', icon: Settings },
    ],
  },
  {
    title: 'nav.myMentees',
    roles: ['MENTOR'],
    items: [
      { label: 'nav.menteeDashboard', to: '/', icon: LayoutDashboard },
      { label: 'nav.followUps', to: '/', icon: Calendar },
    ],
  },
  {
    title: 'nav.myJourney',
    roles: ['MENTEE'],
    items: [
      { label: 'nav.myPlans', to: '/', icon: TrendingUp },
      { label: 'nav.reportToMentor', to: '/', icon: MessageSquareText },
      { label: 'nav.myGroups', to: '/', icon: Users },
    ],
  },
];

export function sectionsFor(roles: readonly Role[]): NavSection[] {
  return navSections.filter((section) => hasAnyRole(roles, section.roles));
}
