import type { TFunction } from 'i18next';
import type { UserRefDto } from '@tarbya/api-client';

/**
 * Who did something, for bylines: the author's name, or "X on behalf of Y"
 * when the super admin did it while impersonating them (BR-ADM-5).
 */
export function actedBy(
  t: TFunction,
  author: Pick<UserRefDto, 'name'>,
  impersonator?: Pick<UserRefDto, 'name'> | null,
): string {
  return impersonator
    ? t('impersonation.onBehalf', {
        actor: impersonator.name,
        user: author.name,
      })
    : author.name;
}
