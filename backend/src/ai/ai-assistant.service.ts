import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocalityCatalogType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from '../missions/missions.service';
import { TasksService } from '../tasks/tasks.service';

type AssistantIntent =
  | 'create_mission'
  | 'create_activity'
  | 'create_task'
  | 'create_mission_schedule';

type AssistantRole = 'user' | 'assistant';

type AssistantInputType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'number'
  | 'single_select'
  | 'multi_select'
  | 'boolean';

type AssistantFieldOption = {
  value: string;
  label: string;
  description?: string | null;
};

type AssistantFieldConfig = {
  field: string;
  label: string;
  inputType: AssistantInputType;
  placeholder?: string;
  helperText?: string;
  optional?: boolean;
  options?: AssistantFieldOption[];
  min?: number;
  max?: number;
  multiple?: boolean;
};

type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
};

type AssistantWorkflow = {
  intent: AssistantIntent;
  status: 'collecting' | 'confirming' | 'completed';
  draft: Record<string, any>;
  currentField: string | null;
};

type AssistantSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  workflow: AssistantWorkflow | null;
  messages: AssistantMessage[];
};

type AssistantQuickAction = {
  id: AssistantIntent;
  title: string;
  description: string;
};

type AssistantResultLink = {
  entityType: 'mission' | 'activity' | 'task' | 'mission_schedule';
  id: string;
  title: string;
  url: string;
};

type AssistantReply = {
  sessionId: string;
  message: AssistantMessage;
  workflow: null | {
    intent: AssistantIntent;
    title: string;
    description: string;
    status: 'collecting' | 'confirming' | 'completed';
    draft: Record<string, any>;
    summary: Array<{ label: string; value: string }>;
    currentField: AssistantFieldConfig | null;
    readyToConfirm: boolean;
    confirmLabel: string;
  };
  quickActions: AssistantQuickAction[];
  createdItem?: AssistantResultLink | null;
};

const QUICK_ACTIONS: AssistantQuickAction[] = [
  {
    id: 'create_mission',
    title: 'Criar missão',
    description: 'Conduz o cadastro de missão SMIF ou CIPAVD com confirmação final.',
  },
  {
    id: 'create_activity',
    title: 'Criar atividade de campo',
    description:
      'Pede os dados essenciais da atividade e confirma antes de registrar.',
  },
  {
    id: 'create_task',
    title: 'Criar tarefa',
    description:
      'Monta a tarefa manual com fase, prazo, prioridade e localidades.',
  },
  {
    id: 'create_mission_schedule',
    title: 'Criar cronograma em missão',
    description:
      'Adiciona um item de cronograma em uma missão já existente, com revisão antes da gravação.',
  },
];

const INTENT_META: Record<
  AssistantIntent,
  { title: string; description: string; confirmLabel: string }
> = {
  create_mission: {
    title: 'Criar missão',
    description:
      'Fluxo assistido para cadastrar missão no escopo correto, com localidade válida e confirmação explícita.',
    confirmLabel: 'Confirmar criação da missão',
  },
  create_activity: {
    title: 'Criar atividade de campo',
    description:
      'Fluxo assistido para cadastrar atividade de campo com escopo, localidades e tipo de atividade.',
    confirmLabel: 'Confirmar criação da atividade',
  },
  create_task: {
    title: 'Criar tarefa',
    description:
      'Fluxo assistido para registrar tarefa manual com fase, prioridade, prazo e localidades.',
    confirmLabel: 'Confirmar criação da tarefa',
  },
  create_mission_schedule: {
    title: 'Criar cronograma em missão',
    description:
      'Fluxo assistido para inserir um item de cronograma em missão já cadastrada.',
    confirmLabel: 'Confirmar inclusão no cronograma',
  },
};

