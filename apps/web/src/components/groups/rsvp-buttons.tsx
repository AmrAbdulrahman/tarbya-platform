import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  gatheringsControllerRsvp,
  type RsvpResponse,
} from '@tarbya/api-client';
import { Button, cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { gatheringQueryKey } from './format';

/** "I'll attend" / "Can't make it" (BR-GRP-7); the chosen one stays pressed. */
export function RsvpButtons({
  gatheringId,
  value,
  size = 'sm',
}: {
  gatheringId: string;
  value: RsvpResponse | null;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const answer = useMutation({
    mutationFn: (response: RsvpResponse) =>
      gatheringsControllerRsvp(gatheringId, { response }),
    onSuccess: () =>
      Promise.all(
        [
          gatheringQueryKey(gatheringId),
          ['groups'],
          ['dashboard', 'journey'],
          ['group-gatherings'],
          ['notifications'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
  const choice = (
    response: RsvpResponse,
    label: string,
    Icon: typeof Check,
  ) => {
    const on = value === response;
    return (
      <Button
        type="button"
        size={size}
        variant={on ? 'primary' : 'outline'}
        aria-pressed={on}
        disabled={answer.isPending}
        onClick={() => answer.mutate(response)}
        className={cn(
          on && response === 'NOT_ATTENDING' && 'bg-warn hover:bg-warn/90',
        )}
      >
        <Icon aria-hidden />
        {label}
      </Button>
    );
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {choice('ATTENDING', t('groups.attend'), Check)}
        {choice('NOT_ATTENDING', t('groups.decline'), X)}
      </div>
      {answer.isError && (
        <p role="alert" className="text-sm text-trend-down">
          {errorMessage(t, answer.error)}
        </p>
      )}
    </div>
  );
}
