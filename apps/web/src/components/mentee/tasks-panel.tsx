import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  tasksControllerCreate,
  tasksControllerList,
  tasksControllerUpdate,
  type TaskDto,
} from '@tarbya/api-client';
import type { Language } from '@tarbya/i18n';
import { formatDate, toZoned } from '@tarbya/shared';
import { Button, cn, Input } from '@tarbya/ui';
import { FormError } from '../login/fields';
import { errorMessage } from '../../auth/error-message';
import { useMe } from '../../auth/session';
import { mineQueryKey } from '../mentor/form-parts';

/**
 * A mentee's one-time tasks (BR-FU-4): open ones first, then those done in
 * the last 7 days, struck through. The mentee, their mentor and admins tick them; the
 * mentor and admins add them, with an optional due date.
 */
export function TasksPanel({
  menteeId,
  canManage = false,
}: {
  menteeId: string;
  canManage?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['tasks', menteeId];
  const tasks = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (
        await tasksControllerList(
          // Open ones, and those done in the last 7 days (BR-FU-4).
          { assigneeId: menteeId, status: 'recent' },
          { signal },
        )
      ).data as TaskDto[],
  });
  const refresh = () =>
    Promise.all(
      [queryKey, ['dashboard'], mineQueryKey].map((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      ),
    );
  const toggle = useMutation({
    mutationFn: (task: TaskDto) =>
      tasksControllerUpdate(task.id, { done: !task.doneAt }),
    onSuccess: refresh,
  });
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState('');
  const add = useMutation({
    mutationFn: () =>
      tasksControllerCreate({
        assigneeId: menteeId,
        title,
        dueOn: dueOn || null,
      }),
    onSuccess: async () => {
      setTitle('');
      setDueOn('');
      await refresh();
    },
  });
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) add.mutate();
  };

  return (
    <section
      aria-labelledby="tasks-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-4"
    >
      <h2
        id="tasks-title"
        className="flex items-center gap-2 text-base font-bold text-navy"
      >
        <ListChecks className="size-4 text-primary" aria-hidden />
        {t('mentee.tasks')}
      </h2>
      {canManage && (
        <form onSubmit={onAdd} className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label={t('mentee.newTask')}
              placeholder={t('mentee.newTask')}
              className="h-9 min-w-40 flex-[2_1_160px] text-[15px]"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              type="date"
              aria-label={t('mentee.taskDue')}
              title={t('mentee.taskDue')}
              className="h-9 flex-[1_1_130px] text-[15px]"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={add.isPending || !title.trim()}
            >
              {t('mentee.addTask')}
            </Button>
          </div>
          <FormError
            message={add.isError ? errorMessage(t, add.error) : undefined}
          />
        </form>
      )}
      {tasks.isError && (
        <p className="text-sm text-ink-subtle">
          {errorMessage(t, tasks.error)}
        </p>
      )}
      {tasks.data?.length === 0 && (
        <p className="text-sm text-ink-subtle">{t('mentee.noTasks')}</p>
      )}
      <ul className="flex flex-col">
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
  const overdue =
    !task.doneAt && !!task.dueOn && task.dueOn < toZoned(new Date()).date;
  return (
    <li className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
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
            task.doneAt &&
              'text-ink-subtle line-through decoration-ink-subtle decoration-2',
          )}
        >
          {task.title}
        </span>
        {task.dueOn && (
          <span
            className={cn(
              'text-[13px]',
              overdue ? 'font-semibold text-trend-down' : 'text-ink-subtle',
            )}
          >
            {overdue && <>{t('mentee.overdue')} · </>}
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
