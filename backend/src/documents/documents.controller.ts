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
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { DocumentsService } from './documents.service';
import { CreateDocumentSubcategoryDto } from './dto/create-document-subcategory.dto';
import { UpdateDocumentSubcategoryDto } from './dto/update-document-subcategory.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateDocumentLinkDto } from './dto/create-document-link.dto';
import { UpdateDocumentLinkDto } from './dto/update-document-link.dto';

const documentsDir = path.resolve(process.cwd(), 'storage', 'documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

@Controller('documents')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission('search', 'view')
  list(
    @Query('q') q: string | undefined,
    @Query('category') category: string | undefined,
    @Query('subcategoryId') subcategoryId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.list(
      { q, category, subcategoryId, localityId, page, pageSize },
      user,
    );
  }

  @Get('subcategories')
  @RequirePermission('search', 'view')
  listSubcategories(
    @Query('category') category: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.listSubcategories({ category }, user);
  }

  @Post('subcategories')
  @RequirePermission('search', 'view')
  createSubcategory(
    @Body() dto: CreateDocumentSubcategoryDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.createSubcategory(dto, user);
  }

  @Put('subcategories/:id')
  @RequirePermission('search', 'view')
  updateSubcategory(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentSubcategoryDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.updateSubcategory(id, dto, user);
  }

  @Delete('subcategories/:id')
  @RequirePermission('search', 'view')
  deleteSubcategory(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    this.assertDocumentsAccess(user);
    return this.documents.deleteSubcategory(id, user);
  }

  @Get('coverage')
  @RequirePermission('search', 'view')
  coverage(@CurrentUser() user: RbacUser) {
    this.assertDocumentsAccess(user);
    return this.documents.coverage(user);
  }

  @Get('links')
  @RequirePermission('search', 'view')
  listLinks(
    @Query('documentId') documentId: string | undefined,
    @Query('entityType') entityType: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.listLinks(
      { documentId, entityType, entityId, pageSize },
      user,
    );
  }

  @Post('links')
  @RequirePermission('search', 'view')
  createLink(@Body() dto: CreateDocumentLinkDto, @CurrentUser() user: RbacUser) {
    this.assertDocumentsAccess(user);
    return this.documents.createLink(dto, user);
  }

  @Put('links/:linkId')
  @RequirePermission('search', 'view')
  updateLink(
    @Param('linkId') linkId: string,
    @Body() dto: UpdateDocumentLinkDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.updateLink(linkId, dto, user);
  }

  @Delete('links/:linkId')
  @RequirePermission('search', 'view')
  deleteLink(@Param('linkId') linkId: string, @CurrentUser() user: RbacUser) {
    this.assertDocumentsAccess(user);
    return this.documents.deleteLink(linkId, user);
  }

  @Get('link-candidates')
  @RequirePermission('search', 'view')
  linkCandidates(
    @Query('entityType') entityType: string,
    @Query('q') q: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.listLinkCandidates({ entityType, q, pageSize }, user);
  }

  @Get(':id/content')
  @RequirePermission('search', 'view')
  getContent(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    this.assertDocumentsAccess(user);
    return this.documents.getContent(id, user);
  }

  @Get(':id')
  @RequirePermission('search', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    this.assertDocumentsAccess(user);
    return this.documents.getById(id, user);
  }

  @Put(':id')
  @RequirePermission('search', 'view')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertDocumentsAccess(user);
    return this.documents.update(id, dto, user);
  }

  @Get(':id/download')
  @RequirePermission('search', 'view')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    this.assertDocumentsAccess(user);
    const document = await this.documents.getById(id, user);

    const fileName = document.storageKey ?? path.basename(document.fileUrl);
    const filePath = path.join(documentsDir, fileName);
    if (!fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }

    return res.download(filePath, document.fileName);
  }

  private assertDocumentsAccess(user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
