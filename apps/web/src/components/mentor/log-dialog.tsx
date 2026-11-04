import { useRouterState } from '@tanstack/react-router';
import { CalendarCheck, Plus, Tent } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  useToast,
} from '@tarbya/ui';
import { useMe } from '../../auth/session';
import { ActivityForm } from './activity-form';
import { FollowUpForm } from './follow-up-form';
import { LastContact, useMyMentees } from './last-contact';

type Kind = 'follow-up' | 'activity';
type Open = (kind: Kind, menteeId?: string) => void;

const LogContext = createContext<Open>(() => undefined);

/** Opens the follow-up or activity dialog, for a mentee if given. */
export const useLogDialog = () => useContext(LogContext);

/** The mentee whose page is open, if any. */
function usePageMenteeId() {
  return useRouterState({
    select: (s) =>
      (
        s.matches.find((m) => m.routeId === '/_app/people/$id')?.params as
          { id?: string } | undefined
      )?.id,
  });
}

/**
 * US-4.3, US-4.4: mentors log follow-ups and activities from a "+" button on
 * every page, in a dialog over whatever they were looking at.
 */
export function LogProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const pageMenteeId = usePageMenteeId();
  const [state, setState] = useState<{ kind: Kind; menteeId?: string } | null>(
    null,
  );
  const open = useCallback<Open>(
    (kind, menteeId) => setState({ kind, menteeId: menteeId ?? pageMenteeId }),
    [pageMenteeId],
  );
  const isMentor = me.roles.includes('MENTOR');

  return (
    <LogContext.Provider value={open}>
      {children}
      {isMentor && (
        <>
          <LogFab onPick={(kind) => open(kind)} />
          <LogDialog state={state} onClose={() => setState(null)} />
        </>
      )}
    </LogContext.Provider>
  );
}

function LogFab({ onPick }: { onPick: (kind: Kind) => void }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('mentoring.log.fab')}
          className="fixed bottom-6 end-6 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 data-[state=open]:rotate-45"
        >
          <Plus className="size-7" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={8}>
        <DropdownMenuItem onSelect={() => onPick('follow-up')}>
          <CalendarCheck aria-hidden />
          {t('mentoring.log.followUp')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick('activity')}>
          <Tent aria-hidden />
          {t('mentoring.log.activity')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LogDialog({
  state,
  onClose,
}: {
  state: { kind: Kind; menteeId?: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { mentees, isSuccess } = useMyMentees();
  const [chosen, setChosen] = useState<string | null>(null);
  const kind = state?.kind ?? 'follow-up';
  // A page's mentee counts only if they're mine.
  const preset = mentees.find((m) => m.mentee.id === state?.menteeId);
  const menteeId = chosen ?? preset?.mentee.id ?? '';
  const mentee = mentees.find((m) => m.mentee.id === menteeId);
  const close = () => {
    setChosen(null);
    onClose();
  };
  const saved = () => {
    toast(
      kind === 'follow-up'
        ? t('mentoring.log.savedFollowUp')
        : t('mentoring.log.savedActivity'),
    );
    close();
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={
          kind === 'follow-up'
            ? t('mentoring.log.followUpTitle')
            : t('mentoring.log.activityTitle')
        }
        closeLabel={t('admin.common.close')}
        className="w-[min(760px,calc(100vw-32px))] gap-4"
      >
        {kind === 'follow-up' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="log-mentee"
                className="text-sm font-semibold text-ink-muted"
              >
                {t('mentoring.log.mentee')}
              </label>
              <Select
                id="log-mentee"
                value={menteeId}
                onChange={(e) => setChosen(e.target.value)}
              >
                <option value="">{t('mentoring.log.chooseMentee')}</option>
                {mentees.map((m) => (
                  <option key={m.mentee.id} value={m.mentee.id}>
                    {m.mentee.name}
                  </option>
                ))}
              </Select>
              {mentee ? (
                <LastContact mentee={mentee} />
              ) : (
                isSuccess &&
                !mentees.length && (
                  <span className="text-[13px] text-ink-subtle">
                    {t('mentoring.log.noMentees')}
                  </span>
                )
              )}
            </div>
            {mentee && (
              <FollowUpForm
                key={mentee.mentee.id}
                menteeId={mentee.mentee.id}
                onSaved={saved}
                onCancel={close}
              />
            )}
          </>
        ) : (
          state && (
            <ActivityForm
              participants={preset ? [preset.mentee] : []}
              onSaved={saved}
              onCancel={close}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
