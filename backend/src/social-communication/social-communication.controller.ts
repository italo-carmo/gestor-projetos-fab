import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateSocialCommunicationArticleDto } from './dto/create-social-communication-article.dto';
import { CreateSocialCommunicationHighlightDto } from './dto/create-social-communication-highlight.dto';
import { LookupSocialCommunicationHighlightLdapDto } from './dto/lookup-social-communication-highlight-ldap.dto';
import { ResolveSocialCommunicationMetadataDto } from './dto/resolve-social-communication-metadata.dto';
import { UpdateSocialCommunicationArticleDto } from './dto/update-social-communication-article.dto';
import { UpdateSocialCommunicationHighlightDto } from './dto/update-social-communication-highlight.dto';
import { SocialCommunicationService } from './social-communication.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { throwError } from '../common/http-error';
import { getSocialCommunicationCoversDir } from './social-communication-storage';

const uploadDir = getSocialCommunicationCoversDir();
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('social-communication')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SocialCommunicationController {
  constructor(
    private readonly socialCommunication: SocialCommunicationService,
  ) {}

  @Get()
  list(
    @Query('q') q: string | undefined,
    @Query('tag') tag: string | string[] | undefined,
  ) {
    const tags = Array.isArray(tag) ? tag : tag ? [tag] : undefined;
    return this.socialCommunication.list({ q, tags });
  }

  @Post('metadata')
  resolveMetadata(
    @Body() dto: ResolveSocialCommunicationMetadataDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.resolveMetadata(dto.url, user);
  }

  @Get('highlights')
  listHighlights(@Query('q') q: string | undefined) {
    return this.socialCommunication.listHighlights({ q });
  }

  @Get('highlights/ldap-profile')
  lookupHighlightLdapProfile(
    @Query() query: LookupSocialCommunicationHighlightLdapDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.lookupHighlightLdapProfile(
      query.email,
      user,
    );
  }

  @Post('highlights')
  createHighlight(
    @Body() dto: CreateSocialCommunicationHighlightDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.createHighlight(dto, user);
  }

  @Post()
  create(
    @Body() dto: CreateSocialCommunicationArticleDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.create(dto, user);
  }

  @Post('upload-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension =
            extension && extension.length <= 10 ? extension : '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const mimetype = String(file.mimetype ?? '').toLowerCase();
        cb(null, mimetype.startsWith('image/'));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  async uploadCover(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RbacUser,
  ) {
    this.socialCommunication.ensureEditorAccess(user);
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }
    return { coverImageUrl: `/social-communication/uploads/${file.filename}` };
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSocialCommunicationArticleDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.update(id, dto, user);
  }

  @Put('highlights/:id')
  updateHighlight(
    @Param('id') id: string,
    @Body() dto: UpdateSocialCommunicationHighlightDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.socialCommunication.updateHighlight(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.socialCommunication.remove(id, user);
  }

  @Delete('highlights/:id')
  removeHighlight(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.socialCommunication.removeHighlight(id, user);
  }
}
