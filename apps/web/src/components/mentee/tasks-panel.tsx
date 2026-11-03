import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  tasksControllerList,
  tasksControllerUpdate,
  type TaskDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate } from '@tarbya/shared';
import { cn } from '@tarbya/ui';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { mineQueryKey } from '../mentor/form-parts';

/** A mentee's one-time tasks, open first (BR-FU-4). The mentee, their mentor and admins tick them. */
export function TasksPanel({
  menteeId,
  openOnly = false,
}: {
  menteeId: string;
  /** Hide done tasks (the follow-up screen); the profile shows all. */
  openOnly?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = openOnly ? 'open' : 'all';
  const queryKey = ['tasks', menteeId, status];
  const tasks = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await tasksControllerList({ assigneeId: menteeId, status }, { signal }))
        .data as TaskDto[],
  });
  const toggle = useMutation({
    mutationFn: (task: TaskDto) =>
      tasksControllerUpdate(task.id, { done: !task.doneAt }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', menteeId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: mineQueryKey }),
      ]),
  });

  return (
    <section
      aria-labelledby="tasks-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-6"
    >
      <h2 id="tasks-title" className="text-lg font-bold text-navy">
        {openOnly ? t('mentoring.log.openTasks') : t('mentee.tasks')}
      </h2>
      {tasks.isError && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, tasks.error)}
        </p>
      )}
      {tasks.data?.length === 0 && (
        <p className="text-sm text-ink-subtle">{t('mentee.noTasks')}</p>
      )}
      <ul className="flex flex-col gap-1">
        {tasks.data?.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            busy={toggle.isPending && toggle.variables?.id === task.id}
            onToggle={() => toggle.mutate(task)}
          />
        ))}
      </ul>
      {toggle.isError && (
        <p role="alert" className="text-sm text-trend-down">
          {errorMessage(t, toggle.error)}
        </p>
      )}
    </section>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
}: {
  task: TaskDto;
  busy: boolean;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const id = `task-${task.id}`;
  return (
    <li className="flex items-start gap-3 rounded-lg px-1 py-2">
      <input
        id={id}
        type="checkbox"
        checked={!!task.doneAt}
        disabled={busy}
        onChange={onToggle}
        className="mt-1 size-4 accent-primary"
      />
      <label htmlFor={id} className="flex flex-1 cursor-pointer flex-col">
        <span
          className={cn(
            'text-[15px]',
            task.doneAt && 'text-ink-subtle line-through',
          )}
        >
          {task.title}
        </span>
        {task.dueOn && (
          <span className="text-[13px] text-ink-subtle">
            {t('journey.due', {
              date: formatDate(new Date(`${task.dueOn}T12:00:00Z`), {
                locale: i18n.language as Language,
                calendar: me.calendar,
              }),
            })}
          </span>
        )}
      </label>
    </li>
  );
}
