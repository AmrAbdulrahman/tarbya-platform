import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.url(),
    ORG_TIMEZONE: z.string().default('Africa/Cairo'),
    /** Background jobs (pg-boss). Off for one-shot runs such as writing the OpenAPI spec. */
    JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),

    DATABASE_URL: z.string().startsWith('postgres'),
    JWT_SECRET: z.string().min(32),
    /** Sign-in attempts per client IP per minute (US-1.2). Raised in dev and CI, where suites share one API. */
    AUTH_SIGN_IN_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(10),

    SUPER_ADMIN_EMAIL: z.email(),
    SUPER_ADMIN_NAME: z.string().default('Super admin'),
    SUPER_ADMIN_PASSWORD: optionalString,

    /** Sends through Resend's HTTPS API instead of SMTP when set. */
    RESEND_API_KEY: optionalString,
    /** Required unless RESEND_API_KEY is set. */
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    /** Sender for every email, whichever way it's sent. */
    SMTP_FROM: z.string(),

    S3_ENDPOINT: z.url(),
    S3_REGION: z.string(),
    S3_BUCKET: z.string(),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
  })
  .superRefine((env, ctx) => {
    if (env.RESEND_API_KEY) return;
    for (const key of ['SMTP_HOST', 'SMTP_PORT'] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required unless RESEND_API_KEY is set',
        });
      }
    }
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
