import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  messagesControllerUpload,
  type AttachmentDto,
} from '@tarbya/api-client';
import { Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';

/** Mirrors the API's limits: 20 MB a file, 10 files a message. */
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
const IMAGE = /^image\/(png|jpeg|webp|gif)$/;

interface Pending {
  key: string;
  name: string;
  /** Set once uploaded. */
  attachment?: AttachmentDto;
  error?: string;
}

/** Bytes as "820 KB" or "3.4 MB", in the reader's language. */
export function useFileSize() {
  const { t, i18n } = useTranslation();
  return (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    const n = new Intl.NumberFormat(i18n.language, {
      maximumFractionDigits: mb >= 1 ? 1 : 0,
    });
    return mb >= 1
      ? t('messages.files.mb', { size: n.format(mb) })
      : t('messages.files.kb', { size: n.format(Math.max(1, bytes / 1024)) });
  };
}

/**
 * Files picked for the next message: each uploads as soon as it's picked, so
 * sending only names them.
 */
export function useAttachments(conversationId: string) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Pending[]>([]);
  const update = (key: string, patch: Partial<Pending>) =>
    setPending((list) =>
      list.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );

  const add = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_FILES - pending.length;
    for (const file of [...files].slice(0, Math.max(room, 0))) {
      const key = crypto.randomUUID();
      setPending((list) => [...list, { key, name: file.name }]);
      if (file.size > MAX_BYTES) {
        update(key, { error: t('messages.files.tooLarge') });
        continue;
      }
      messagesControllerUpload(conversationId, { file })
        .then((res) => update(key, { attachment: res.data as AttachmentDto }))
        .catch((error: unknown) =>
          update(key, { error: errorMessage(t, error) }),
        );
    }
  };

  return {
    pending,
    add,
    remove: (key: string) =>
      setPending((list) => list.filter((p) => p.key !== key)),
    clear: () => setPending([]),
    uploading: pending.some((p) => !p.attachment && !p.error),
    ids: pending.flatMap((p) => (p.attachment ? [p.attachment.id] : [])),
    full: pending.length >= MAX_FILES,
  };
}

export type Attachments = ReturnType<typeof useAttachments>;

/** The paperclip that picks files. */
export function AttachButton({ files }: { files: Attachments }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          files.add(e.target.files);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        disabled={files.full}
        aria-label={t('messages.files.attach')}
        title={t('messages.files.attach')}
        onClick={() => input.current?.click()}
      >
        <Paperclip aria-hidden />
      </Button>
    </>
  );
}

/** The files waiting to go with the next message. */
export function PendingFiles({ files }: { files: Attachments }) {
  const { t } = useTranslation();
  if (!files.pending.length) return null;
  return (
    <ul
      aria-label={t('messages.files.pending')}
      className="flex flex-wrap gap-2 border-t border-border px-3 pt-3"
    >
      {files.pending.map((p) => (
        <li
          key={p.key}
          className={cn(
            'flex max-w-60 items-center gap-1.5 rounded-full border py-1 pe-1 ps-3 text-sm',
            p.error
              ? 'border-trend-down/40 bg-trend-down/5 text-trend-down'
              : 'border-border bg-surface',
          )}
          title={p.error}
        >
          {!p.attachment && !p.error ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FileText className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{p.name}</span>
          {p.error && <span className="sr-only">{p.error}</span>}
          <button
            type="button"
            onClick={() => files.remove(p.key)}
            aria-label={t('messages.files.remove', { name: p.name })}
            className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-ink/10"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A message's files: images as pictures, anything else as a download. */
export function MessageFiles({
  files,
  mine,
}: {
  files: AttachmentDto[];
  mine: boolean;
}) {
  const { t } = useTranslation();
  const size = useFileSize();
  if (!files.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {files.map((f) =>
        IMAGE.test(f.mime) ? (
          <li key={f.id}>
            <a href={f.url} target="_blank" rel="noreferrer">
              <img
                src={f.url}
                alt={f.name}
                loading="lazy"
                className="max-h-60 max-w-full rounded-lg object-contain"
              />
            </a>
          </li>
        ) : (
          <li key={f.id}>
            <a
              href={f.url}
              download={f.name}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                mine
                  ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25'
                  : 'bg-surface hover:bg-primary-tint',
              )}
              aria-label={t('messages.files.download', { name: f.name })}
            >
              <FileText className="size-5 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{f.name}</span>
                <span className="text-xs opacity-75">
                  <bdi>{size(f.size)}</bdi>
                </span>
              </span>
            </a>
          </li>
        ),
      )}
    </ul>
  );
}
