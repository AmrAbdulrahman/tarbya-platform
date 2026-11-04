import type { Locale } from '@tarbya/db';

/** Brand colours and fonts (design/README.md). Email clients need them inline. */
export const emailBrand = {
  green: '#0E4D3A',
  greenTint: '#E3EFE9',
  gold: '#D7A84A',
  cream: '#FAF8F2',
  divider: '#ECE6D8',
  ink: '#1F2A25',
  muted: '#66726C',
  font: "Tajawal, Manrope, 'Segoe UI', Tahoma, Arial, sans-serif",
  fontEn: "Manrope, Tajawal, 'Segoe UI', Tahoma, Arial, sans-serif",
} as const;

const copy = {
  ar: {
    dir: 'rtl',
    name: 'تربية',
    tagline: 'منصة للتربية والتطوير الإسلامي',
    footer: 'رسالة آلية من منصة تربية، لا حاجة للرد عليها.',
    open: 'فتح تربية',
  },
  en: {
    dir: 'ltr',
    name: 'Tarbya',
    tagline: 'Islamic mentorship platform',
    footer: 'An automatic message from Tarbya; no need to reply.',
    open: 'Open Tarbya',
  },
} as const;

/** The code in a tinted box; codes are digits, so they always read left to right. */
export function codeBlock(code: string): string {
  const b = emailBrand;
  return `<div dir="ltr" style="margin:24px 0;padding:16px;border-radius:10px;background:${b.greenTint};text-align:center;font-family:Manrope,${b.font};font-size:32px;font-weight:700;letter-spacing:8px;color:${b.green}">${code}</div>`;
}

/**
 * Wraps an email's body in the branded frame: green header with the logo, a white card
 * on cream, and a footer linking to the app. Table layout and inline styles for email clients.
 */
export function emailLayout({
  body,
  preheader,
  locale,
  appUrl,
}: {
  body: string;
  /** Preview text shown after the subject in most inboxes. */
  preheader: string;
  locale: Locale;
  appUrl: string;
}): string {
  const t = copy[locale];
  const b = emailBrand;
  const align = t.dir === 'rtl' ? 'right' : 'left';
  // Manrope has no Arabic, so Arabic mail leads with Tajawal and English with Manrope.
  const font = locale === 'en' ? b.fontEn : b.font;
  return `<!doctype html>
<html lang="${locale}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${t.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${b.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.cream}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${b.divider};border-radius:14px;overflow:hidden">
<tr><td dir="${t.dir}" style="background:${b.green};padding:22px 28px;border-bottom:4px solid ${b.gold}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle"><img src="${appUrl}/email-logo.png" width="44" height="48" alt="" style="display:block;border:0"></td>
<td style="vertical-align:middle;padding-${t.dir === 'rtl' ? 'right' : 'left'}:12px;font-family:${font};text-align:${align}">
<div style="font-size:22px;font-weight:700;color:#FFFFFF;line-height:1.2">${t.name}</div>
<div style="font-size:13px;color:#CFE0D6;line-height:1.4">${t.tagline}</div>
</td></tr></table>
</td></tr>
<tr><td dir="${t.dir}" style="padding:32px 28px 28px;font-family:${font};font-size:16px;line-height:1.7;color:${b.ink};text-align:${align}">
${body}
</td></tr>
<tr><td dir="${t.dir}" style="padding:18px 28px;border-top:1px solid ${b.divider};font-family:${font};font-size:13px;line-height:1.6;color:${b.muted};text-align:${align}">
${t.footer}<br><a href="${appUrl}" style="color:${b.green};font-weight:700;text-decoration:none">${t.open}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
