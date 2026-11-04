import type { Prisma, PrismaService } from '@tarbya/db';
import type { TrackableTemplateDto } from './templates.dto';

const ref = { select: { id: true, name: true } } as const;

export const templateSelect = {
  id: true,
  name: true,
  goal: true,
  type: true,
  cycle: true,
  higherIsBetter: true,
  target: true,
  isPublic: true,
  authorId: true,
  author: ref,
  impersonator: ref,
} satisfies Prisma.TrackableTemplateSelect;

export type TemplateRow = Prisma.TrackableTemplateGetPayload<{
  select: typeof templateSelect;
}>;

/** In the library for this viewer: their own and everyone's public ones. */
export const visibleTo = (viewerId: string) =>
  ({
    removedAt: null,
    OR: [{ authorId: viewerId }, { isPublic: true }],
  }) satisfies Prisma.TrackableTemplateWhereInput;

/** Adds usage, edit rights and (for a mentee) whether they already follow it. */
export async function describeTemplates(
  db: PrismaService,
  rows: TemplateRow[],
  viewer: { id: string; isAdmin: boolean },
  menteeId?: string,
): Promise<TrackableTemplateDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [active, logged, assigned] = await Promise.all([
    db.trackable.groupBy({
      by: ['templateId'],
      where: { templateId: { in: ids }, archivedAt: null },
      _count: true,
    }),
    db.trackable.findMany({
      where: { templateId: { in: ids }, entries: { some: {} } },
      select: { templateId: true },
      distinct: ['templateId'],
    }),
    menteeId
      ? db.trackable.findMany({
          where: { templateId: { in: ids }, menteeId, archivedAt: null },
          select: { templateId: true },
        })
      : [],
  ]);
  const uses = new Map(active.map((a) => [a.templateId, a._count]));
  const locked = new Set(logged.map((l) => l.templateId));
  const taken = new Set(assigned.map((a) => a.templateId));
  return rows.map(({ authorId, ...r }) => ({
    ...r,
    uses: uses.get(r.id) ?? 0,
    canEdit: viewer.isAdmin || authorId === viewer.id,
    reshapable: !locked.has(r.id),
    assigned: taken.has(r.id),
  }));
}
