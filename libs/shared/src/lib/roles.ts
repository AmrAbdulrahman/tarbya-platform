/**
 * Roles are derived from relationships (BR-USR-5), never stored as a column.
 * Listed from strongest to weakest; the first one a user holds picks their home page.
 */
export const ROLES = [
  'SUPER_ADMIN',
  'MODERATOR',
  'MANAGER',
  'GROUP_ADMIN',
  'GROUP_MODERATOR',
  'MENTOR',
  'MENTEE',
] as const;

export type Role = (typeof ROLES)[number];

/** Roles the `auth.signInRoles` setting can open sign-in to (BR-AUTH-2). */
export const SIGN_IN_ROLES = ROLES.filter((r) => r !== 'SUPER_ADMIN');

/** The super admin can always sign in; everyone else needs a role the setting allows. */
export function canSignIn(
  roles: readonly Role[],
  allowed: readonly Role[],
): boolean {
  return (
    roles.includes('SUPER_ADMIN') || roles.some((r) => allowed.includes(r))
  );
}

export function hasAnyRole(
  roles: readonly Role[],
  wanted: readonly Role[],
): boolean {
  return roles.some((r) => wanted.includes(r));
}
