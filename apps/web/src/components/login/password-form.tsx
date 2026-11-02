import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  authControllerSignInWithPassword,
  type MeDto,
} from '@tarbya/api-client';
import { Button, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from './fields';

// Messages are i18n keys, translated where they're shown.
const schema = z.object({
  email: z.email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});
type Values = z.infer<typeof schema>;

interface Props {
  defaultEmail: string;
  onEmailChange: (email: string) => void;
  onForgot: () => void;
  onSignedIn: (me: MeDto) => void;
}

/** US-1.1 */
export function PasswordForm({
  defaultEmail,
  onEmailChange,
  onForgot,
  onSignedIn,
}: Props) {
  const { t } = useTranslation();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail, password: '' },
  });
  const signIn = useMutation({
    mutationFn: (values: Values) => authControllerSignInWithPassword(values),
    onSuccess: (res) => onSignedIn(res.data as MeDto),
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
      className="flex flex-col gap-4"
    >
      <Field
        id="email"
        label={t('login.email')}
        error={errors.email && t(errors.email.message as 'validation.email')}
      >
        <Input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          placeholder="name@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...form.register('email', {
            onChange: (e) => onEmailChange(e.target.value),
          })}
        />
      </Field>
      <Field
        id="password"
        label={t('login.password')}
        aside={
          <button
            type="button"
            onClick={onForgot}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t('login.forgot')}
          </button>
        }
        error={
          errors.password && t(errors.password.message as 'validation.required')
        }
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...form.register('password')}
        />
      </Field>
      <FormError
        message={signIn.isError ? errorMessage(t, signIn.error) : undefined}
      />
      <Button
        type="submit"
        className="h-12 text-base"
        disabled={signIn.isPending}
      >
        {t('login.submit')}
      </Button>
    </form>
  );
}
