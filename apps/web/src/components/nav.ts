import {
  ClipboardList,
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

export interface NavItem {
  label: ParseKeys;
  to: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: ParseKeys;
  items: NavItem[];
}

// Every section shows until auth exists; then each is shown only for the roles the user holds.
// Links point at "/" until each screen's route lands.
export const navSections: NavSection[] = [
  {
    title: 'nav.admin',
    items: [
      { label: 'nav.users', to: '/', icon: UserPlus },
      { label: 'nav.mentorships', to: '/', icon: ListTree },
      { label: 'nav.groups', to: '/', icon: CircleDot },
      { label: 'nav.lookups', to: '/', icon: ClipboardList },
    ],
  },
  {
    title: 'nav.myMentees',
    items: [
      { label: 'nav.menteeDashboard', to: '/', icon: LayoutDashboard },
      { label: 'nav.followUps', to: '/', icon: Calendar },
    ],
  },
  {
    title: 'nav.myJourney',
    items: [
      { label: 'nav.myPlans', to: '/', icon: TrendingUp },
      { label: 'nav.reportToMentor', to: '/', icon: MessageSquareText },
      { label: 'nav.myGroups', to: '/', icon: Users },
    ],
  },
];
