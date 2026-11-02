import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.url(),
  ORG_TIMEZONE: z.string().default('Africa/Cairo'),

  DATABASE_URL: z.string().startsWith('postgres'),
  JWT_SECRET: z.string().min(32),

  SUPER_ADMIN_EMAIL: z.email(),
  SUPER_ADMIN_NAME: z.string().default('Super admin'),
  SUPER_ADMIN_PASSWORD: optionalString,

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: z.string(),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: fails boot with every invalid variable listed. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return result.data;
}
