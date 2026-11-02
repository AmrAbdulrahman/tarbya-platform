import { useTranslation } from 'react-i18next';
import type { Role } from '@tarbya/shared';
import { Badge } from '@tarbya/ui';

// Managers keep the tone the management tree uses for them.
const toneOf: Record<Role, 'primary' | 'manager' | 'neutral'> = {
  SUPER_ADMIN: 'primary',
  MODERATOR: 'primary',
  MANAGER: 'manager',
  GROUP_ADMIN: 'neutral',
  GROUP_MODERATOR: 'neutral',
  MENTOR: 'neutral',
  MENTEE: 'neutral',
};

/** A user's derived roles (BR-USR-5), one chip each. */
export function RoleChips({ roles }: { roles: readonly Role[] }) {
  const { t } = useTranslation();
  return roles.map((r) => (
    <Badge key={r} tone={toneOf[r]}>
      {t(`admin.roles.${r}`)}
    </Badge>
  ));
}
