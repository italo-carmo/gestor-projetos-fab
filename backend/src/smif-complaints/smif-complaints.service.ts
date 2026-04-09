import { Injectable } from '@nestjs/common';
import { CpcaService, SMIF_WORKFLOW_CONTEXT } from '../cpca/cpca.service';
import { AddCpcaCaseCommentDto } from '../cpca/dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseDto } from '../cpca/dto/create-cpca-case.dto';
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

  async create(payload: CreateCpcaCaseDto, user?: RbacUser) {
    return this.cpca.create(payload, user, SMIF_WORKFLOW_CONTEXT);
  }

  async update(id: string, payload: UpdateCpcaCaseDto, user?: RbacUser) {
    return this.cpca.update(id, payload, user, SMIF_WORKFLOW_CONTEXT);
  }

  async remove(id: string, user?: RbacUser) {
    return this.cpca.remove(id, user, SMIF_WORKFLOW_CONTEXT);
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
