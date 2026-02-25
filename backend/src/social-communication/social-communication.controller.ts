import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateSocialCommunicationArticleDto } from './dto/create-social-communication-article.dto';
import { ResolveSocialCommunicationMetadataDto } from './dto/resolve-social-communication-metadata.dto';
import { UpdateSocialCommunicationArticleDto } from './dto/update-social-communication-article.dto';
import { SocialCommunicationService } from './social-communication.service';

@Controller('social-communication')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SocialCommunicationController {
  constructor(private readonly socialCommunication: SocialCommunicationService) {}

  @Get()
  list(@Query('q') q: string | undefined) {
    return this.socialCommunication.list({ q });
  }

  @Post('metadata')
  resolveMetadata(
    @Body() dto: ResolveSocialCommunicationMetadataDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.resolveMetadata(dto.url, user);
  }

  @Post()
  create(@Body() dto: CreateSocialCommunicationArticleDto, @CurrentUser() user: RbacUser) {
    return this.socialCommunication.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSocialCommunicationArticleDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.socialCommunication.remove(id, user);
  }
}
