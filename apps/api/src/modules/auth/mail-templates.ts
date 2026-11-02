import type { Locale } from '@tarbya/db';
import type { Mail } from '../mail/mail.service';
import { CODE_TTL_MINUTES } from './tokens';

const copy = {
  ar: {
    subject: (code: string) => `${code} رمز الدخول إلى تربية`,
    intro: 'استخدم هذا الرمز لتسجيل الدخول إلى تربية:',
    expiry: `ينتهي الرمز خلال ${CODE_TTL_MINUTES} دقائق ويُستخدم مرة واحدة.`,
    ignore: 'إن لم تطلب هذا الرمز فتجاهل هذه الرسالة.',
    dir: 'rtl',
  },
  en: {
    subject: (code: string) => `${code} is your Tarbya sign-in code`,
    intro: 'Use this code to sign in to Tarbya:',
    expiry: `It expires in ${CODE_TTL_MINUTES} minutes and works once.`,
    ignore: "If you didn't ask for it, ignore this email.",
    dir: 'ltr',
  },
} as const;

export function signInCodeMail(to: string, code: string, locale: Locale): Mail {
  const t = copy[locale];
  return {
    to,
    subject: t.subject(code),
    text: `${t.intro}\n\n${code}\n\n${t.expiry}\n${t.ignore}\n`,
    html: `<div dir="${t.dir}" lang="${locale}" style="font-family:system-ui,sans-serif;color:#1E293B">
<p>${t.intro}</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#001447" dir="ltr">${code}</p>
<p style="color:#64748B">${t.expiry}<br>${t.ignore}</p>
</div>`,
  };
}

const contactCopy = {
  ar: {
    subject: (code: string) => `${code} رمز تأكيد التغيير في تربية`,
    intro: {
      EMAIL: 'استخدم هذا الرمز لتأكيد بريدك الجديد في تربية:',
      PHONE: 'استخدم هذا الرمز لتأكيد رقم جوالك الجديد في تربية:',
    },
    dir: 'rtl',
  },
  en: {
    subject: (code: string) => `${code} confirms your Tarbya change`,
    intro: {
      EMAIL: 'Use this code to confirm your new email on Tarbya:',
      PHONE: 'Use this code to confirm your new phone number on Tarbya:',
    },
    dir: 'ltr',
  },
} as const;

/** US-2.2: the code that confirms a new email (sent to it) or phone (sent to the current email). */
export function contactCodeMail(
  to: string,
  code: string,
  locale: Locale,
  kind: 'EMAIL' | 'PHONE',
): Mail {
  const t = contactCopy[locale];
  const rest = copy[locale];
  return {
    to,
    subject: t.subject(code),
    text: `${t.intro[kind]}\n\n${code}\n\n${rest.expiry}\n${rest.ignore}\n`,
    html: `<div dir="${t.dir}" lang="${locale}" style="font-family:system-ui,sans-serif;color:#1E293B">
<p>${t.intro[kind]}</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#001447" dir="ltr">${code}</p>
<p style="color:#64748B">${rest.expiry}<br>${rest.ignore}</p>
</div>`,
  };
}
