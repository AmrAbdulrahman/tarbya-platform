import { validateEnv } from './env';

const valid = {
  APP_URL: 'http://localhost:4200',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  SUPER_ADMIN_EMAIL: 'admin@example.com',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'Tarbya <no-reply@example.com>',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'tarbya',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.ORG_TIMEZONE).toBe('Africa/Cairo');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_USER).toBeUndefined();
  });

  it('lists every invalid variable', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_SECRET: 'short', SUPER_ADMIN_EMAIL: 'nope' }),
    ).toThrow(/JWT_SECRET[\s\S]*SUPER_ADMIN_EMAIL/);
  });
});
