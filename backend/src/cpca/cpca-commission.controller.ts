import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { CpcaCommissionService } from './cpca-commission.service';
import { ApproveCpcaPresidentRequestDto } from './dto/approve-cpca-president-request.dto';
import { CreateCpcaCommissionMemberDto } from './dto/create-cpca-commission-member.dto';
import { CreateCpcaPresidentNominationRequestDto } from './dto/create-cpca-president-nomination-request.dto';
import { CreateCpcaPresidentDto } from './dto/create-cpca-president.dto';
import { CreateCpcaPresidentSelfRegistrationDto } from './dto/create-cpca-president-self-registration.dto';
import { LookupCpcaPresidentCandidateDto } from './dto/lookup-cpca-president-candidate.dto';
import { RejectCpcaPresidentRequestDto } from './dto/reject-cpca-president-request.dto';
import { UpdateCpcaCommissionCoverageDto } from './dto/update-cpca-commission-coverage.dto';

@Controller('cpca-commission')
export class CpcaCommissionController {
  constructor(private readonly cpcaCommission: CpcaCommissionService) {}

  @Get('self-registration/localities')
  listSelfRegistrationLocalities() {
    return this.cpcaCommission.listSelfRegistrationLocalities();
  }

  @Post('self-registration')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  createSelfRegistration(
    @Body() dto: CreateCpcaPresidentSelfRegistrationDto,
    @Req() req: Request,
  ) {
    return this.cpcaCommission.createSelfRegistration(
      {
        identifier: dto.identifier,
        localityId: dto.localityId,
        isSubstitution: dto.isSubstitution,
        bulletinNumber: dto.bulletinNumber,
      },
      req.ip,
    );
  }

  @Post('self-registration/lookup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  lookupSelfRegistrationCandidate(
    @Body() dto: LookupCpcaPresidentCandidateDto,
  ) {
    return this.cpcaCommission.lookupSelfRegistrationCandidate(dto.identifier);
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'view')
  overview(
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.commissionOverview(user, localityId);
  }

  @Post('presidents')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  assignPresident(
    @Body() dto: CreateCpcaPresidentDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.assignPresident(
      {
        identifier: dto.identifier,
        localityId: dto.localityId,
        isSubstitution: dto.isSubstitution,
        proceedWithExistingPresident: dto.proceedWithExistingPresident,
        designationBulletin: dto.designationBulletin,
      },
      user,
    );
  }

  @Post('presidents/lookup')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  lookupPresidentCandidate(
    @Body() dto: LookupCpcaPresidentCandidateDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.lookupPresidentCandidate(dto.identifier, user);
  }

  @Post('members')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  addMember(
    @Body() dto: CreateCpcaCommissionMemberDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.addMember(
      {
        identifier: dto.identifier,
        localityId: dto.localityId,
      },
      user,
    );
  }

  @Put('coverage')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  updateCoverage(
    @Body() dto: UpdateCpcaCommissionCoverageDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.updateCoverage(
      {
        localityId: dto.localityId,
        managedLocalityIds: dto.managedLocalityIds ?? [],
      },
      user,
    );
  }

  @Delete('members/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  removeMember(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpcaCommission.removeMember(id, user);
  }

  @Get('president-requests')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'view')
  listPresidentRequests(
    @Query('status') status: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.listPresidentRequests(user, status);
  }

  @Get('approval-requests')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'view')
  listApprovalRequests(
    @Query('status') status: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.listApprovalRequests(user, status);
  }

  @Get('approval-requests/pending-count')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'view')
  pendingApprovalRequestsCount(@CurrentUser() user: RbacUser) {
    return this.cpcaCommission.pendingApprovalRequestsCount(user);
  }

  @Get('president-requests/pending-count')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'view')
  pendingPresidentRequestsCount(@CurrentUser() user: RbacUser) {
    return this.cpcaCommission.pendingPresidentRequestsCount(user);
  }

  @Post('president-requests/:id/approve')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  approvePresidentRequest(
    @Param('id') id: string,
    @Body() dto: ApproveCpcaPresidentRequestDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.approvePresidentRequest(
      id,
      { proceedWithExistingPresident: dto.proceedWithExistingPresident },
      user,
    );
  }

  @Post('president-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  rejectPresidentRequest(
    @Param('id') id: string,
    @Body() dto: RejectCpcaPresidentRequestDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.rejectPresidentRequest(
      id,
      { notes: dto.notes },
      user,
    );
  }

  @Post('president-nominations')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  createPresidentNominationRequest(
    @Body() dto: CreateCpcaPresidentNominationRequestDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.createPresidentNominationRequest(
      {
        identifier: dto.identifier,
        localityId: dto.localityId,
        isSubstitution: dto.isSubstitution,
        bulletinNumber: dto.bulletinNumber,
      },
      user,
    );
  }

  @Post('approval-requests/:type/:id/approve')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  approveApprovalRequest(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() dto: ApproveCpcaPresidentRequestDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.approveApprovalRequest(
      type,
      id,
      { proceedWithExistingPresident: dto.proceedWithExistingPresident },
      user,
    );
  }

  @Post('approval-requests/:type/:id/reject')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  rejectApprovalRequest(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() dto: RejectCpcaPresidentRequestDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaCommission.rejectApprovalRequest(
      type,
      id,
      { notes: dto.notes },
      user,
    );
  }
}