@Injectable()
export class AiAssistantService {
  private readonly sessionTtlMs = 4 * 60 * 60 * 1000;
  private readonly sessions = new Map<string, AssistantSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionsService,
    private readonly activities: ActivitiesService,
    private readonly tasks: TasksService,
  ) {}

  listQuickActions() {
    return QUICK_ACTIONS;
  }

  resetSession(sessionId?: string | null) {
    const safeSessionId = String(sessionId ?? '').trim();
    if (safeSessionId) {
      this.sessions.delete(safeSessionId);
    }
    return { ok: true };
  }

  async handleMessage(
    payload: {
      sessionId?: string | null;
      message?: string | null;
      quickAction?: AssistantIntent | null;
      fieldInput?: { field?: string; value?: unknown } | null;
      confirmExecution?: boolean;
      cancelWorkflow?: boolean;
      skipCurrentField?: boolean;
    },
    user?: RbacUser,
  ): Promise<AssistantReply> {
    this.pruneSessions();
    const session = this.getOrCreateSession(payload.sessionId);

    if (payload.cancelWorkflow) {
      session.workflow = null;
      session.updatedAt = new Date().toISOString();
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          'Fluxo cancelado. Você pode iniciar outra ação assistida abaixo.',
        ),
        null,
        null,
      );
    }

    const quickAction = this.normalizeQuickAction(payload.quickAction);
    const rawMessage = String(payload.message ?? '').trim();
    const fieldInput = payload.fieldInput ?? null;
    const wantsSkip = payload.skipCurrentField === true;
    const wantsConfirm =
      payload.confirmExecution === true || this.isConfirmationMessage(rawMessage);

    if (quickAction) {
      if (rawMessage) {
        this.pushMessage(session, 'user', rawMessage);
      }
      session.workflow = {
        intent: quickAction,
        status: 'collecting',
        draft: {},
        currentField: null,
      };
      session.updatedAt = new Date().toISOString();
      const workflowView = await this.buildWorkflowView(session.workflow, user);
      const intro = [
        `Vou conduzir o fluxo de **${INTENT_META[quickAction].title.toLowerCase()}**.`,
        'Vou pedir apenas os campos essenciais e só executo após sua confirmação final.',
        workflowView.currentField
          ? `Primeiro passo: **${workflowView.currentField.label}**.`
          : 'Não encontrei campos para este fluxo.',
      ]
        .filter(Boolean)
        .join('\n\n');
      return this.buildReply(
        session,
        this.pushMessage(session, 'assistant', intro),
        workflowView,
        null,
      );
    }

    const detectedIntent = this.detectIntentFromText(rawMessage);
    if (!session.workflow && detectedIntent) {
      this.pushMessage(session, 'user', rawMessage);
      session.workflow = {
        intent: detectedIntent,
        status: 'collecting',
        draft: {},
        currentField: null,
      };
      session.updatedAt = new Date().toISOString();
      const workflowView = await this.buildWorkflowView(session.workflow, user);
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          [
            `Entendi que você quer **${INTENT_META[detectedIntent].title.toLowerCase()}**.`,
            'Vou seguir em modo assistido e pedir um campo por vez.',
            workflowView.currentField
              ? `Começando por **${workflowView.currentField.label}**.`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
        workflowView,
        null,
      );
    }

    if (!session.workflow) {
      if (rawMessage) {
        this.pushMessage(session, 'user', rawMessage);
      }
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          [
            'Posso atuar como assistente operacional para **criar missão**, **criar atividade de campo**, **criar tarefa** ou **incluir cronograma em missão**.',
            'Use uma ação rápida ou escreva diretamente o que deseja criar.',
          ].join('\n\n'),
        ),
        null,
        null,
      );
    }

    const workflow = session.workflow;
    const workflowView = await this.buildWorkflowView(workflow, user);

    if (rawMessage) {
      this.pushMessage(session, 'user', rawMessage);
    }

    if (wantsConfirm && workflow.status === 'confirming') {
      try {
        const createdItem = await this.executeWorkflow(workflow, user);
        workflow.status = 'completed';
        session.workflow = null;
        session.updatedAt = new Date().toISOString();
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            [
              'Ação executada com sucesso.',
              `Registro criado: **${createdItem.title}**.`,
              'Você pode abrir o item pelo link retornado ou iniciar outra ação assistida.',
            ].join('\n\n'),
          ),
          null,
          createdItem,
        );
      } catch (error) {
        const message = this.extractErrorMessage(error);
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            `Não consegui concluir a ação: ${message}\n\nRevise o rascunho atual e confirme novamente ou cancele o fluxo.`,
          ),
          workflowView,
          null,
        );
      }
    }

    if (wantsSkip) {
      const currentField = workflowView.currentField;
      if (!currentField?.optional) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'Este campo é obrigatório. Informe o valor pedido para que eu continue.',
          ),
          workflowView,
          null,
        );
      }
      workflow.draft[currentField.field] = null;
    } else if (fieldInput?.field) {
      await this.applyFieldValue(
        workflow,
        String(fieldInput.field),
        fieldInput.value,
        user,
      );
    } else if (rawMessage) {
      const currentField = workflowView.currentField;
      if (!currentField) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'O fluxo já está completo. Se estiver correto, confirme a execução.',
          ),
          workflowView,
          null,
        );
      }
      await this.applyFieldValue(workflow, currentField.field, rawMessage, user);
    }

    session.updatedAt = new Date().toISOString();
    const updatedView = await this.buildWorkflowView(workflow, user);
    if (updatedView.readyToConfirm) {
      workflow.status = 'confirming';
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          [
            `Rascunho de **${updatedView.title.toLowerCase()}** pronto para conferência.`,
            'Revise os dados abaixo. Se estiver tudo certo, confirme a execução.',
          ].join('\n\n'),
        ),
        updatedView,
        null,
      );
    }

    return this.buildReply(
      session,
      this.pushMessage(
        session,
        'assistant',
        updatedView.currentField
          ? `Certo. Agora preciso de **${updatedView.currentField.label.toLowerCase()}**.`
          : 'Fluxo atualizado.',
      ),
      updatedView,
      null,
    );
  }

  private buildReply(
    session: AssistantSession,
    message: AssistantMessage,
    workflow:
      | {
          intent: AssistantIntent;
          title: string;
          description: string;
          status: 'collecting' | 'confirming' | 'completed';
          draft: Record<string, any>;
          summary: Array<{ label: string; value: string }>;
          currentField: AssistantFieldConfig | null;
          readyToConfirm: boolean;
          confirmLabel: string;
        }
      | null,
    createdItem: AssistantResultLink | null,
  ): AssistantReply {
    return {
      sessionId: session.id,
      message,
      workflow,
      quickActions: QUICK_ACTIONS,
      createdItem,
    };
  }

  private getOrCreateSession(sessionId?: string | null) {
    const safeSessionId = String(sessionId ?? '').trim();
    if (safeSessionId) {
      const existing = this.sessions.get(safeSessionId);
      if (existing) return existing;
    }
    const now = new Date().toISOString();
    const created: AssistantSession = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      workflow: null,
      messages: [],
    };
    this.sessions.set(created.id, created);
    return created;
  }

  private pushMessage(
    session: AssistantSession,
    role: AssistantRole,
    content: string,
  ) {
    const createdAt = new Date().toISOString();
    const message: AssistantMessage = {
      id: randomUUID(),
      role,
      content,
      createdAt,
    };
    session.messages.push(message);
    session.updatedAt = createdAt;
    this.sessions.set(session.id, session);
    return message;
  }

  private pruneSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      const updatedAtMs = new Date(session.updatedAt).getTime();
      if (
        Number.isNaN(updatedAtMs) ||
        now - updatedAtMs > this.sessionTtlMs
      ) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private normalizeQuickAction(
    value: AssistantIntent | string | null | undefined,
  ): AssistantIntent | null {
    const safe = String(value ?? '').trim() as AssistantIntent;
    return QUICK_ACTIONS.some((item) => item.id === safe) ? safe : null;
  }

  private detectIntentFromText(message: string): AssistantIntent | null {
    const normalized = this.normalizeFreeText(message);
    if (!normalized) return null;
    if (
      normalized.includes('cronograma') ||
      normalized.includes('agenda da missao') ||
      normalized.includes('agenda da missão')
    ) {
      return 'create_mission_schedule';
    }
    if (normalized.includes('missao') || normalized.includes('missão')) {
      return 'create_mission';
    }
    if (
      normalized.includes('atividade de campo') ||
      normalized.includes('atividade')
    ) {
      return 'create_activity';
    }
    if (normalized.includes('tarefa')) {
      return 'create_task';
    }
    return null;
  }

  private isConfirmationMessage(message: string) {
    const normalized = this.normalizeFreeText(message);
    if (!normalized) return false;
    return [
      'confirmar',
      'pode criar',
      'crie',
      'executar',
      'pode executar',
      'confirmo',
      'prosseguir',
      'pode prosseguir',
    ].some((item) => normalized.includes(item));
  }

  private normalizeFreeText(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private async buildWorkflowView(
    workflow: AssistantWorkflow,
    user?: RbacUser,
  ) {
    const fields = await this.getFieldConfigs(workflow.intent, workflow.draft, user);
    const currentField =
      fields.find((field) => this.isFieldMissing(field, workflow.draft)) ?? null;
    workflow.currentField = currentField?.field ?? null;
    const summary = await this.buildDraftSummary(workflow.intent, workflow.draft, user);
    return {
      intent: workflow.intent,
      title: INTENT_META[workflow.intent].title,
      description: INTENT_META[workflow.intent].description,
      status: currentField ? 'collecting' : workflow.status,
      draft: workflow.draft,
      summary,
      currentField,
      readyToConfirm: !currentField,
      confirmLabel: INTENT_META[workflow.intent].confirmLabel,
    };
  }

  private isFieldMissing(
    field: AssistantFieldConfig,
    draft: Record<string, any>,
  ) {
    const value = draft[field.field];
    if (field.optional && (value === undefined || value === null || value === '')) {
      return false;
    }
    if (field.inputType === 'multi_select') {
      return !Array.isArray(value) || value.length === 0;
    }
    if (field.inputType === 'boolean') {
      return typeof value !== 'boolean';
    }
    return value === undefined || value === null || String(value).trim() === '';
  }

  private async applyFieldValue(
    workflow: AssistantWorkflow,
    fieldName: string,
    value: unknown,
    user?: RbacUser,
  ) {
    const fields = await this.getFieldConfigs(workflow.intent, workflow.draft, user);
    const field = fields.find((item) => item.field === fieldName);
    if (!field) {
      throw new BadRequestException('Campo do assistente não reconhecido.');
    }
    const normalized = this.normalizeFieldValue(field, value);
    if (field.inputType === 'single_select' && field.options?.length) {
      const option = this.resolveSingleOption(field.options, normalized);
      if (!option) {
        throw new BadRequestException(
          `Selecione uma opção válida para ${field.label.toLowerCase()}.`,
        );
      }
      workflow.draft[field.field] = option.value;
      return;
    }
    if (field.inputType === 'multi_select' && field.options?.length) {
      const resolved = this.resolveMultiOptions(field.options, normalized);
      if (!resolved.length) {
        throw new BadRequestException(
          `Selecione pelo menos uma opção válida para ${field.label.toLowerCase()}.`,
        );
      }
      workflow.draft[field.field] = resolved.map((item) => item.value);
      return;
    }
    if (field.inputType === 'boolean') {
      workflow.draft[field.field] = this.parseBooleanValue(normalized, field.label);
      return;
    }
    if (field.inputType === 'number') {
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(
          `Informe um número válido para ${field.label.toLowerCase()}.`,
        );
      }
      if (field.min !== undefined && parsed < field.min) {
        throw new BadRequestException(
          `${field.label} deve ser maior ou igual a ${field.min}.`,
        );
      }
      if (field.max !== undefined && parsed > field.max) {
        throw new BadRequestException(
          `${field.label} deve ser menor ou igual a ${field.max}.`,
        );
      }
      workflow.draft[field.field] = parsed;
      return;
    }
    if (field.inputType === 'date') {
      const parsed = this.parseDateOnly(
        Array.isArray(normalized) ? normalized[0] ?? '' : normalized,
      );
      workflow.draft[field.field] = parsed;
      return;
    }
    if (field.inputType === 'datetime') {
      const parsed = this.parseDateTime(
        Array.isArray(normalized) ? normalized[0] ?? '' : normalized,
      );
      workflow.draft[field.field] = parsed;
      return;
    }
    const text = String(normalized ?? '').trim();
    if (!field.optional && !text) {
      throw new BadRequestException(
        `Informe ${field.label.toLowerCase()} para continuar.`,
      );
    }
    workflow.draft[field.field] = text || null;
  }

  private normalizeFieldValue(field: AssistantFieldConfig, value: unknown) {
    if (field.inputType === 'multi_select' && Array.isArray(value)) {
      return value.map((item) => String(item ?? '').trim()).filter(Boolean);
    }
    return String(value ?? '').trim();
  }

  private resolveSingleOption(
    options: AssistantFieldOption[],
    value: string | string[],
  ) {
    const normalized =
      Array.isArray(value) ? this.normalizeFreeText(value[0] ?? '') : this.normalizeFreeText(value);
    return (
      options.find((item) => this.normalizeFreeText(item.value) === normalized) ??
      options.find((item) => this.normalizeFreeText(item.label) === normalized) ??
      options.find((item) =>
        this.normalizeFreeText(item.label).includes(normalized),
      )
    );
  }

  private resolveMultiOptions(
    options: AssistantFieldOption[],
    value: string | string[],
  ) {
    const rawValues = Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    const resolved: AssistantFieldOption[] = [];
    for (const item of rawValues) {
      const option = this.resolveSingleOption(options, item);
      if (!option) continue;
      if (!resolved.some((candidate) => candidate.value === option.value)) {
        resolved.push(option);
      }
    }
    return resolved;
  }

  private parseBooleanValue(value: string | string[], label: string) {
    const normalized = this.normalizeFreeText(
      Array.isArray(value) ? value[0] ?? '' : value,
    );
    if (['sim', 's', 'true', '1'].includes(normalized)) return true;
    if (['nao', 'não', 'n', 'false', '0'].includes(normalized)) return false;
    throw new BadRequestException(
      `Informe Sim ou Não para ${label.toLowerCase()}.`,
    );
  }

  private parseDateOnly(value: string) {
    const safe = String(value ?? '').trim();
    const ptMatch = safe.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ptMatch) {
      return `${ptMatch[3]}-${ptMatch[2]}-${ptMatch[1]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
      return safe;
    }
    throw new BadRequestException('Informe uma data válida no formato DD/MM/AAAA.');
  }

  private parseDateTime(value: string) {
    const safe = String(value ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(safe)) {
      return `${safe}:00`;
    }
    const ptMatch = safe.match(
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/,
    );
    if (ptMatch) {
      return `${ptMatch[3]}-${ptMatch[2]}-${ptMatch[1]}T${ptMatch[4]}:${ptMatch[5]}:00`;
    }
    throw new BadRequestException(
      'Informe data e hora válidas no formato DD/MM/AAAA HH:MM.',
    );
  }

  private async getFieldConfigs(
    intent: AssistantIntent,
    draft: Record<string, any>,
    user?: RbacUser,
  ): Promise<AssistantFieldConfig[]> {
    if (intent === 'create_mission') {
      return [
        {
          field: 'scope',
          label: 'Escopo',
          inputType: 'single_select',
          options: [
            { value: 'SMIF', label: 'SMIF' },
            { value: 'CIPAVD', label: 'CIPAVD' },
          ],
        },
        {
          field: 'localityId',
          label: 'Localidade da missão',
          inputType: 'single_select',
          options: await this.listMissionLocalityOptions(draft.scope, user),
        },
        {
          field: 'title',
          label: 'Título da missão',
          inputType: 'text',
          placeholder: 'Ex.: Missão SMIF Recife - Maio 2026',
        },
        {
          field: 'startDate',
          label: 'Data de início',
          inputType: 'date',
        },
        {
          field: 'endDate',
          label: 'Data de término',
          inputType: 'date',
        },
        {
          field: 'description',
          label: 'Descrição',
          inputType: 'textarea',
          optional: true,
          helperText: 'Campo opcional.',
        },
      ];
    }

    if (intent === 'create_activity') {
      return [
        {
          field: 'scope',
          label: 'Escopo',
          inputType: 'single_select',
          options: [
            { value: 'SMIF', label: 'SMIF' },
            { value: 'CIPAVD', label: 'CIPAVD' },
          ],
        },
        {
          field: 'localityIds',
          label: 'Localidades da atividade',
          inputType: 'multi_select',
          multiple: true,
          options: await this.listActivityLocalityOptions(draft.scope),
        },
        {
          field: 'title',
          label: 'Título da atividade',
          inputType: 'text',
        },
        {
          field: 'activityTypeId',
          label: 'Tipo de atividade',
          inputType: 'single_select',
          options: await this.listActivityTypeOptions(),
        },
        {
          field: 'eventDate',
          label: 'Data da atividade',
          inputType: 'date',
        },
        {
          field: 'reportRequired',
          label: 'Exige relatório?',
          inputType: 'boolean',
        },
        {
          field: 'description',
          label: 'Descrição',
          inputType: 'textarea',
          optional: true,
          helperText: 'Campo opcional.',
        },
      ];
    }

    if (intent === 'create_task') {
      return [
        {
          field: 'localityIds',
          label: 'Localidades da tarefa',
          inputType: 'multi_select',
          multiple: true,
          options: await this.listSmifLocalityOptions(),
        },
        {
          field: 'title',
          label: 'Título da tarefa',
          inputType: 'text',
        },
        {
          field: 'phaseId',
          label: 'Fase da tarefa',
          inputType: 'single_select',
          options: await this.listPhaseOptions(),
        },
        {
          field: 'dueDate',
          label: 'Prazo',
          inputType: 'date',
        },
        {
          field: 'priority',
          label: 'Prioridade',
          inputType: 'single_select',
          options: [
            { value: 'CRITICAL', label: 'Crítica' },
            { value: 'HIGH', label: 'Alta' },
            { value: 'MEDIUM', label: 'Média' },
            { value: 'LOW', label: 'Baixa' },
          ],
        },
        {
          field: 'description',
          label: 'Descrição',
          inputType: 'textarea',
          optional: true,
          helperText: 'Campo opcional.',
        },
      ];
    }

    return [
      {
        field: 'scope',
        label: 'Escopo da missão',
        inputType: 'single_select',
        options: [
          { value: 'SMIF', label: 'SMIF' },
          { value: 'CIPAVD', label: 'CIPAVD' },
        ],
      },
      {
        field: 'missionId',
        label: 'Missão',
        inputType: 'single_select',
        options: await this.listMissionOptions(draft.scope, user),
      },
      {
        field: 'title',
        label: 'Título do item',
        inputType: 'text',
      },
      {
        field: 'startAt',
        label: 'Início',
        inputType: 'datetime',
      },
      {
        field: 'durationMinutes',
        label: 'Duração em minutos',
        inputType: 'number',
        min: 1,
        max: 1440,
      },
      {
        field: 'location',
        label: 'Local do item',
        inputType: 'text',
      },
      {
        field: 'responsible',
        label: 'Responsável',
        inputType: 'text',
      },
      {
        field: 'participants',
        label: 'Participantes',
        inputType: 'textarea',
        optional: true,
        helperText: 'Campo opcional.',
      },
    ];
  }

  private async listMissionLocalityOptions(
    scope: string | undefined,
    user?: RbacUser,
  ) {
    const response = await this.missions.listLocalityOptions(scope, user);
    return (response?.items ?? []).map((item: any) => ({
      value: String(item.id),
      label: item.code ? `${item.code} - ${item.name}` : String(item.name),
    }));
  }

  private async listActivityLocalityOptions(scope: string | undefined) {
    const catalogType =
      String(scope ?? '').toUpperCase() === 'CIPAVD'
        ? LocalityCatalogType.CIPAVD
        : LocalityCatalogType.SMIF;
    const items = await this.prisma.locality.findMany({
      where: { catalogType },
      select: { id: true, code: true, name: true, uf: true },
      orderBy: [{ name: 'asc' }],
    });
    return items.map((item) => ({
      value: item.id,
      label: item.code ? `${item.code} - ${item.name}` : item.name,
      description: item.uf ? `UF ${item.uf}` : null,
    }));
  }

  private async listSmifLocalityOptions() {
    const items = await this.prisma.locality.findMany({
      where: { catalogType: LocalityCatalogType.SMIF },
      select: { id: true, code: true, name: true, uf: true },
      orderBy: [{ name: 'asc' }],
    });
    return items.map((item) => ({
      value: item.id,
      label: item.code ? `${item.code} - ${item.name}` : item.name,
      description: item.uf ? `UF ${item.uf}` : null,
    }));
  }

  private async listActivityTypeOptions() {
    const response = await this.activities.listTypes();
    return (response?.items ?? []).map((item: any) => ({
      value: String(item.id),
      label: String(item.name),
    }));
  }

  private async listPhaseOptions() {
    const items = await this.prisma.phase.findMany({
      select: { id: true, name: true, displayName: true, order: true },
      orderBy: [{ order: 'asc' }],
    });
    return items.map((item) => ({
      value: item.id,
      label: String(item.displayName ?? item.name),
    }));
  }

  private async listMissionOptions(
    scope: string | undefined,
    user?: RbacUser,
  ) {
    const response = await this.missions.list(
      { scope, page: '1', pageSize: '200' },
      user,
    );
    return (response?.items ?? []).map((item: any) => ({
      value: String(item.id),
      label: `${item.title} • ${item.locality?.name ?? 'Sem localidade'}`,
      description:
        item.startDate && item.endDate
          ? `${this.formatDate(item.startDate)} a ${this.formatDate(item.endDate)}`
          : null,
    }));
  }

  private async buildDraftSummary(
    intent: AssistantIntent,
    draft: Record<string, any>,
    user?: RbacUser,
  ) {
    const localityLookup = async (ids: string[] | string | null | undefined) => {
      const idList = Array.isArray(ids)
        ? ids.map((item) => String(item)).filter(Boolean)
        : ids
          ? [String(ids)]
          : [];
      if (!idList.length) return '';
      const items = await this.prisma.locality.findMany({
        where: { id: { in: idList } },
        select: { id: true, code: true, name: true },
      });
      return items
        .map((item) => (item.code ? `${item.code} - ${item.name}` : item.name))
        .join(', ');
    };

    const findOptionLabel = async (field: string, value: string | null | undefined) => {
      if (!value) return '';
      const fields = await this.getFieldConfigs(intent, draft, user);
      const config = fields.find((item) => item.field === field);
      const option = config?.options?.find((item) => item.value === value);
      return option?.label ?? value;
    };

    if (intent === 'create_mission') {
      return [
        { label: 'Escopo', value: draft.scope || '—' },
        {
          label: 'Localidade',
          value: (await localityLookup(draft.localityId)) || '—',
        },
        { label: 'Título', value: draft.title || '—' },
        { label: 'Início', value: draft.startDate || '—' },
        { label: 'Término', value: draft.endDate || '—' },
        { label: 'Descrição', value: draft.description || 'Não informada' },
      ];
    }

    if (intent === 'create_activity') {
      return [
        { label: 'Escopo', value: draft.scope || '—' },
        {
          label: 'Localidades',
          value: (await localityLookup(draft.localityIds)) || '—',
        },
        { label: 'Título', value: draft.title || '—' },
        {
          label: 'Tipo de atividade',
          value: (await findOptionLabel('activityTypeId', draft.activityTypeId)) || '—',
        },
        { label: 'Data', value: draft.eventDate || '—' },
        {
          label: 'Relatório',
          value:
            typeof draft.reportRequired === 'boolean'
              ? draft.reportRequired
                ? 'Obrigatório'
                : 'Não obrigatório'
              : '—',
        },
        { label: 'Descrição', value: draft.description || 'Não informada' },
      ];
    }

    if (intent === 'create_task') {
      return [
        {
          label: 'Localidades',
          value: (await localityLookup(draft.localityIds)) || '—',
        },
        { label: 'Título', value: draft.title || '—' },
        {
          label: 'Fase',
          value: (await findOptionLabel('phaseId', draft.phaseId)) || '—',
        },
        { label: 'Prazo', value: draft.dueDate || '—' },
        {
          label: 'Prioridade',
          value: (await findOptionLabel('priority', draft.priority)) || '—',
        },
        { label: 'Descrição', value: draft.description || 'Não informada' },
      ];
    }

    const missionLabel = await findOptionLabel('missionId', draft.missionId);
    return [
      { label: 'Escopo', value: draft.scope || '—' },
      { label: 'Missão', value: missionLabel || '—' },
      { label: 'Título do item', value: draft.title || '—' },
      { label: 'Início', value: draft.startAt || '—' },
      {
        label: 'Duração',
        value:
          draft.durationMinutes !== undefined ? `${draft.durationMinutes} min` : '—',
      },
      { label: 'Local', value: draft.location || '—' },
      { label: 'Responsável', value: draft.responsible || '—' },
      {
        label: 'Participantes',
        value: draft.participants || 'Não informado',
      },
    ];
  }

  private async executeWorkflow(
    workflow: AssistantWorkflow,
    user?: RbacUser,
  ): Promise<AssistantResultLink> {
    const draft = workflow.draft;
    if (workflow.intent === 'create_mission') {
      const created = await this.missions.create(
        {
          title: draft.title,
          description: draft.description || null,
          localityId: draft.localityId,
          scope: draft.scope,
          startDate: draft.startDate,
          endDate: draft.endDate,
        },
        user,
      );
      return {
        entityType: 'mission',
        id: String(created.id),
        title: String(created.title),
        url: `/missions?scope=${encodeURIComponent(String(draft.scope ?? 'SMIF'))}&missionId=${encodeURIComponent(String(created.id))}`,
      };
    }

    if (workflow.intent === 'create_activity') {
      const created = await this.activities.create(
        {
          title: draft.title,
          description: draft.description || null,
          localityIds: draft.localityIds,
          activityTypeId: draft.activityTypeId,
          eventDate: draft.eventDate,
          reportRequired: draft.reportRequired,
          scope: draft.scope,
        },
        user,
      );
      const createdId =
        String(created?.id ?? created?.createdIds?.[0] ?? '').trim() || 'atividade';
      return {
        entityType: 'activity',
        id: createdId,
        title:
          String(created?.title ?? draft.title).trim() ||
          'Atividade criada',
        url:
          String(draft.scope ?? '').toUpperCase() === 'CIPAVD'
            ? `/activities-cipavd?activityId=${encodeURIComponent(createdId)}`
            : `/activities?activityId=${encodeURIComponent(createdId)}`,
      };
    }

    if (workflow.intent === 'create_task') {
      const created = await this.tasks.createTaskInstancesManual(
        {
          title: draft.title,
          description: draft.description || null,
          phaseId: draft.phaseId,
          dueDate: draft.dueDate,
          priority: draft.priority,
          localityIds: draft.localityIds,
        },
        user,
      );
      const first = created?.items?.[0];
      if (!first?.id) {
        throw new NotFoundException('A tarefa foi criada, mas não retornou identificador.');
      }
      return {
        entityType: 'task',
        id: String(first.id),
        title: String(first.title ?? draft.title),
        url: `/tasks?taskId=${encodeURIComponent(String(first.id))}`,
      };
    }

    const created = await this.missions.createScheduleItem(
      draft.missionId,
      {
        title: draft.title,
        startAt: draft.startAt,
        durationMinutes: draft.durationMinutes,
        location: draft.location,
        responsible: draft.responsible,
        participants: draft.participants || '',
      },
      user,
    );
    return {
      entityType: 'mission_schedule',
      id: String(created.id),
      title: String(created.title),
      url: `/missions?scope=${encodeURIComponent(String(draft.scope ?? 'SMIF'))}&missionId=${encodeURIComponent(String(draft.missionId))}`,
    };
  }

  private extractErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'falha inesperada ao executar a ação solicitada.';
  }

  private formatDate(value: unknown) {
    const date = new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR');
  }
}
