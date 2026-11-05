import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RolesService } from '../users/roles.service';
import type { CreateTaskDto, TaskDto, TasksQuery } from './interactions.dto';
import { newTask, taskSelect, toTaskDto } from './interactions.service';

/** How long a done task stays listed, struck through, under `recent` (BR-FU-4). */
export const DONE_TASKS_SHOWN_DAYS = 7;

/** Open tasks, and those done within the last 7 days. */
export const recentTasks = () => ({
  OR: [
    { doneAt: null },
    {
      doneAt: {
        gte: new Date(Date.now() - DONE_TASKS_SHOWN_DAYS * 86_400_000),
      },
    },
  ],
});

/** One-time tasks (BR-FU-4). */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly roles: RolesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The mentor (or an admin) sets a task on its own, outside a follow-up. */
  async create(actorId: string, dto: CreateTaskDto): Promise<TaskDto> {
    const allowed =
      !!(await this.access.currentMentorship(actorId, dto.assigneeId)) ||
      (await this.roles.isAdmin(actorId));
    if (!allowed) throw forbidden();
    const row = await this.prisma.task.create({
      data: newTask(dto, dto.assigneeId, actorId),
      select: taskSelect,
    });
    await this.notifications.notify(
      [dto.assigneeId],
      'TASK_ASSIGNED',
      {
        taskId: row.id,
        title: row.title,
        byName: await this.notifications.nameOf(actorId),
      },
      { actorId },
    );
    return toTaskDto(row);
  }

  async list(viewerId: string, query: TasksQuery): Promise<TaskDto[]> {
    await this.access.assertCanView(viewerId, query.assigneeId);
    const status = query.status ?? 'open';
    const rows = await this.prisma.task.findMany({
      where: {
        assigneeId: query.assigneeId,
        ...(status === 'open' && { doneAt: null }),
        ...(status === 'recent' && recentTasks()),
      },
      select: taskSelect,
      orderBy: [
        { doneAt: { sort: 'desc', nulls: 'first' } },
        { dueOn: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    return rows.map(toTaskDto);
  }

  /** The mentee ticks their own tasks; their mentor and admins can too. */
  async setDone(viewerId: string, id: string, done: boolean): Promise<TaskDto> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task)
      throw new AppException(404, {
        code: 'NOT_FOUND',
        title: 'Task not found',
      });
    if (!(await this.access.canView(viewerId, task.assigneeId)))
      throw forbidden();
    const row = await this.prisma.task.update({
      where: { id },
      data: { doneAt: done ? (task.doneAt ?? new Date()) : null },
      select: taskSelect,
    });
    return toTaskDto(row);
  }
}
