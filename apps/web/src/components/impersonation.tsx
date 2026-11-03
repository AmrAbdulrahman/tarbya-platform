import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  authControllerImpersonate,
  authControllerStopImpersonating,
  type MeDto,
} from '@tarbya/api-client';
import { Button, Dialog, DialogContent } from '@tarbya/ui';
import { errorMessage } from '../auth/error-message';
import { meQuery, useMe } from '../auth/session';
import { UserPicker } from './admin/user-picker';
import { FormError } from './login/fields';

/**
 * Swaps the signed-in view: keeps the new `me`, drops everything cached for
 * the previous one, and goes to the new user's home.
 */
function useSwitchView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (me: MeDto) => {
    queryClient.setQueryData(meQuery.queryKey, me);
    queryClient.removeQueries({
      predicate: (q) => q.queryKey[0] !== meQuery.queryKey[0],
    });
    await navigate({ to: '/' });
  };
}

/** Header button for the super admin: view the app as another user. */
export function ImpersonateButton() {
  const { t } = useTranslation();
  const me = useMe();
  const switchView = useSwitchView();
  const [open, setOpen] = useState(false);
  const start = useMutation({
    mutationFn: async (userId: string) =>
      (await authControllerImpersonate({ userId })).data as MeDto,
    onSuccess: async (next) => {
      setOpen(false);
      await switchView(next);
    },
  });

  if (!me.roles.includes('SUPER_ADMIN') || me.impersonator) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('impersonation.action')}
        title={t('impersonation.action')}
        onClick={() => {
          start.reset();
          setOpen(true);
        }}
      >
        <Eye />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={t('impersonation.title')}
          description={t('impersonation.hint')}
          closeLabel={t('admin.common.close')}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="impersonate-user" className="text-sm font-semibold">
              {t('impersonation.user')}
            </label>
            <UserPicker
              id="impersonate-user"
              value={null}
              onChange={(user) => user && start.mutate(user.id)}
              excludeIds={[me.id]}
              autoFocus
            />
            <FormError
              message={start.isError ? errorMessage(t, start.error) : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Always on top while impersonating, with the way back. */
export function ImpersonationBanner() {
  const { t } = useTranslation();
  const me = useMe();
  const switchView = useSwitchView();
  const stop = useMutation({
    mutationFn: async () =>
      (await authControllerStopImpersonating()).data as MeDto,
    onSuccess: switchView,
  });

  if (!me.impersonator) return null;
  return (
    <div
      role="region"
      aria-label={t('impersonation.mode')}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-warn px-10 py-2.5 text-white max-md:px-4"
    >
      <Eye className="size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-[15px]">
        <strong>{t('impersonation.banner', { name: me.name })}</strong>{' '}
        <span className="opacity-90">
          {t('impersonation.signedInAs', { name: me.impersonator.name })}
        </span>
      </p>
      {stop.isError && (
        <span role="alert" className="text-sm">
          {errorMessage(t, stop.error)}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="border-white bg-white text-warn hover:bg-white/90 hover:text-warn"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
      >
        <LogOut aria-hidden />
        {t('impersonation.exit')}
      </Button>
    </div>
  );
}
