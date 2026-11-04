import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { MailService } from './mail.service';

// @nestjs/config ships as ESM, which Jest can't load; the service only needs its type.
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

const mail = {
  to: 'a@tarbya.test',
  subject: 'Hi',
  text: 'Hi',
  html: '<p>Hi</p>',
};

function service(values: Partial<Env>) {
  const config = { get: (key: keyof Env) => values[key] };
  return new MailService(config as unknown as ConfigService<Env, true>);
}

describe('MailService with a Resend key', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('posts the mail to Resend with the sender', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await service({ RESEND_API_KEY: 're_x', SMTP_FROM: 'T <n@x.test>' }).send(
      mail,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_x');
    expect(JSON.parse(init.body)).toEqual({ from: 'T <n@x.test>', ...mail });
  });

  it('throws when Resend refuses', async () => {
    fetchMock.mockResolvedValue(
      new Response('domain not verified', { status: 403 }),
    );
    await expect(
      service({ RESEND_API_KEY: 're_x', SMTP_FROM: 'T <n@x.test>' }).send(mail),
    ).rejects.toThrow(/403: domain not verified/);
  });
});
