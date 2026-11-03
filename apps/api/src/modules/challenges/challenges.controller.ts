import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  ChallengeDto,
  ChallengesQuery,
  CommentBodyDto,
  CreateChallengeDto,
  UpdateChallengeDto,
} from './challenges.dto';
import { ChallengesService } from './challenges.service';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  @ApiOkResponse({ type: ChallengeDto, isArray: true })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ChallengesQuery,
  ): Promise<ChallengeDto[]> {
    return this.challenges.list(auth.userId, query.menteeId);
  }

  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: ChallengeDto })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateChallengeDto,
  ): Promise<ChallengeDto> {
    return this.challenges.create(auth.userId, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ChallengeDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateChallengeDto,
  ): Promise<ChallengeDto> {
    return this.challenges.update(auth.userId, id, body);
  }

  @Post(':id/comments')
  @HttpCode(200)
  @ApiOkResponse({ type: ChallengeDto })
  comment(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CommentBodyDto,
  ): Promise<ChallengeDto> {
    return this.challenges.comment(auth.userId, id, body.body);
  }
}
