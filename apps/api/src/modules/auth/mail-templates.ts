import type { Locale } from '@tarbya/db';
import { codeBlock, emailBrand } from '../mail/email-layout';
import type { Mail } from '../mail/mail.service';
import { CODE_TTL_MINUTES } from './tokens';

const copy = {
  ar: {
    subject: (code: string) => `${code} رمز الدخول إلى تربية`,
    title: 'رمز الدخول',
    intro: 'استخدم هذا الرمز لتسجيل الدخول إلى تربية:',
    expiry: `ينتهي الرمز خلال ${CODE_TTL_MINUTES} دقائق ويُستخدم مرة واحدة.`,
    ignore: 'إن لم تطلب هذا الرمز فتجاهل هذه الرسالة.',
  },
  en: {
    subject: (code: string) => `${code} is your Tarbya sign-in code`,
    title: 'Your sign-in code',
    intro: 'Use this code to sign in to Tarbya:',
    expiry: `It expires in ${CODE_TTL_MINUTES} minutes and works once.`,
    ignore: "If you didn't ask for it, ignore this email.",
  },
} as const;

/** A heading, the lead line, the code, then the expiry and "ignore" notes. */
function codeBody(title: string, intro: string, code: string, locale: Locale) {
  const t = copy[locale];
  return `<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:${emailBrand.green}">${title}</h1>
<p style="margin:0">${intro}</p>
${codeBlock(code)}
<p style="margin:0;font-size:14px;color:${emailBrand.muted}">${t.expiry}<br>${t.ignore}</p>`;
}

export function signInCodeMail(to: string, code: string, locale: Locale): Mail {
  const t = copy[locale];
  return {
    to,
    locale,
    subject: t.subject(code),
    preheader: t.intro,
    text: `${t.intro}\n\n${code}\n\n${t.expiry}\n${t.ignore}\n`,
    html: codeBody(t.title, t.intro, code, locale),
  };
}

const contactCopy = {
  ar: {
    subject: (code: string) => `${code} رمز تأكيد التغيير في تربية`,
    title: 'تأكيد التغيير',
    intro: {
      EMAIL: 'استخدم هذا الرمز لتأكيد بريدك الجديد في تربية:',
      PHONE: 'استخدم هذا الرمز لتأكيد رقم جوالك الجديد في تربية:',
    },
  },
  en: {
    subject: (code: string) => `${code} confirms your Tarbya change`,
    title: 'Confirm your change',
    intro: {
      EMAIL: 'Use this code to confirm your new email on Tarbya:',
      PHONE: 'Use this code to confirm your new phone number on Tarbya:',
    },
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
    locale,
    subject: t.subject(code),
    preheader: t.intro[kind],
    text: `${t.intro[kind]}\n\n${code}\n\n${rest.expiry}\n${rest.ignore}\n`,
    html: codeBody(t.title, t.intro[kind], code, locale),
  };
}
