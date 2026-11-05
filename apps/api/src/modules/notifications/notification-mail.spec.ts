import { notificationMail } from './notification-mail';

describe('notificationMail (US-7.2)', () => {
  const base = {
    to: 'mentor@example.com',
    recipientId: 'mentor',
    url: 'https://tarbya.example/people/m',
  };

  it('writes in the recipient’s language and links into the app', () => {
    const ar = notificationMail({
      ...base,
      locale: 'ar',
      type: 'MENTORSHIP_ASSIGNED',
      payload: { menteeId: 'm', menteeName: 'يوسف', mentorName: 'سعد' },
    });
    expect(ar.subject).toBe('أُسند إليك يوسف متابَعًا');
    expect(ar.html).toContain('href="https://tarbya.example/people/m"');
    const en = notificationMail({
      ...base,
      locale: 'en',
      type: 'MENTORSHIP_ASSIGNED',
      payload: { menteeId: 'mentor', menteeName: 'Yousef', mentorName: 'Saad' },
    });
    // The recipient is the mentee here.
    expect(en.subject).toBe('Saad is now your mentor');
  });

  it('escapes what users wrote', () => {
    const mail = notificationMail({
      ...base,
      locale: 'en',
      type: 'NEW_MESSAGE',
      payload: { byName: 'Yousef', preview: '<b>hi</b> & bye' },
    });
    expect(mail.html).toContain('&lt;b&gt;hi&lt;/b&gt; &amp; bye');
    expect(mail.text).toContain('<b>hi</b> & bye');
  });
});
