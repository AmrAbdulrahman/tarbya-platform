import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  mentorshipsControllerAssign,
  type MentorshipDto,
  type UserRefDto,
} from '@tarbya/api-client';
import { Button, Dialog, DialogContent } from '@tarbya/ui';
import { meQuery } from '../../auth/session';

export const mentorshipsQueryKey = ['mentorships'];

interface Pending {
  mentor: UserRefDto;
  mentee: UserRefDto;
  /** The mentee's current mentor, from the API's MENTEE_HAS_MENTOR answer. */
  current: string;
}

/**
 * Assigns a mentee; when they already have a mentor, asks in a dialog before
 * moving them (US-3.3). Render `confirmDialog` once next to the trigger.
 */
export function useAssignMentee(onAssigned?: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>();

  const assign = useMutation({
    mutationFn: async (v: {
      mentor: UserRefDto;
      mentee: UserRefDto;
      replace: boolean;
    }) =>
      (
        await mentorshipsControllerAssign({
          mentorId: v.mentor.id,
          menteeId: v.mentee.id,
          replace: v.replace,
        })
      ).data as MentorshipDto,
    onSuccess: async () => {
      setPending(undefined);
      onAssigned?.();
      // The admin may have just become a mentor (or stopped being one): roles drive the sidebar.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mentorshipsQueryKey }),
        queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
      ]);
    },
    onError: (error, v) => {
      if (error instanceof ApiError && error.code === 'MENTEE_HAS_MENTOR') {
        setPending({
          mentor: v.mentor,
          mentee: v.mentee,
          current: error.body?.detail ?? '',
        });
      }
    },
  });

  const confirmDialog = (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => !open && setPending(undefined)}
    >
      {pending && (
        <DialogContent
          title={t('mentoring.mentorships.moveTitle')}
          closeLabel={t('admin.common.close')}
        >
          <p className="text-[15px] leading-relaxed">
            {t('mentoring.mentorships.moveAsk', {
              current: pending.current,
              mentee: pending.mentee.name,
              mentor: pending.mentor.name,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => assign.mutate({ ...pending, replace: true })}
              disabled={assign.isPending}
            >
              {t('mentoring.mentorships.move')}
            </Button>
            <Button variant="outline" onClick={() => setPending(undefined)}>
              {t('admin.common.cancel')}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );

  return {
    assign: (mentor: UserRefDto, mentee: UserRefDto) =>
      assign.mutate({ mentor, mentee, replace: false }),
    /** Any failure other than "already has a mentor", which the dialog handles. */
    error:
      assign.error instanceof ApiError &&
      assign.error.code === 'MENTEE_HAS_MENTOR'
        ? null
        : assign.error,
    isPending: assign.isPending,
    isSuccess: assign.isSuccess,
    reset: assign.reset,
    confirmDialog,
  };
}
