import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  notificationsControllerPreferences,
  notificationsControllerUpdatePreferences,
  type PreferenceDto,
} from '@tarbya/api-client';
import { NOTIFICATION_CATEGORY } from '@tarbya/shared';
import { errorMessage } from '../../auth/error-message';
import { FormError } from '../login/fields';
import { Section } from './section';

const queryKey = ['notifications', 'preferences'];
const GROUPS = ['mentees', 'journey', 'groups', 'other'] as const;

/** US-2.4: in-app and email per notification type; mandatory ones are locked on in-app. */
export function NotificationsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const prefs = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await notificationsControllerPreferences({ signal }))
        .data as PreferenceDto[],
  });
  const save = useMutation({
    mutationFn: (change: PreferenceDto) =>
      notificationsControllerUpdatePreferences({
        changes: [
          { type: change.type, inApp: change.inApp, email: change.email },
        ],
      }),
    onSuccess: (res) => queryClient.setQueryData(queryKey, res.data),
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
  // The checkboxes are uncontrolled, keyed by the saved value: they flip at
  // once and settle on what the server stored.
  const change = (next: PreferenceDto) => save.mutate(next);

  return (
    <Section
      id="notif"
      title={t('me.notifications')}
      hint={t('me.notificationsHint')}
    >
      <FormError
        message={save.isError ? errorMessage(t, save.error) : undefined}
      />
      {prefs.isError && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, prefs.error)}
        </p>
      )}
      <table className="w-full text-[15px]" aria-describedby="notif-title">
        <thead className="text-[13px] text-ink-subtle">
          <tr>
            <th scope="col" className="py-2 text-start font-semibold" />
            <th scope="col" className="w-24 py-2 text-center font-semibold">
              {t('me.inApp')}
            </th>
            <th scope="col" className="w-24 py-2 text-center font-semibold">
              {t('me.byEmail')}
            </th>
          </tr>
        </thead>
        {GROUPS.map((group) => {
          const rows = (prefs.data ?? []).filter(
            (p) => NOTIFICATION_CATEGORY[p.type] === group,
          );
          if (!rows.length) return null;
          return (
            <tbody key={group}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={3}
                  className="pb-1 pt-4 text-start text-[13px] font-semibold text-ink-subtle"
                >
                  {group === 'other'
                    ? t('header.messages')
                    : t(`notifications.filters.${group}`)}
                </th>
              </tr>
              {rows.map((p) => {
                const name = t(`notifications.typeName.${p.type}`);
                return (
                  <tr key={p.type} className="border-t border-divider">
                    <th scope="row" className="py-2.5 text-start font-normal">
                      <span className="flex items-center gap-2">
                        {name}
                        {p.mandatory && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
                            <Lock className="size-3" aria-hidden />
                            {t('notifications.mandatory')}
                          </span>
                        )}
                      </span>
                    </th>
                    <td className="py-2.5 text-center">
                      <input
                        key={`${p.type}-${p.inApp}`}
                        type="checkbox"
                        defaultChecked={p.inApp}
                        disabled={p.mandatory}
                        onChange={(e) =>
                          change({ ...p, inApp: e.target.checked })
                        }
                        aria-label={`${name} · ${t('me.inApp')}`}
                        className="size-[18px] cursor-pointer accent-primary disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <input
                        key={`${p.type}-${p.email}`}
                        type="checkbox"
                        defaultChecked={p.email}
                        onChange={(e) =>
                          change({ ...p, email: e.target.checked })
                        }
                        aria-label={`${name} · ${t('me.byEmail')}`}
                        className="size-[18px] cursor-pointer accent-primary"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </Section>
  );
}
