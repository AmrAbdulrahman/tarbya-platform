import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RolesService } from '../modules/users/roles.service';
import { AppException } from './app-exception';

export type Access = 'admin' | 'superAdmin';
const ACCESS = 'access';

/**
 * Who may call a route beyond being signed in.
 * `admin`: super admin or moderator. `superAdmin`: only the super admin.
 */
export const Requires = (access: Access) => SetMetadata(ACCESS, access);

const NOT_IMPERSONATING = 'notImpersonating';

/** Refused while the super admin impersonates someone: their sign-in details stay theirs. */
export const NotWhileImpersonating = () => SetMetadata(NOT_IMPERSONATING, true);

export const forbidden = () =>
  new AppException(403, { code: 'FORBIDDEN', title: 'Not allowed' });

/** Global; runs after the auth guard and checks @Requires() and @NotWhileImpersonating(). */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (
      this.reflector.getAllAndOverride<boolean>(NOT_IMPERSONATING, targets) &&
      context.switchToHttp().getRequest<Request>().auth?.impersonatorId
    ) {
      throw new AppException(403, {
        code: 'IMPERSONATION_RESTRICTED',
        title: 'Not available while impersonating',
      });
    }
    const access = this.reflector.getAllAndOverride<Access | undefined>(
      ACCESS,
      [context.getHandler(), context.getClass()],
    );
    if (!access) return true;
    const auth = context.switchToHttp().getRequest<Request>().auth;
    if (!auth) throw forbidden();

    const allowed =
      access === 'admin'
        ? await this.roles.isAdmin(auth.userId)
        : await this.roles.isSuperAdminUser(auth.userId);
    if (!allowed) throw forbidden();
    return true;
  }
}
