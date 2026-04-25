import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import {
  hasAnyRole,
  ROLE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';

const CIPAVD_MANUAL_ALLOWED_ROLES = [
  ROLE_TI,
  ROLE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
];
const PRINT_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+\.png$/;

@Controller('manuals/cipavd')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ManualsController {
  @Get()
  sendCipavdManual(@CurrentUser() user: RbacUser, @Res() res: Response) {
    this.assertCipavdManualAccess(user);
    const manualRoot = this.resolveManualRoot();
    const htmlPath = path.join(manualRoot, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      throwError('NOT_FOUND');
    }

    const html = fs
      .readFileSync(htmlPath, 'utf8')
      .replace(/src=(["'])prints\//g, 'src=$1/api/manuals/cipavd/prints/');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(html);
  }

  @Get('prints/:filename')
  sendCipavdManualPrint(
    @Param('filename') filename: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    this.assertCipavdManualAccess(user);
    const safeFilename = String(filename ?? '').trim();
    if (!PRINT_FILENAME_PATTERN.test(safeFilename)) {
      throwError('NOT_FOUND');
    }

    const manualRoot = this.resolveManualRoot();
    const filePath = path.join(manualRoot, 'prints', safeFilename);
    if (!fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  }

  private assertCipavdManualAccess(user: RbacUser | undefined) {
    if (!hasAnyRole(user, CIPAVD_MANUAL_ALLOWED_ROLES)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private resolveManualRoot() {
    const candidates = [
      path.resolve(process.cwd(), 'docs/manual-cipavd'),
      path.resolve(process.cwd(), '..', 'docs/manual-cipavd'),
    ];
    const manualRoot = candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, 'index.html')),
    );
    if (!manualRoot) {
      throwError('NOT_FOUND');
    }
    return manualRoot;
  }
}
