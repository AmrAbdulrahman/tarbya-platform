import type { Locale } from '@tarbya/db';
import { formatDate, formatTime, type NotificationType } from '@tarbya/shared';
import { emailBrand } from '../mail/email-layout';
import type { Mail } from '../mail/mail.service';

type Payload = Record<string, unknown>;
interface Text {
  title: string;
  body: string;
}

const s = (p: Payload, key: string) =>
  typeof p[key] === 'string' ? (p[key] as string) : '';
const n = (p: Payload, key: string) =>
  typeof p[key] === 'number' ? (p[key] as number) : 0;

/** "Tuesday 10 November 2026 · 20:00" in the organisation zone. */
const at = (iso: string, locale: Locale) =>
  iso
    ? `${formatDate(iso, { locale, calendar: 'GREGORIAN' })} · ${formatTime(iso, { locale })}`
    : '';

/**
 * Email copy for each type (BR-NTF-3, US-7.2), in the recipient's language.
 * The web has the same wording under `notifications.types` in libs/i18n.
 */
const copy: Record<
  Locale,
  (type: NotificationType, p: Payload, me: string) => Text
> = {
  ar: (type, p, me) => {
    const isMentee = s(p, 'menteeId') === me;
    switch (type) {
      case 'MENTORSHIP_ASSIGNED':
        return isMentee
          ? {
              title: `أصبح ${s(p, 'mentorName')} مربّيك`,
              body: 'ستجد متابعاتك ومؤشراتك في رحلتك على تربية.',
            }
          : {
              title: `أُسند إليك ${s(p, 'menteeName')} متابَعًا`,
              body: 'ابدأ بلقاء تعارف.',
            };
      case 'MENTORSHIP_ENDED':
        return isMentee
          ? {
              title: `انتهت علاقة التربية مع ${s(p, 'mentorName')}`,
              body: 'يبقى سجلّك ومؤشراتك كما هي.',
            }
          : {
              title: `انتهت علاقة التربية مع ${s(p, 'menteeName')}`,
              body: 'يبقى سجل المتابعات محفوظًا.',
            };
      case 'INTERACTION_SCHEDULED':
        return {
          title:
            p['kind'] === 'FOLLOW_UP'
              ? `حدّد ${s(p, 'byName')} لقاء متابعة معك`
              : `دعاك ${s(p, 'byName')} إلى «${s(p, 'title')}»`,
          body: at(s(p, 'startsAt'), 'ar'),
        };
      case 'INTERACTION_CHANGED':
        return {
          title: `تغيّر موعد «${s(p, 'title')}»`,
          body: at(s(p, 'startsAt'), 'ar'),
        };
      case 'CONTACT_DUE':
        return {
          title: `حان وقت التواصل مع ${s(p, 'menteeName')}`,
          body: `مرّ ${n(p, 'days')} يومًا على آخر تواصل.`,
        };
      case 'CONTACT_LATE':
        return {
          title: `تأخّر التواصل مع ${s(p, 'menteeName')}`,
          body: `لم تتواصل معه منذ ${n(p, 'days')} يومًا. سجّل متابعة أو نشاطًا.`,
        };
      case 'GATHERING_RSVP_REQUEST':
        return {
          title: `أكّد حضورك: ${s(p, 'groupName')}`,
          body: `${s(p, 'title') || s(p, 'typeNameAr')} · ${at(s(p, 'startsAt'), 'ar')}`,
        };
      case 'GATHERING_REMINDER':
        return {
          title: p['needsRsvp']
            ? `لم تؤكّد حضورك بعد: ${s(p, 'groupName')}`
            : `تذكير: ${s(p, 'title') || s(p, 'typeNameAr')}`,
          body: `${s(p, 'groupName')} · ${at(s(p, 'startsAt'), 'ar')}`,
        };
      case 'TRACKABLE_CREATED':
        return {
          title: `مؤشر جديد: «${s(p, 'name')}»`,
          body: `أضافه ${s(p, 'byName')}.`,
        };
      case 'TRACKABLE_CHANGED':
        return {
          title: `تغيّر المؤشر «${s(p, 'name')}»`,
          body: `عدّله ${s(p, 'byName')}.`,
        };
      case 'CYCLE_WAITING':
        return {
          title: 'مؤشرات بانتظار تسجيلك',
          body: `${n(p, 'count')} دورة لم تُسجَّل بعد، منها «${s(p, 'name')}».`,
        };
      case 'ENTRY_LOGGED':
        return {
          title: `سجّل ${s(p, 'menteeName')} «${s(p, 'name')}»`,
          body: p['needsHelp']
            ? 'وطلب مساعدتك في هذه الدورة.'
            : 'اطّلع على التسجيل وردّ عليه.',
        };
      case 'CHALLENGE_RAISED':
        return {
          title: `تحدٍّ جديد: «${s(p, 'title')}»`,
          body: `أضافه ${s(p, 'byName')}.`,
        };
      case 'CHALLENGE_COMMENTED':
        return {
          title: `علّق ${s(p, 'byName')} على «${s(p, 'title')}»`,
          body: s(p, 'preview'),
        };
      case 'CHALLENGE_RESOLVED':
        return {
          title: `حُلّ التحدي «${s(p, 'title')}»`,
          body: `بواسطة ${s(p, 'byName')}.`,
        };
      case 'MENTOR_REPLIED':
        return {
          title: `ردّ ${s(p, 'byName')} على «${s(p, 'name')}»`,
          body: s(p, 'preview'),
        };
      case 'TASK_ASSIGNED':
        return {
          title: `مهمة جديدة: «${s(p, 'title')}»`,
          body: `من ${s(p, 'byName')}.`,
        };
      case 'NEW_MESSAGE':
        return {
          title: `رسالة جديدة من ${s(p, 'byName')}`,
          body: s(p, 'preview'),
        };
    }
  },
  en: (type, p, me) => {
    const isMentee = s(p, 'menteeId') === me;
    switch (type) {
      case 'MENTORSHIP_ASSIGNED':
        return isMentee
          ? {
              title: `${s(p, 'mentorName')} is now your mentor`,
              body: 'Your follow-ups and trackables are in your journey on Tarbya.',
            }
          : {
              title: `${s(p, 'menteeName')} is now your mentee`,
              body: 'Start with a first meeting.',
            };
      case 'MENTORSHIP_ENDED':
        return isMentee
          ? {
              title: `Your mentorship with ${s(p, 'mentorName')} has ended`,
              body: 'Your history and trackables stay as they are.',
            }
          : {
              title: `Your mentorship with ${s(p, 'menteeName')} has ended`,
              body: 'The follow-up history is kept.',
            };
      case 'INTERACTION_SCHEDULED':
        return {
          title:
            p['kind'] === 'FOLLOW_UP'
              ? `${s(p, 'byName')} set a follow-up with you`
              : `${s(p, 'byName')} invited you to “${s(p, 'title')}”`,
          body: at(s(p, 'startsAt'), 'en'),
        };
      case 'INTERACTION_CHANGED':
        return {
          title: `“${s(p, 'title')}” has moved`,
          body: at(s(p, 'startsAt'), 'en'),
        };
      case 'CONTACT_DUE':
        return {
          title: `Time to reach ${s(p, 'menteeName')}`,
          body: `${n(p, 'days')} days since your last contact.`,
        };
      case 'CONTACT_LATE':
        return {
          title: `Contact with ${s(p, 'menteeName')} is late`,
          body: `No contact for ${n(p, 'days')} days. Log a follow-up or an activity.`,
        };
      case 'GATHERING_RSVP_REQUEST':
        return {
          title: `Will you attend? ${s(p, 'groupName')}`,
          body: `${s(p, 'title') || s(p, 'typeNameEn')} · ${at(s(p, 'startsAt'), 'en')}`,
        };
      case 'GATHERING_REMINDER':
        return {
          title: p['needsRsvp']
            ? `You haven’t replied yet: ${s(p, 'groupName')}`
            : `Reminder: ${s(p, 'title') || s(p, 'typeNameEn')}`,
          body: `${s(p, 'groupName')} · ${at(s(p, 'startsAt'), 'en')}`,
        };
      case 'TRACKABLE_CREATED':
        return {
          title: `New trackable: “${s(p, 'name')}”`,
          body: `Added by ${s(p, 'byName')}.`,
        };
      case 'TRACKABLE_CHANGED':
        return {
          title: `“${s(p, 'name')}” was changed`,
          body: `Edited by ${s(p, 'byName')}.`,
        };
      case 'CYCLE_WAITING':
        return {
          title: 'Trackables waiting for you',
          body: `${n(p, 'count')} cycles to log, including “${s(p, 'name')}”.`,
        };
      case 'ENTRY_LOGGED':
        return {
          title: `${s(p, 'menteeName')} logged “${s(p, 'name')}”`,
          body: p['needsHelp']
            ? 'They asked for your help with this cycle.'
            : 'Have a look and reply.',
        };
      case 'CHALLENGE_RAISED':
        return {
          title: `New challenge: “${s(p, 'title')}”`,
          body: `Raised by ${s(p, 'byName')}.`,
        };
      case 'CHALLENGE_COMMENTED':
        return {
          title: `${s(p, 'byName')} commented on “${s(p, 'title')}”`,
          body: s(p, 'preview'),
        };
      case 'CHALLENGE_RESOLVED':
        return {
          title: `“${s(p, 'title')}” is resolved`,
          body: `By ${s(p, 'byName')}.`,
        };
      case 'MENTOR_REPLIED':
        return {
          title: `${s(p, 'byName')} replied on “${s(p, 'name')}”`,
          body: s(p, 'preview'),
        };
      case 'TASK_ASSIGNED':
        return {
          title: `New task: “${s(p, 'title')}”`,
          body: `From ${s(p, 'byName')}.`,
        };
      case 'NEW_MESSAGE':
        return {
          title: `New message from ${s(p, 'byName')}`,
          body: s(p, 'preview'),
        };
    }
  },
};

const action: Record<Locale, string> = {
  ar: 'عرض في تربية',
  en: 'Open in Tarbya',
};

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  );

/** US-7.2: the notification as an email in the recipient's language, with a link into the app. */
export function notificationMail(opts: {
  to: string;
  locale: Locale;
  type: NotificationType;
  payload: Payload;
  recipientId: string;
  url: string;
}): Mail {
  const { title, body } = copy[opts.locale](
    opts.type,
    opts.payload,
    opts.recipientId,
  );
  const b = emailBrand;
  return {
    to: opts.to,
    locale: opts.locale,
    subject: title,
    preheader: body,
    text: `${title}\n\n${body}\n\n${opts.url}\n`,
    html: `<h1 style="margin:0 0 8px;font-size:20px;line-height:1.4;color:${b.green}">${escape(title)}</h1>
${body ? `<p style="margin:0 0 20px;white-space:pre-line">${escape(body)}</p>` : ''}
<a href="${escape(opts.url)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:${b.green};color:#ffffff;font-weight:700;text-decoration:none">${action[opts.locale]}</a>`,
  };
}
