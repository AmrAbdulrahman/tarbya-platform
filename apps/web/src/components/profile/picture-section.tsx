import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  meControllerRemoveAvatar,
  meControllerUpdate,
  meControllerUploadAvatar,
  type MyProfileDto,
} from '@tarbya/api-client';
import { Button, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { Field, FormError } from '../login/fields';
import { Avatar } from './avatar';
import { Section } from './section';

const MAX_BYTES = 5 * 1024 * 1024;

/** US-2.1: picture and name. */
export function PictureSection({
  profile,
  onSaved,
}: {
  profile: MyProfileDto;
  onSaved: (p: MyProfileDto) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [tooBig, setTooBig] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) =>
      (await meControllerUploadAvatar({ file })).data as MyProfileDto,
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: async () =>
      (await meControllerRemoveAvatar()).data as MyProfileDto,
    onSuccess: onSaved,
  });
  const rename = useMutation({
    mutationFn: async () =>
      (await meControllerUpdate({ name })).data as MyProfileDto,
    onSuccess: onSaved,
  });
  const error = tooBig
    ? t('errors.FILE_TOO_LARGE')
    : [upload, remove, rename].find((m) => m.isError)?.error;

  return (
    <Section id="pic" title={t('me.picAndName')}>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar
          name={profile.name}
          url={profile.avatarUrl}
          className="size-20 text-3xl"
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink-muted">
            {t('me.picture')}{' '}
            <span className="font-normal text-ink-subtle">
              {t('me.optional')}
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                // Checked here too, so a big file doesn't upload just to be refused.
                setTooBig(file.size > MAX_BYTES);
                if (file.size <= MAX_BYTES) upload.mutate(file);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => input.current?.click()}
              disabled={upload.isPending}
            >
              {profile.avatarUrl ? t('me.change') : t('me.upload')}
            </Button>
            {profile.avatarUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {t('me.remove')}
              </Button>
            )}
          </div>
          <span className="text-[13px] text-ink-subtle">
            {t('me.pictureHint')}
          </span>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== profile.name) rename.mutate();
        }}
      >
        <div className="flex-[1_1_260px]">
          <Field id="me-name" label={t('me.name')}>
            <Input
              id="me-name"
              className="h-11 text-[15px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <Button
          type="submit"
          disabled={
            !name.trim() || name.trim() === profile.name || rename.isPending
          }
        >
          {t('me.saveName')}
        </Button>
      </form>
      <FormError
        message={
          typeof error === 'string'
            ? error
            : error
              ? errorMessage(t, error)
              : undefined
        }
      />
    </Section>
  );
}
