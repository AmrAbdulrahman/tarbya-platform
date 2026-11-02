import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  lookupsControllerCreateTrackingMethod,
  lookupsControllerTrackingMethods,
  lookupsControllerUpdateTrackingMethod,
  type TrackingMethodDto,
} from '@tarbya/api-client';
import { Badge, Button, Checkbox, Input } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { FormError } from '../login/fields';

/** Plan tracking methods (US-3.5): a short list edited in place. */
export function TrackingMethods() {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState<TrackingMethodDto | 'new' | null>(
    null,
  );
  const methods = useQuery({
    queryKey: ['tracking-methods'],
    queryFn: async ({ signal }) =>
      (await lookupsControllerTrackingMethods({ signal }))
        .data as TrackingMethodDto[],
  });

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-lg font-bold text-navy">
            {t('admin.lookups.trackingTitle')}
          </h2>
          <p className="text-sm text-ink-subtle">
            {t('admin.lookups.trackingLead')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          {t('admin.lookups.trackingAdd')}
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-divider">
        {methods.data?.map((m) =>
          editing !== 'new' && editing?.id === m.id ? (
            <li key={m.id} className="py-3">
              <MethodForm method={m} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <span className="flex-1 font-medium">
                {i18n.language === 'ar' ? m.nameAr : m.nameEn}
              </span>
              {!m.active && <Badge>{t('admin.lookups.inactive')}</Badge>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                {t('admin.lookups.edit')}
              </Button>
            </li>
          ),
        )}
        {editing === 'new' && (
          <li className="py-3">
            <MethodForm onDone={() => setEditing(null)} />
          </li>
        )}
      </ul>
    </section>
  );
}

function MethodForm({
  method,
  onDone,
}: {
  method?: TrackingMethodDto;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [nameAr, setNameAr] = useState(method?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(method?.nameEn ?? '');
  const [active, setActive] = useState(method?.active ?? true);
  const [missing, setMissing] = useState(false);
  const save = useMutation({
    mutationFn: () => {
      const body = { nameAr: nameAr.trim(), nameEn: nameEn.trim(), active };
      return method
        ? lookupsControllerUpdateTrackingMethod(method.id, body)
        : lookupsControllerCreateTrackingMethod(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tracking-methods'] });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = !!nameAr.trim() && !!nameEn.trim();
    setMissing(!ok);
    if (ok) save.mutate();
  };
  const idBase = method?.id ?? 'new';

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-muted">
          {t('admin.lookups.nameAr')}
          <Input
            id={`tm-ar-${idBase}`}
            dir="rtl"
            lang="ar"
            className="h-11 text-[15px] font-normal"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            aria-invalid={missing && !nameAr.trim()}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-muted">
          {t('admin.lookups.nameEn')}
          <Input
            id={`tm-en-${idBase}`}
            dir="ltr"
            lang="en"
            className="h-11 text-[15px] font-normal"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            aria-invalid={missing && !nameEn.trim()}
          />
        </label>
      </div>
      <Checkbox
        id={`tm-active-${idBase}`}
        label={t('admin.lookups.activeLabel')}
        checked={active}
        onChange={(e) => setActive(e.target.checked)}
      />
      <FormError
        message={
          missing
            ? t('validation.required')
            : save.isError
              ? errorMessage(t, save.error)
              : undefined
        }
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {t('admin.common.save')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          {t('admin.common.cancel')}
        </Button>
      </div>
    </form>
  );
}
