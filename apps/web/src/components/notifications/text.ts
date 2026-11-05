import { useTranslation } from 'react-i18next';
import type { NotificationDto } from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, formatTime } from '@tarbya/shared';
import { useMe } from '../../auth/session';

type Payload = Record<string, unknown>;
const str = (p: Payload, key: string) =>
  typeof p[key] === 'string' ? (p[key] as string) : '';

/**
 * A notification's title and body in the active language (BR-NTF-3). The API
 * sends the same wording by email (apps/api/src/modules/notifications/notification-mail.ts).
 */
export function useNotificationText() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Language;
  const me = useMe();
  const at = (iso: string) =>
    iso
      ? `${formatDate(iso, { locale, calendar: me.calendar })} · ${formatTime(iso, { locale })}`
      : '';

  return (n: NotificationDto): { title: string; body: string } => {
    const p = n.payload as Payload;
    const k = 'notifications.text' as const;
    switch (n.type) {
      case 'MENTORSHIP_ASSIGNED':
      case 'MENTORSHIP_ENDED': {
        const side = str(p, 'menteeId') === me.id ? 'mentee' : 'mentor';
        return {
          title: t(`${k}.${n.type}.${side}`, p),
          body: t(`${k}.${n.type}.${side}Body`),
        };
      }
      case 'INTERACTION_SCHEDULED':
        return {
          title: t(
            `${k}.INTERACTION_SCHEDULED.${p['kind'] === 'FOLLOW_UP' ? 'followUp' : 'activity'}`,
            p,
          ),
          body: at(str(p, 'startsAt')),
        };
      case 'INTERACTION_CHANGED':
        return {
          title: t(`${k}.INTERACTION_CHANGED`, p),
          body: at(str(p, 'startsAt')),
        };
      case 'CONTACT_DUE':
      case 'CONTACT_LATE':
      case 'TRACKABLE_CREATED':
      case 'TRACKABLE_CHANGED':
      case 'CYCLE_WAITING':
      case 'CHALLENGE_RAISED':
      case 'CHALLENGE_RESOLVED':
      case 'TASK_ASSIGNED':
        return {
          title: t(`${k}.${n.type}`, p),
          body: t(`${k}.${n.type}_body`, p),
        };
      case 'GATHERING_RSVP_REQUEST':
      case 'GATHERING_REMINDER': {
        const name =
          str(p, 'title') ||
          str(p, locale === 'ar' ? 'typeNameAr' : 'typeNameEn');
        const asking = n.type === 'GATHERING_REMINDER' && p['needsRsvp'];
        return {
          title: asking
            ? t(`${k}.GATHERING_REMINDER_ask`, p)
            : t(`${k}.${n.type}`, { ...p, name }),
          body: [name, str(p, 'place'), at(str(p, 'startsAt'))]
            .filter(Boolean)
            .join(' · '),
        };
      }
      case 'ENTRY_LOGGED':
        return {
          title: t(`${k}.ENTRY_LOGGED`, p),
          body: p['needsHelp'] ? t(`${k}.ENTRY_LOGGED_help`) : '',
        };
      case 'CHALLENGE_COMMENTED':
      case 'MENTOR_REPLIED':
      case 'NEW_MESSAGE':
        return { title: t(`${k}.${n.type}`, p), body: str(p, 'preview') };
    }
  };
}
