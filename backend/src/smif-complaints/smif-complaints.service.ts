import { Injectable } from '@nestjs/common';
import { CpcaService, SMIF_WORKFLOW_CONTEXT } from '../cpca/cpca.service';
import { AddCpcaCaseCommentDto } from '../cpca/dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseCipavdThreadDto } from '../cpca/dto/create-cpca-case-cipavd-thread.dto';
import { CreateCpcaCaseDto } from '../cpca/dto/create-cpca-case.dto';
import { FinalizeCpcaCaseCipavdThreadDto } from '../cpca/dto/finalize-cpca-case-cipavd-thread.dto';
import { ReopenCpcaCaseCipavdThreadDto } from '../cpca/dto/reopen-cpca-case-cipavd-thread.dto';
import { ResolveCpcaCaseCipavdThreadDto } from '../cpca/dto/resolve-cpca-case-cipavd-thread.dto';
import { UpdateCpcaCaseCipavdThreadDto } from '../cpca/dto/update-cpca-case-cipavd-thread.dto';
import { UpdateCpcaCaseDto } from '../cpca/dto/update-cpca-case.dto';
import type { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class SmifComplaintsService {
  constructor(private readonly cpca: CpcaService) {}

  async list(
    filters: {
      localityId?: string;
      status?: string;
      complaintType?: string;
      detailedViolenceType?: string;
      procedureType?: string;
      q?: string;
      page?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    return this.cpca.list(filters, user, SMIF_WORKFLOW_CONTEXT);
  }

  async getById(id: string, user?: RbacUser) {
    return this.cpca.getById(id, user, SMIF_WORKFLOW_CONTEXT);
  }

  async markSeen(id: string, user?: RbacUser) {
    return this.cpca.markComplaintSeen(id, user, SMIF_WORKFLOW_CONTEXT);
  }

  async pendingSummary(
    filters: {
      localityId?: string;
      status?: string;
      complaintType?: string;
      detailedViolenceType?: string;
      procedureType?: string;
      q?: string;
      page?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    return this.cpca.pendingSummary(filters, user, SMIF_WORKFLOW_CONTEXT);
  }

  async procedureSummary(
    filters: {
      localityId?: string;
      status?: string;
      complaintType?: string;
      detailedViolenceType?: string;
      procedureType?: string;
      q?: string;
    },
    user?: RbacUser,
  ) {
    return this.cpca.procedureSummary(filters, user, SMIF_WORKFLOW_CONTEXT);
  }

  async create(payload: CreateCpcaCaseDto, user?: RbacUser) {
    return this.cpca.create(payload, user, SMIF_WORKFLOW_CONTEXT);
  }

  async update(id: string, payload: UpdateCpcaCaseDto, user?: RbacUser) {
    return this.cpca.update(id, payload, user, SMIF_WORKFLOW_CONTEXT);
  }

  async remove(id: string, user?: RbacUser) {
    return this.cpca.remove(id, user, SMIF_WORKFLOW_CONTEXT);
  }

  async createCipavdThread(
    id: string,
    payload: CreateCpcaCaseCipavdThreadDto,
    user?: RbacUser,
  ) {
    return this.cpca.createCipavdThread(
      id,
      payload,
      user,
      SMIF_WORKFLOW_CONTEXT,
    );
  }

  async updateCipavdThread(
    id: string,
    threadId: string,
    payload: UpdateCpcaCaseCipavdThreadDto,
    user?: RbacUser,
  ) {
    return this.cpca.updateCipavdThread(
      id,
      threadId,
      payload,
      user,
      SMIF_WORKFLOW_CONTEXT,
    );
  }

  async removeCipavdThread(id: string, threadId: string, user?: RbacUser) {
    return this.cpca.removeCipavdThread(
      id,
      threadId,
      user,
      SMIF_WORKFLOW_CONTEXT,
    );
  }

  async resolveCipavdThread(
    id: string,
    threadId: string,
    payload: ResolveCpcaCaseCipavdThreadDto,
    user?: RbacUser,
  ) {
    return this.cpca.resolveCipavdThread(
      id,
      threadId,
      payload,
      user,
      SMIF_WORKFLOW_CONTEXT,
    );
  }

  async reopenCipavdThread(
    id: string,
    threadId: string,
    payload: ReopenCpcaCaseCipavdThreadDto,
    user?: RbacUser,
  ) {
    return this.cpca.reopenCipavdThread(
      id,
      threadId,
      payload,
      user,
      SMIF_WORKFLOW_CONTEXT,
    );
  }

  async finalizeCipavdThread(
    id: string,
    threadId: string,
    payload: FinalizeCpcaCaseCipavdThreadDto,
    user?: RbacUser,
  ) {
    return this.cpca.finalizeCipavdThread(
      id,
      threadId,
      payload,
      user,
      SMIF_WORKFLOW_CONTEXT,
    );
  }

  async listComments(id: string, user?: RbacUser) {
    return this.cpca.listComments(id, user, SMIF_WORKFLOW_CONTEXT);
  }

  async addComment(
    id: string,
    payload: AddCpcaCaseCommentDto,
    user?: RbacUser,
  ) {
    return this.cpca.addComment(id, payload.text, user, SMIF_WORKFLOW_CONTEXT);
  }
}
