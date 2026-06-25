import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { DocumentsService } from './documents.service';
import { CreateDocumentSubcategoryDto } from './dto/create-document-subcategory.dto';
import { UpdateDocumentSubcategoryDto } from './dto/update-document-subcategory.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateDocumentLinkDto } from './dto/create-document-link.dto';
import { UpdateDocumentLinkDto } from './dto/update-document-link.dto';
import { CreateOnlineDocumentDto } from './dto/create-online-document.dto';
import { UpdateOnlineDocumentContentDto } from './dto/update-online-document-content.dto';

const documentsDir = path.resolve(process.cwd(), 'storage', 'documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

@Controller('documents')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission('documents', 'view')
  list(
    @Query('q') q: string | undefined,
    @Query('category') category: string | undefined,
    @Query('subcategoryId') subcategoryId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.list(
      { q, category, subcategoryId, localityId, page, pageSize },
      user,
    );
  }

  @Get('subcategories')
  @RequirePermission('documents', 'view')
  listSubcategories(
    @Query('category') category: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.listSubcategories({ category }, user);
  }

  @Post('subcategories')
  @RequirePermission('documents', 'create')
  createSubcategory(
    @Body() dto: CreateDocumentSubcategoryDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.createSubcategory(dto, user);
  }

  @Post('online')
  @RequirePermission('documents', 'create')
  createOnlineDocument(
    @Body() dto: CreateOnlineDocumentDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.createOnlineDocument(dto, user);
  }

  @Put('subcategories/:id')
  @RequirePermission('documents', 'update')
  updateSubcategory(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentSubcategoryDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.updateSubcategory(id, dto, user);
  }

  @Delete('subcategories/:id')
  @RequirePermission('documents', 'delete')
  deleteSubcategory(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.documents.deleteSubcategory(id, user);
  }

  @Get('coverage')
  @RequirePermission('documents', 'view')
  coverage(@CurrentUser() user: RbacUser) {
    return this.documents.coverage(user);
  }

  @Get('links')
  @RequirePermission('documents', 'view')
  listLinks(
    @Query('documentId') documentId: string | undefined,
    @Query('entityType') entityType: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.listLinks(
      { documentId, entityType, entityId, pageSize },
      user,
    );
  }

  @Post('links')
  @RequirePermission('documents', 'create')
  createLink(
    @Body() dto: CreateDocumentLinkDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.createLink(dto, user);
  }

  @Put('links/:linkId')
  @RequirePermission('documents', 'update')
  updateLink(
    @Param('linkId') linkId: string,
    @Body() dto: UpdateDocumentLinkDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.updateLink(linkId, dto, user);
  }

  @Delete('links/:linkId')
  @RequirePermission('documents', 'delete')
  deleteLink(@Param('linkId') linkId: string, @CurrentUser() user: RbacUser) {
    return this.documents.deleteLink(linkId, user);
  }

  @Get('link-candidates')
  @RequirePermission('documents', 'view')
  linkCandidates(
    @Query('entityType') entityType: string,
    @Query('q') q: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.listLinkCandidates({ entityType, q, pageSize }, user);
  }

  @Get(':id/editor')
  @RequirePermission('documents', 'view')
  getOnlineDocument(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.documents.getOnlineDocument(id, user);
  }

  @Put(':id/editor')
  @RequirePermission('documents', 'update')
  saveOnlineDocument(
    @Param('id') id: string,
    @Body() dto: UpdateOnlineDocumentContentDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.saveOnlineDocument(id, dto, user);
  }

  @Get(':id/editor/versions')
  @RequirePermission('documents', 'view')
  listOnlineVersions(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.documents.listOnlineVersions(id, user);
  }

  @Get(':id/content')
  @RequirePermission('documents', 'view')
  getContent(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.documents.getContent(id, user);
  }

  @Get(':id')
  @RequirePermission('documents', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.documents.getById(id, user);
  }

  @Put(':id')
  @RequirePermission('documents', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.documents.update(id, dto, user);
  }

  @Get(':id/download')
  @RequirePermission('documents', 'download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const document = await this.documents.getById(id, user);

    const fileName = document.storageKey ?? path.basename(document.fileUrl);
    const filePath = path.join(documentsDir, fileName);
    if (!fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }

    return res.download(filePath, document.fileName);
  }
}
