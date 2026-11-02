import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import type { TaskDto, TasksQuery } from './interactions.dto';
import { taskSelect, toTaskDto } from './interactions.service';

/** One-time tasks (BR-FU-4). */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
  ) {}

  async list(viewerId: string, query: TasksQuery): Promise<TaskDto[]> {
    await this.access.assertCanView(viewerId, query.assigneeId);
    const rows = await this.prisma.task.findMany({
      where: {
        assigneeId: query.assigneeId,
        ...((query.status ?? 'open') === 'open' && { doneAt: null }),
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
