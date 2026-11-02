import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Requires } from '../../common/access';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  AssignMentorshipDto,
  AssignResultDto,
  MentorshipDto,
  MyMentoringDto,
} from './mentorships.dto';
import { MentorshipsService } from './mentorships.service';

@ApiTags('mentorships')
@Controller('mentorships')
export class MentorshipsController {
  constructor(private readonly mentorships: MentorshipsService) {}

  /** The signed-in user's mentor and mentees. */
  @Get('mine')
  @ApiOkResponse({ type: MyMentoringDto })
  mine(@CurrentAuth() auth: AuthContext): Promise<MyMentoringDto> {
    return this.mentorships.mine(auth.userId);
  }

  @Get()
  @Requires('admin')
  @ApiOkResponse({ type: MentorshipDto, isArray: true })
  active(): Promise<MentorshipDto[]> {
    return this.mentorships.active();
  }

  /** US-3.3 */
  @Post()
  @Requires('admin')
  @HttpCode(200)
  @ApiOkResponse({ type: AssignResultDto })
  @ApiConflictResponse({
    description: 'MENTEE_HAS_MENTOR, MENTORSHIP_CYCLE, USER_INACTIVE',
  })
  assign(
    @CurrentAuth() auth: AuthContext,
    @Body() body: AssignMentorshipDto,
  ): Promise<AssignResultDto> {
    return this.mentorships.assign(auth.userId, body);
  }

  @Post(':id/end')
  @Requires('admin')
  @HttpCode(200)
  @ApiOkResponse({ type: MentorshipDto })
  end(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MentorshipDto> {
    return this.mentorships.end(auth.userId, id);
  }
}
