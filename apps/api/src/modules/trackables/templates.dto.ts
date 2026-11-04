import {
  ApiPropertyOptional,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { CreateTrackableDto } from './trackables.dto';

export { TrackableTemplateDto } from './trackables.dto';

export class TemplatesQuery {
  /** Marks the templates this mentee already follows. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  menteeId?: string;
}

/** Save a trackable as a template; it then follows the template. */
export class SaveAsTemplateDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/** Changes apply to every trackable that follows the template. */
export class UpdateTemplateDto extends PartialType(
  OmitType(CreateTrackableDto, ['menteeId', 'startsOn', 'weekday'] as const),
) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
}

/** Give a mentee their own trackable from the template. */
export class AssignTemplateDto extends PickType(CreateTrackableDto, [
  'menteeId',
  'target',
  'startsOn',
  'weekday',
] as const) {}
