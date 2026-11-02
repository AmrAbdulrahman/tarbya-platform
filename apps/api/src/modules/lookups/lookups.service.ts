import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { AppException } from '../../common/app-exception';
import type {
  ActivityTypeDto,
  CreateActivityTypeDto,
  CreateTrackingMethodDto,
  TrackingMethodDto,
  UpdateActivityTypeDto,
  UpdateTrackingMethodDto,
} from './lookups.dto';

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Lookup not found' });

const activityTypeSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  scope: true,
  color: true,
  requiresRsvp: true,
  tracksAttendance: true,
  showInFeed: true,
  reminder: true,
  active: true,
} as const;

const trackingMethodSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  active: true,
} as const;

/**
 * Lookups (US-3.5, BR-ADM-2). There is no delete: switching `active` off hides a
 * value from pickers and keeps the history that uses it.
 */
@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  activityTypes(): Promise<ActivityTypeDto[]> {
    return this.prisma.activityType.findMany({
      select: activityTypeSelect,
      orderBy: [{ scope: 'asc' }, { nameEn: 'asc' }],
    });
  }

  createActivityType(dto: CreateActivityTypeDto): Promise<ActivityTypeDto> {
    return this.prisma.activityType.create({
      data: dto,
      select: activityTypeSelect,
    });
  }

  async updateActivityType(
    id: string,
    dto: UpdateActivityTypeDto,
  ): Promise<ActivityTypeDto> {
    if (!(await this.prisma.activityType.count({ where: { id } })))
      throw notFound();
    return this.prisma.activityType.update({
      where: { id },
      data: dto,
      select: activityTypeSelect,
    });
  }

  trackingMethods(): Promise<TrackingMethodDto[]> {
    return this.prisma.trackingMethod.findMany({
      select: trackingMethodSelect,
      orderBy: { nameEn: 'asc' },
    });
  }

  createTrackingMethod(
    dto: CreateTrackingMethodDto,
  ): Promise<TrackingMethodDto> {
    return this.prisma.trackingMethod.create({
      data: dto,
      select: trackingMethodSelect,
    });
  }

  async updateTrackingMethod(
    id: string,
    dto: UpdateTrackingMethodDto,
  ): Promise<TrackingMethodDto> {
    if (!(await this.prisma.trackingMethod.count({ where: { id } })))
      throw notFound();
    return this.prisma.trackingMethod.update({
      where: { id },
      data: dto,
      select: trackingMethodSelect,
    });
  }
}
