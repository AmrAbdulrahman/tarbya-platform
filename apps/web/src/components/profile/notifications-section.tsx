import { useTranslation } from 'react-i18next';
import { Badge } from '@tarbya/ui';
import { Section } from './section';

const TYPES = [
  'mentorship',
  'followUp',
  'contact',
  'gathering',
  'plans',
  'messages',
] as const;

/** US-2.4 placeholder: the real per-type choices arrive with notifications (build order step 7). */
export function NotificationsSection() {
  const { t } = useTranslation();
  return (
    <Section
      id="notif"
      title={t('me.notifications')}
      hint={t('me.notificationsHint')}
      aside={<Badge tone="warn">{t('me.soon')}</Badge>}
    >
      <table className="w-full text-[15px]" aria-describedby="notif-title">
        <thead className="text-[13px] text-ink-subtle">
          <tr>
            <th scope="col" className="py-2 text-start font-semibold" />
            <th scope="col" className="w-28 py-2 text-center font-semibold">
              {t('me.inApp')}
            </th>
            <th scope="col" className="w-28 py-2 text-center font-semibold">
              {t('me.byEmail')}
            </th>
          </tr>
        </thead>
        <tbody>
          {TYPES.map((type) => (
            <tr key={type} className="border-t border-divider text-ink-subtle">
              <th scope="row" className="py-2.5 text-start font-normal">
                {t(`me.notifTypes.${type}`)}
              </th>
              {[t('me.inApp'), t('me.byEmail')].map((channel) => (
                <td key={channel} className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    aria-label={`${t(`me.notifTypes.${type}`)} · ${channel}`}
                    className="size-[18px] accent-primary"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
