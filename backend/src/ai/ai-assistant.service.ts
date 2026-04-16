import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocalityCatalogType } from '@prisma/client';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from '../missions/missions.service';
import { TasksService } from '../tasks/tasks.service';

const execFileAsync = promisify(execFile);

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
  | 'boolean'
  | 'file_upload';

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

type AssistantScheduleSourceFile = {
  id: string;
  name: string;
  mimeType: string;
  extractionMethod: 'text' | 'ocr';
  pageCount: number | null;
  itemCount: number;
};

type AssistantScheduleDraftItem = {
  id: string;
  title: string;
  startAt: string;
  durationMinutes: number;
  location: string;
  responsible: string;
  participants: string;
  sourceFileIds: string[];
  sourceFileNames: string[];
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
    attachments?: AssistantScheduleSourceFile[];
    scheduleItems?: AssistantScheduleDraftItem[];
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
      'Monta o cronograma da missão por PDF ou manualmente, com revisão assistida antes da gravação.',
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
      'Fluxo assistido para montar o cronograma da missão por PDF ou manualmente, revisar os itens e só depois cadastrar.',
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

  async handleUpload(
    payload: {
      sessionId?: string | null;
      files: Express.Multer.File[];
    },
    user?: RbacUser,
  ): Promise<AssistantReply> {
    this.pruneSessions();
    const session = this.getOrCreateSession(payload.sessionId);
    const workflow = session.workflow;
    if (!workflow || workflow.intent !== 'create_mission_schedule') {
      throw new BadRequestException(
        'Inicie primeiro o fluxo de cronograma em missão.',
      );
    }

    const workflowView = await this.buildWorkflowView(workflow, user);
    if (workflow.draft.scheduleInputMode !== 'UPLOAD') {
      throw new BadRequestException(
        'O envio de arquivos está disponível apenas quando o modo do cronograma for análise de PDF.',
      );
    }
    if (workflowView.currentField?.field !== 'scheduleFiles') {
      throw new BadRequestException(
        'Nesta etapa o assistente não está aguardando arquivos.',
      );
    }

    const files = (payload.files ?? []).filter(Boolean);
    if (!files.length) {
      throw new BadRequestException(
        'Envie ao menos um arquivo PDF ou imagem do cronograma.',
      );
    }

    const parseResult = await this.parseScheduleFiles(
      files,
      workflow.draft,
      user,
    );
    if (!parseResult.items.length) {
      throw new BadRequestException(
        'Não consegui montar itens de cronograma a partir dos arquivos enviados. Revise o PDF ou envie uma versão mais legível.',
      );
    }

    const existingItems = Array.isArray(workflow.draft.scheduleItemsDraft)
      ? (workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
      : [];
    const existingFiles = Array.isArray(workflow.draft.scheduleSourceFiles)
      ? (workflow.draft.scheduleSourceFiles as AssistantScheduleSourceFile[])
      : [];

    workflow.draft.scheduleItemsDraft = [...existingItems, ...parseResult.items]
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .map((item, index) => ({
        ...item,
        id: item.id || `schedule-item-${index + 1}`,
      }));
    workflow.draft.scheduleSourceFiles = [...existingFiles, ...parseResult.files];
    workflow.status = 'confirming';
    session.updatedAt = new Date().toISOString();

    this.pushMessage(
      session,
      'user',
      `Arquivos enviados: ${files.map((file) => file.originalname || 'arquivo').join(', ')}`,
    );

    const updatedView = await this.buildWorkflowView(workflow, user);
    return this.buildReply(
      session,
      this.pushMessage(
        session,
        'assistant',
        this.buildScheduleUploadMessage(parseResult.files, parseResult.items),
      ),
      updatedView,
      null,
    );
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

    if (
      workflow.intent === 'create_mission_schedule' &&
      rawMessage &&
      !fieldInput?.field &&
      !wantsSkip &&
      !wantsConfirm &&
      !workflowView.currentField
    ) {
      const commandReply = await this.handleScheduleDraftCommand(
        session,
        workflow,
        rawMessage,
        user,
      );
      if (commandReply) {
        return commandReply;
      }
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
      const isScheduleEditValue =
        workflow.intent === 'create_mission_schedule' &&
        fieldInput.field === 'scheduleEditValue';
      await this.applyFieldValue(
        workflow,
        String(fieldInput.field),
        fieldInput.value,
        user,
      );
      if (isScheduleEditValue) {
        session.updatedAt = new Date().toISOString();
        const updatedView = await this.buildWorkflowView(workflow, user);
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'Item do cronograma atualizado. Revise o rascunho e confirme quando estiver correto.',
          ),
          updatedView,
          null,
        );
      }
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
      const isScheduleEditValue =
        workflow.intent === 'create_mission_schedule' &&
        currentField.field === 'scheduleEditValue';
      await this.applyFieldValue(workflow, currentField.field, rawMessage, user);
      if (isScheduleEditValue) {
        session.updatedAt = new Date().toISOString();
        const updatedView = await this.buildWorkflowView(workflow, user);
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'Item do cronograma atualizado. Revise o rascunho e confirme quando estiver correto.',
          ),
          updatedView,
          null,
        );
      }
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
    const attachments = Array.isArray(workflow?.draft?.scheduleSourceFiles)
      ? (workflow?.draft?.scheduleSourceFiles as AssistantScheduleSourceFile[])
      : [];
    const scheduleItems = Array.isArray(workflow?.draft?.scheduleItemsDraft)
      ? (workflow?.draft?.scheduleItemsDraft as AssistantScheduleDraftItem[])
      : [];
    return {
      sessionId: session.id,
      message,
      workflow: workflow
        ? {
            ...workflow,
            attachments,
            scheduleItems,
          }
        : null,
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
    if (field.inputType === 'file_upload') {
      const items = Array.isArray(draft.scheduleItemsDraft)
        ? draft.scheduleItemsDraft
        : [];
      return items.length === 0;
    }
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
    if (field.inputType === 'file_upload') {
      throw new BadRequestException(
        'Use o envio de arquivo do assistente para anexar o cronograma.',
      );
    }
    const normalized = this.normalizeFieldValue(field, value);
    if (field.inputType === 'single_select' && field.options?.length) {
      const option = this.resolveSingleOption(field.options, normalized);
      if (!option) {
        throw new BadRequestException(
          `Selecione uma opção válida para ${field.label.toLowerCase()}.`,
        );
      }
      if (field.field === 'scheduleEditFieldKey') {
        workflow.draft.scheduleEditFieldKey = option.value;
        return;
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
      if (field.field === 'scheduleEditValue') {
        this.applyScheduleItemEdit(workflow, parsed);
        return;
      }
      workflow.draft[field.field] = parsed;
      return;
    }
    if (field.inputType === 'date') {
      const parsed = this.parseDateOnly(
        Array.isArray(normalized) ? normalized[0] ?? '' : normalized,
      );
      if (field.field === 'scheduleEditValue') {
        this.applyScheduleItemEdit(workflow, `${parsed}T00:00:00`);
        return;
      }
      workflow.draft[field.field] = parsed;
      return;
    }
    if (field.inputType === 'datetime') {
      const parsed = this.parseDateTime(
        Array.isArray(normalized) ? normalized[0] ?? '' : normalized,
      );
      if (field.field === 'scheduleEditValue') {
        this.applyScheduleItemEdit(workflow, parsed);
        return;
      }
      workflow.draft[field.field] = parsed;
      return;
    }
    const text = String(normalized ?? '').trim();
    if (!field.optional && !text) {
      throw new BadRequestException(
        `Informe ${field.label.toLowerCase()} para continuar.`,
      );
    }
    if (field.field === 'scheduleEditValue') {
      this.applyScheduleItemEdit(workflow, text || '');
      return;
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

    const baseFields: AssistantFieldConfig[] = [
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
        field: 'scheduleInputMode',
        label: 'Como deseja montar o cronograma?',
        inputType: 'single_select',
        options: [
          {
            value: 'UPLOAD',
            label: 'Analisar arquivo PDF',
            description:
              'Envia um ou mais PDFs, monta o rascunho e permite revisar antes de gravar.',
          },
          {
            value: 'MANUAL',
            label: 'Preencher manualmente',
            description:
              'Mantém o fluxo item a item para inserir o cronograma sem anexos.',
          },
        ],
      },
    ];

    if (draft.scheduleInputMode === 'UPLOAD') {
      if (draft.scheduleEditIndex !== undefined && draft.scheduleEditIndex !== null) {
        if (!draft.scheduleEditFieldKey) {
          return [
            ...baseFields,
            {
              field: 'scheduleEditFieldKey',
              label: 'Campo a ajustar',
              inputType: 'single_select',
              options: [
                { value: 'title', label: 'Título' },
                { value: 'startAt', label: 'Início' },
                { value: 'durationMinutes', label: 'Duração em minutos' },
                { value: 'location', label: 'Local' },
                { value: 'responsible', label: 'Responsável' },
                { value: 'participants', label: 'Participantes' },
              ],
            },
          ];
        }
        return [
          ...baseFields,
          this.buildScheduleEditValueField(
            draft.scheduleEditFieldKey,
            Number(draft.scheduleEditIndex) + 1,
          ),
        ];
      }
      return [
        ...baseFields,
        {
          field: 'scheduleFiles',
          label: 'Arquivos do cronograma',
          inputType: 'file_upload',
          helperText:
            'Envie um ou mais PDFs neste formato. O assistente analisa, monta o rascunho e permite ajustes antes do cadastro final.',
        },
      ];
    }

    return [
      ...baseFields,
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
    if (draft.scheduleInputMode === 'UPLOAD') {
      const sourceFiles = Array.isArray(draft.scheduleSourceFiles)
        ? (draft.scheduleSourceFiles as AssistantScheduleSourceFile[])
        : [];
      const scheduleItems = Array.isArray(draft.scheduleItemsDraft)
        ? (draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
        : [];
      return [
        { label: 'Escopo', value: draft.scope || '—' },
        { label: 'Missão', value: missionLabel || '—' },
        { label: 'Modo', value: 'Análise de arquivo PDF' },
        {
          label: 'Arquivos',
          value: sourceFiles.length
            ? sourceFiles.map((item) => item.name).join(', ')
            : 'Nenhum arquivo enviado',
        },
        {
          label: 'Itens montados',
          value: scheduleItems.length
            ? `${scheduleItems.length} item(ns) prontos para revisão`
            : 'Aguardando leitura do cronograma',
        },
        {
          label: 'Próxima ação',
          value:
            draft.scheduleEditIndex !== undefined && draft.scheduleEditIndex !== null
              ? `Ajustando item ${Number(draft.scheduleEditIndex) + 1}`
              : scheduleItems.length
                ? 'Você pode confirmar, remover ou alterar itens específicos.'
                : 'Envie um ou mais PDFs para o assistente montar o cronograma.',
        },
      ];
    }
    return [
      { label: 'Escopo', value: draft.scope || '—' },
      { label: 'Missão', value: missionLabel || '—' },
      { label: 'Modo', value: 'Preenchimento manual' },
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

    if (draft.scheduleInputMode === 'UPLOAD') {
      const scheduleItems = Array.isArray(draft.scheduleItemsDraft)
        ? (draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
        : [];
      if (!scheduleItems.length) {
        throw new BadRequestException(
          'Envie um arquivo e revise o cronograma antes de confirmar o cadastro.',
        );
      }
      for (const item of scheduleItems) {
        await this.missions.createScheduleItem(
          draft.missionId,
          {
            title: item.title,
            startAt: item.startAt,
            durationMinutes: item.durationMinutes,
            location: item.location,
            responsible: item.responsible,
            participants: item.participants || '',
          },
          user,
        );
      }
      return {
        entityType: 'mission_schedule',
        id: String(draft.missionId),
        title: `Cronograma cadastrado com ${scheduleItems.length} item(ns)`,
        url: `/missions?scope=${encodeURIComponent(String(draft.scope ?? 'SMIF'))}&missionId=${encodeURIComponent(String(draft.missionId))}`,
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

  private buildScheduleEditValueField(
    fieldKey: string,
    itemNumber: number,
  ): AssistantFieldConfig {
    switch (fieldKey) {
      case 'startAt':
        return {
          field: 'scheduleEditValue',
          label: `Novo início do item ${itemNumber}`,
          inputType: 'datetime',
          helperText: 'Use DD/MM/AAAA HH:MM ou o seletor de data e hora.',
        };
      case 'durationMinutes':
        return {
          field: 'scheduleEditValue',
          label: `Nova duração do item ${itemNumber}`,
          inputType: 'number',
          min: 1,
          max: 1440,
        };
      case 'location':
        return {
          field: 'scheduleEditValue',
          label: `Novo local do item ${itemNumber}`,
          inputType: 'text',
        };
      case 'responsible':
        return {
          field: 'scheduleEditValue',
          label: `Novo responsável do item ${itemNumber}`,
          inputType: 'text',
        };
      case 'participants':
        return {
          field: 'scheduleEditValue',
          label: `Novos participantes do item ${itemNumber}`,
          inputType: 'textarea',
          optional: true,
          helperText: 'Campo opcional.',
        };
      default:
        return {
          field: 'scheduleEditValue',
          label: `Novo título do item ${itemNumber}`,
          inputType: 'text',
        };
    }
  }

  private async handleScheduleDraftCommand(
    session: AssistantSession,
    workflow: AssistantWorkflow,
    rawMessage: string,
    user?: RbacUser,
  ): Promise<AssistantReply | null> {
    if (workflow.draft.scheduleInputMode !== 'UPLOAD') {
      return null;
    }
    const normalized = this.normalizeFreeText(rawMessage);
    if (!normalized) return null;

    const removeMatch = normalized.match(/(?:remover|excluir)\s+item\s+(\d+)/);
    if (removeMatch) {
      const itemNumber = Number(removeMatch[1]);
      const items = Array.isArray(workflow.draft.scheduleItemsDraft)
        ? [...(workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])]
        : [];
      if (!items.length) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'Ainda não há itens de cronograma montados para remover.',
          ),
          await this.buildWorkflowView(workflow, user),
          null,
        );
      }
      if (!Number.isInteger(itemNumber) || itemNumber < 1 || itemNumber > items.length) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            `Não encontrei o item ${itemNumber}. Use a numeração exibida no rascunho atual.`,
          ),
          await this.buildWorkflowView(workflow, user),
          null,
        );
      }
      const [removed] = items.splice(itemNumber - 1, 1);
      workflow.draft.scheduleItemsDraft = items;
      workflow.draft.scheduleEditIndex = null;
      workflow.draft.scheduleEditFieldKey = null;
      workflow.status = items.length ? 'confirming' : 'collecting';
      const updatedView = await this.buildWorkflowView(workflow, user);
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          items.length
            ? `Item ${itemNumber} removido: **${removed?.title ?? 'sem título'}**.\n\nRevise o rascunho e confirme quando estiver correto.`
            : 'Todos os itens foram removidos. Envie outro arquivo para montar um novo rascunho.',
        ),
        updatedView,
        null,
      );
    }

    const editMatch = normalized.match(
      /(?:alterar|ajustar|editar)\s+item\s+(\d+)/,
    );
    if (editMatch) {
      const itemNumber = Number(editMatch[1]);
      const items = Array.isArray(workflow.draft.scheduleItemsDraft)
        ? (workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
        : [];
      if (!Number.isInteger(itemNumber) || itemNumber < 1 || itemNumber > items.length) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            `Não encontrei o item ${itemNumber}. Use a numeração exibida no rascunho atual.`,
          ),
          await this.buildWorkflowView(workflow, user),
          null,
        );
      }
      workflow.draft.scheduleEditIndex = itemNumber - 1;
      workflow.draft.scheduleEditFieldKey = null;
      workflow.status = 'collecting';
      const updatedView = await this.buildWorkflowView(workflow, user);
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          `Certo. Vou ajustar o **item ${itemNumber}**. Primeiro, escolha qual campo deseja alterar.`,
        ),
        updatedView,
        null,
      );
    }

    if (
      normalized.includes('mostrar cronograma') ||
      normalized.includes('mostrar itens') ||
      normalized.includes('listar itens') ||
      normalized.includes('ver cronograma')
    ) {
      const items = Array.isArray(workflow.draft.scheduleItemsDraft)
        ? (workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
        : [];
      const updatedView = await this.buildWorkflowView(workflow, user);
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          items.length
            ? this.buildSchedulePreviewMessage(items)
            : 'Ainda não há itens montados no rascunho atual.',
        ),
        updatedView,
        null,
      );
    }

    return null;
  }

  private applyScheduleItemEdit(
    workflow: AssistantWorkflow,
    rawValue: string | number,
  ) {
    const itemIndex = Number(workflow.draft.scheduleEditIndex);
    const fieldKey = String(workflow.draft.scheduleEditFieldKey ?? '').trim();
    const items = Array.isArray(workflow.draft.scheduleItemsDraft)
      ? [...(workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])]
      : [];
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) {
      throw new BadRequestException(
        'O item de cronograma selecionado para ajuste não está mais disponível.',
      );
    }
    if (!fieldKey) {
      throw new BadRequestException(
        'Selecione primeiro qual campo do item deseja ajustar.',
      );
    }

    const item = { ...items[itemIndex] };
    if (fieldKey === 'durationMinutes') {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new BadRequestException(
          'Informe uma duração válida em minutos.',
        );
      }
      item.durationMinutes = Math.round(parsed);
    } else if (fieldKey === 'participants') {
      item.participants = String(rawValue ?? '').trim();
    } else if (fieldKey === 'startAt') {
      item.startAt = String(rawValue ?? '').trim();
    } else if (fieldKey === 'location') {
      item.location = String(rawValue ?? '').trim() || 'A definir';
    } else if (fieldKey === 'responsible') {
      item.responsible = String(rawValue ?? '').trim() || 'Equipe de Campo';
    } else {
      item.title = String(rawValue ?? '').trim();
    }

    items[itemIndex] = item;
    workflow.draft.scheduleItemsDraft = items;
    workflow.draft.scheduleEditIndex = null;
    workflow.draft.scheduleEditFieldKey = null;
    workflow.status = 'confirming';
  }

  private async parseScheduleFiles(
    files: Express.Multer.File[],
    draft: Record<string, any>,
    user?: RbacUser,
  ): Promise<{
    files: AssistantScheduleSourceFile[];
    items: AssistantScheduleDraftItem[];
  }> {
    const missionContext = await this.resolveMissionContext(draft.missionId, user);
    const parsedFiles: AssistantScheduleSourceFile[] = [];
    const parsedItems: AssistantScheduleDraftItem[] = [];

    for (const file of files) {
      const extraction = await this.extractTextFromScheduleFile(file);
      const itemDrafts =
        extraction.method === 'text'
          ? this.parseStructuredScheduleDraftsFromText(
              extraction.text,
              missionContext.fallbackLocation,
            )
          : this.parseOcrScheduleDraftsFromText(
              extraction.text,
              missionContext.fallbackLocation,
            );
      const sourceFile: AssistantScheduleSourceFile = {
        id: randomUUID(),
        name: file.originalname || 'arquivo.pdf',
        mimeType: file.mimetype || 'application/pdf',
        extractionMethod: extraction.method,
        pageCount: extraction.pageCount,
        itemCount: itemDrafts.length,
      };
      parsedFiles.push(sourceFile);
      parsedItems.push(
        ...itemDrafts.map((item) => ({
          ...item,
          id: randomUUID(),
          sourceFileIds: [sourceFile.id],
          sourceFileNames: [sourceFile.name],
        })),
      );
    }

    return {
      files: parsedFiles,
      items: parsedItems.sort((left, right) =>
        left.startAt.localeCompare(right.startAt),
      ),
    };
  }

  private async resolveMissionContext(missionId: string, user?: RbacUser) {
    if (!missionId) {
      throw new BadRequestException(
        'Selecione a missão antes de enviar o cronograma.',
      );
    }
    const mission = await this.missions.getById(missionId, user);
    const localityName = String(mission?.locality?.name ?? '').trim();
    const localityCode = String(mission?.locality?.code ?? '').trim();
    return {
      fallbackLocation:
        localityName || localityCode
          ? [localityCode, localityName].filter(Boolean).join(' - ')
          : 'A definir',
    };
  }

  private async extractTextFromScheduleFile(file: Express.Multer.File): Promise<{
    text: string;
    method: 'text' | 'ocr';
    pageCount: number | null;
  }> {
    const workdir = await mkdtemp(path.join(tmpdir(), 'ai-schedule-'));
    const safeExt =
      path.extname(file.originalname || '').toLowerCase() ||
      (String(file.mimetype ?? '').startsWith('image/') ? '.png' : '.pdf');
    const inputPath = path.join(workdir, `input${safeExt}`);
    await writeFile(inputPath, file.buffer);

    try {
      if (String(file.mimetype ?? '').startsWith('image/')) {
        const ocrText = await this.extractTextFromImage(inputPath);
        return { text: ocrText, method: 'ocr', pageCount: 1 };
      }

      try {
        const { stdout } = await execFileAsync(
          'pdftotext',
          ['-layout', inputPath, '-'],
          {
            maxBuffer: 24 * 1024 * 1024,
          },
        );
        const plainText = String(stdout ?? '');
        if (this.isExtractedTextUseful(plainText)) {
          return {
            text: plainText,
            method: 'text',
            pageCount: this.countPdfPagesFromText(plainText),
          };
        }
      } catch {
        // segue para OCR
      }

      const ocrText = await this.extractTextFromPdfViaOcr(inputPath, workdir);
      return {
        text: ocrText,
        method: 'ocr',
        pageCount: this.countPdfPagesFromText(ocrText),
      };
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }

  private async extractTextFromPdfViaOcr(inputPath: string, workdir: string) {
    const pagePrefix = path.join(workdir, 'page');
    await execFileAsync(
      'pdftoppm',
      ['-r', '240', '-png', inputPath, pagePrefix],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const files = (await readdir(workdir))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (!files.length) {
      throw new BadRequestException(
        'Não consegui converter o PDF do cronograma para análise.',
      );
    }

    const pages: string[] = [];
    for (const fileName of files) {
      pages.push(await this.extractTextFromImage(path.join(workdir, fileName)));
    }
    return pages.join('\n\f\n');
  }

  private async extractTextFromImage(imagePath: string) {
    const { stdout } = await execFileAsync(
      'tesseract',
      [imagePath, 'stdout', '-l', 'por', '--psm', '4'],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    return String(stdout ?? '');
  }

  private isExtractedTextUseful(text: string) {
    const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
    const letters = normalized.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0;
    return normalized.length >= 120 && letters >= 40;
  }

  private countPdfPagesFromText(text: string) {
    const safe = String(text ?? '');
    if (!safe.includes('\f')) {
      return safe.trim() ? 1 : 0;
    }
    return safe
      .split('\f')
      .map((chunk) => chunk.trim())
      .filter(Boolean).length;
  }

  private parseStructuredScheduleDraftsFromText(
    text: string,
    fallbackLocation: string,
  ): Omit<
    AssistantScheduleDraftItem,
    'id' | 'sourceFileIds' | 'sourceFileNames'
  >[] {
    const pages = String(text ?? '')
      .split('\f')
      .map((page) => page.replace(/\r/g, ''))
      .filter((page) => page.trim());
    const parsedItems: Array<{
      title: string;
      startAt: string;
      durationMinutes: number;
      location: string;
      responsible: string;
      participants: string;
    }> = [];

    for (const page of pages) {
      const lines = page.split('\n');
      const headerLine =
        lines.find(
          (line) =>
            line.includes('Horário') &&
            line.includes('Atividade') &&
            line.includes('Local Sugerido'),
        ) ?? null;
      if (!headerLine) {
        parsedItems.push(...this.parseScheduleDraftsFromText(page, fallbackLocation));
        continue;
      }
      const rawActivityStart = headerLine.indexOf('Atividade');
      const rawCipavdStart = headerLine.indexOf('Participantes CIPAVD');
      const rawParticipantsStart = headerLine.indexOf(
        'Participantes',
        rawCipavdStart + 'Participantes CIPAVD'.length,
      );
      const rawLocationStart = headerLine.indexOf('Local Sugerido');
      const activityStart = Math.max(0, rawActivityStart - 23);
      const cipavdStart = Math.max(activityStart + 1, rawCipavdStart - 6);
      const participantsStart = Math.max(
        cipavdStart + 1,
        rawParticipantsStart - 6,
      );
      const locationStart = Math.max(participantsStart + 1, rawLocationStart - 9);
      const pageDate = page.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] ?? null;
      if (
        !pageDate ||
        rawActivityStart < 0 ||
        rawCipavdStart < 0 ||
        rawParticipantsStart < 0 ||
        rawLocationStart < 0
      ) {
        parsedItems.push(...this.parseScheduleDraftsFromText(page, fallbackLocation));
        continue;
      }

      const rows: Array<{
        time: string;
        activity: string[];
        responsible: string[];
        participants: string[];
        location: string[];
      }> = [];
      let activeRow:
        | {
            time: string;
            activity: string[];
            responsible: string[];
            participants: string[];
            location: string[];
          }
        | null = null;
      let pendingPrelude: string[] = [];
      let pendingResponsibleForNext: string[] = [];

      const flushActiveRow = () => {
        if (!activeRow) return;
        rows.push(activeRow);
        activeRow = null;
      };

      for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index] ?? '';
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        if (
          trimmed.includes('Horário') ||
          trimmed.startsWith('CRONOGRAMA') ||
          trimmed === 'DATA' ||
          (trimmed.includes('DATA') && trimmed.includes('MANHÃ')) ||
          trimmed === 'MANHÃ' ||
          trimmed === 'TARDE' ||
          /^\(.+\)$/.test(trimmed)
        ) {
          if (trimmed === 'MANHÃ' || trimmed === 'TARDE') {
            flushActiveRow();
          }
          continue;
        }

        const timeMarker = this.extractTimeMarker(trimmed);
        if (timeMarker) {
          flushActiveRow();
          activeRow = {
            time: timeMarker.normalizedTime,
            activity: [],
            responsible: [],
            participants: [],
            location: [],
          };
          if (pendingPrelude.length) {
            activeRow.activity.push(...pendingPrelude);
            pendingPrelude = [];
          }
          if (pendingResponsibleForNext.length) {
            activeRow.responsible.push(...pendingResponsibleForNext);
            pendingResponsibleForNext = [];
          }
          const segments = this.extractStructuredScheduleSegments(rawLine, {
            activityStart,
            cipavdStart,
            participantsStart,
            locationStart,
          });
          this.appendStructuredSegments(activeRow, segments);
          continue;
        }

        const nextNonEmpty = lines
          .slice(index + 1)
          .map((line) => line.trim())
          .find(Boolean);
        const nextIsTimedRow = !!nextNonEmpty && !!this.extractTimeMarker(nextNonEmpty);

        if (!activeRow) {
          if (nextIsTimedRow && this.isLikelyResponsibleLine(trimmed)) {
            pendingResponsibleForNext.push(trimmed);
          } else {
            pendingPrelude.push(trimmed);
          }
          continue;
        }

        if (
          nextIsTimedRow &&
          this.isLikelyResponsibleLine(trimmed) &&
          !trimmed.includes('CPCAs')
        ) {
          pendingResponsibleForNext.push(trimmed);
          continue;
        }

        const segments = this.extractStructuredScheduleSegments(rawLine, {
          activityStart,
          cipavdStart,
          participantsStart,
          locationStart,
        });
        this.appendStructuredSegments(activeRow, segments);
      }

      flushActiveRow();

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const nextRow = rows[index + 1] ?? null;
        const activityText = row.activity.join(' ').replace(/\s+/g, ' ').trim();
        const responsibleText = row.responsible
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const cleanedResponsibleText = responsibleText
          .replace(/^Intervalo\s+/i, '')
          .trim();
        const participantsText = row.participants
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const locationText = row.location.join(' ').replace(/\s+/g, ' ').trim();
        const title =
          activityText ||
          (!this.isLikelyResponsibleLine(responsibleText) ? responsibleText : '') ||
          (!this.isLikelyLocationLine(participantsText) ? participantsText : '') ||
          'Atividade a confirmar';
        const normalizedTitle = this.normalizeScheduleTitle(title);
        if (!normalizedTitle) continue;
        parsedItems.push({
          title: normalizedTitle,
          startAt: this.combineDateAndTime(pageDate, row.time),
          durationMinutes: this.estimateDurationMinutes(row.time, nextRow?.time ?? null),
          location: locationText || fallbackLocation || 'A definir',
          responsible:
            (this.isLikelyResponsibleLine(cleanedResponsibleText)
              ? cleanedResponsibleText
              : '') || this.inferResponsibleFromTitle(normalizedTitle),
          participants: participantsText,
        });
      }
    }

    return parsedItems.sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  private parseOcrScheduleDraftsFromText(
    text: string,
    fallbackLocation: string,
  ): Omit<
    AssistantScheduleDraftItem,
    'id' | 'sourceFileIds' | 'sourceFileNames'
  >[] {
    const pages = String(text ?? '')
      .split('\f')
      .map((page) => page.replace(/\r/g, '').trim())
      .filter(Boolean);
    const parsedItems: Array<{
      title: string;
      startAt: string;
      durationMinutes: number;
      location: string;
      responsible: string;
      participants: string;
    }> = [];
    let baseExplicitDate: string | null = null;
    let baseExplicitDayIndex: number | null = null;

    for (const page of pages) {
      const pageContext = this.extractOcrPageContext(page);
      let pageDate = page.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] ?? null;
      if (pageDate && pageContext.dayIndex) {
        baseExplicitDate = pageDate;
        baseExplicitDayIndex = pageContext.dayIndex;
      }
      if (!pageDate && baseExplicitDate && baseExplicitDayIndex && pageContext.dayIndex) {
        pageDate = this.offsetDateByDays(
          baseExplicitDate,
          pageContext.dayIndex - baseExplicitDayIndex,
        );
      }
      if (!pageDate) continue;
      const rows = this.extractOcrScheduleRows(page);
      let previousResponsible = 'Equipe de Campo';

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const nextRow = rows[index + 1] ?? null;
        const item = this.parseOcrScheduleRow(
          row,
          pageDate,
          nextRow?.time ?? null,
          fallbackLocation,
          pageContext,
          previousResponsible,
        );
        if (!item) continue;
        parsedItems.push(item);
        if (
          item.title !== 'Intervalo' &&
          item.title !== 'Encerramento das atividades' &&
          item.responsible &&
          item.responsible !== '-'
        ) {
          previousResponsible = item.responsible;
        }
      }
    }

    return parsedItems.sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  private extractOcrPageContext(page: string) {
    const headingLine = page
      .split('\n')
      .map((line) => this.cleanScheduleLine(line))
      .find((line) => /cronograma/i.test(line));
    const headingUnits: string[] = [];
    if (headingLine) {
      const normalizedHeading = headingLine
        .replace(/GUARNAE[-\s]+([A-Z]{2})/gi, (_match, unit) => {
          headingUnits.push(`GUARNAE-${String(unit ?? '').toUpperCase()}`);
          return '';
        })
        .replace(/\bCBNB\b/gi, (_match) => {
          headingUnits.push('CBNB');
          return '';
        });
      if (/GUARNAE-RJ/i.test(normalizedHeading)) {
        headingUnits.push('GUARNAE-RJ');
      }
    }
    return {
      headingLine: headingLine ?? '',
      headingUnits: Array.from(new Set(headingUnits)),
      dayIndex: Number(page.match(/\bDIA\s+(\d+)/i)?.[1] ?? 0) || null,
    };
  }

  private offsetDateByDays(date: string, days: number) {
    const match = String(date ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return date;
    const base = new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      12,
      0,
      0,
    );
    base.setDate(base.getDate() + days);
    const day = String(base.getDate()).padStart(2, '0');
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const year = String(base.getFullYear());
    return `${day}/${month}/${year}`;
  }

  private extractOcrScheduleRows(page: string): Array<{
    time: string;
    prefixLines: string[];
    mainLine: string;
    suffixLines: string[];
    }> {
    const rawLines = String(page ?? '')
      .split('\n')
      .map((line) => this.normalizeOcrScheduleLine(line))
      .filter(Boolean);
    const rows: Array<{
      time: string;
      prefixLines: string[];
      mainLine: string;
      suffixLines: string[];
    }> = [];
    let pendingPrefix: string[] = [];
    let active:
      | {
          time: string;
          prefixLines: string[];
          mainLine: string;
          suffixLines: string[];
        }
      | null = null;

    const flushActive = () => {
      if (!active) return;
      rows.push(active);
      active = null;
    };

    for (const line of rawLines) {
      if (this.isSkippableOcrScheduleLine(line)) {
        continue;
      }
      const timeMarker = this.extractTimeMarker(line);
      if (timeMarker) {
        flushActive();
        active = {
          time: timeMarker.normalizedTime,
          prefixLines: pendingPrefix,
          mainLine: timeMarker.remainder,
          suffixLines: [],
        };
        pendingPrefix = [];
        continue;
      }
      if (!active) {
        pendingPrefix.push(line);
        continue;
      }
      if (this.shouldAttachLineToOcrRow(active, line)) {
        active.suffixLines.push(line);
      } else {
        pendingPrefix.push(line);
      }
    }

    flushActive();
    return rows;
  }

  private normalizeOcrScheduleLine(line: string) {
    return this.cleanScheduleLine(line)
      .replace(/^[A-Za-zÀ-ÿ]\s+CRONOGRAMA/i, 'CRONOGRAMA')
      .replace(/^\d{2}\/\d{2}\/\d{4}\s+/, '')
      .replace(/^\([^)]+\)\s+/, '')
      .trim();
  }

  private isSkippableOcrScheduleLine(line: string) {
    const normalized = this.normalizeFreeText(line);
    if (!normalized) return true;
    if (
      normalized === 'data' ||
      normalized === 'manha' ||
      normalized === 'tarde' ||
      normalized.startsWith('cronograma') ||
      normalized.startsWith('atividade participantes cipavd') ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(line) ||
      /\bsegunda-feira\b|\bterca-feira\b|\bterça-feira\b|\bquarta-feira\b|\bquinta-feira\b|\bsexta-feira\b/i.test(
        normalized,
      )
    ) {
      return true;
    }
    return false;
  }

  private shouldAttachLineToOcrRow(
    row: {
      time: string;
      prefixLines: string[];
      mainLine: string;
      suffixLines: string[];
    },
    line: string,
  ) {
    const normalized = this.normalizeFreeText(line);
    if (!normalized) return false;
    if (this.looksLikeNewScheduleActivityPrefix(line)) {
      return false;
    }
    const currentText = [row.mainLine, ...row.suffixLines].join(' ').trim();
    const currentTitle = this.canonicalizeOcrScheduleTitle(
      [row.prefixLines.join(' '), currentText, line].join(' '),
    );
    if (
      normalized === 'assedio' ||
      normalized.startsWith('(') ||
      normalized.includes('apresentacao ao comandante') ||
      normalized.includes('logistica de atividades')
    ) {
      return true;
    }
    if (
      currentTitle === 'Reunião com as CPCAs' &&
      (normalized.includes('cpca') || normalized.includes('guarnae'))
    ) {
      return true;
    }
    if (
      currentTitle === 'Ciclo de Boas Práticas' &&
      (normalized.includes('juridic') ||
        normalized.includes('psicolog') ||
        normalized.includes('assistentes sociais') ||
        normalized.includes('guarnae') ||
        normalized.includes('camargo'))
    ) {
      return true;
    }
    if (
      this.cleanScheduleLine(currentText).match(/\bao$/i) &&
      normalized.length <= 24
    ) {
      return true;
    }
    const currentLocation = this.extractOcrLocation(currentText, '', null);
    if (!currentLocation && this.looksLikeOcrLocationFragment(line)) {
      return true;
    }
    return false;
  }

  private looksLikeNewScheduleActivityPrefix(line: string) {
    const normalized = this.normalizeFreeText(line);
    if (!normalized || normalized === 'assedio') return false;
    return (
      normalized.includes('chegada da equipe') ||
      normalized.includes('palestra') ||
      normalized.includes('intervalo') ||
      normalized.includes('aplicacao de pesquisa') ||
      normalized.includes('reuniao com as cpcas') ||
      normalized.includes('ciclo de boas praticas') ||
      normalized.includes('encerramento das atividades')
    );
  }

  private parseOcrScheduleRow(
    row: {
      time: string;
      prefixLines: string[];
      mainLine: string;
      suffixLines: string[];
    },
    pageDate: string,
    nextTime: string | null,
    fallbackLocation: string,
    pageContext: { headingLine: string; headingUnits: string[] },
    previousResponsible: string,
  ) {
    const rawText = [...row.prefixLines, row.mainLine, ...row.suffixLines]
      .map((line) => this.cleanScheduleLine(line))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const title = this.canonicalizeOcrScheduleTitle(rawText);
    if (!title) return null;

    const location =
      this.extractOcrLocation(rawText, title, pageContext) ||
      (title === 'Intervalo' || title === 'Encerramento das atividades'
        ? '-'
        : title.startsWith('Chegada da Equipe')
          ? '-'
          : fallbackLocation || 'A definir');
    const responsible = this.extractOcrResponsible(
      rawText,
      title,
      previousResponsible,
    );
    const participants = this.extractOcrParticipants(
      rawText,
      title,
      pageContext,
    );

    return {
      title,
      startAt: this.combineDateAndTime(pageDate, row.time),
      durationMinutes: this.estimateDurationMinutes(row.time, nextTime),
      location,
      responsible,
      participants,
    };
  }

  private canonicalizeOcrScheduleTitle(text: string) {
    const safe = this.cleanScheduleLine(text);
    const normalized = this.normalizeFreeText(safe);
    if (!normalized) return '';
    const facility = this.extractFacilityName(safe);
    if (normalized.includes('chegada da equipe')) {
      const prep = facility && /\b(COMAR|CBNB)\b/i.test(facility) ? 'ao' : 'a';
      const details =
        normalized.includes('apresentacao ao comandante') ||
        normalized.includes('logistica de atividades')
          ? ' (Apresentação ao comandante e organização logística de atividades)'
          : '';
      return facility
        ? `Chegada da Equipe ${prep} ${facility}${details}`
        : `Chegada da Equipe${details}`;
    }
    if (normalized.includes('intervalo')) {
      return 'Intervalo';
    }
    if (normalized.includes('encerramento')) {
      return 'Encerramento das atividades';
    }
    if (
      (normalized.includes('conscient') || normalized.includes('conseient')) &&
      normalized.includes('preven')
    ) {
      return 'Palestra de Conscientização e Prevenção ao Assédio';
    }
    if (normalized.includes('violencia') && normalized.includes('domest')) {
      return 'Palestra sobre Violência Doméstica';
    }
    if (normalized.includes('aplicacao') && normalized.includes('pesquisa')) {
      return 'Aplicação de pesquisa';
    }
    if (normalized.includes('reuniao') && normalized.includes('cpca')) {
      return 'Reunião com as CPCAs';
    }
    if (normalized.includes('ciclo') && normalized.includes('boas pratic')) {
      return 'Ciclo de Boas Práticas';
    }
    return this.normalizeScheduleTitle(safe);
  }

  private extractFacilityName(text: string) {
    const safe = this.cleanScheduleLine(text);
    if (/\bIII COMAR\b/i.test(safe)) return 'III COMAR';
    if (/\bII COMAR\b|\bHI COMAR\b/i.test(safe)) return 'II COMAR';
    if (/\bCBNB\b/i.test(safe)) return 'CBNB';
    if (/\bBASC\b/i.test(safe)) return 'BASC';
    if (/\bBAGL\b/i.test(safe)) return 'BAGL';
    if (/\bUNIFA\b|\bUNIEA\b/i.test(safe)) return 'UNIFA';
    return '';
  }

  private extractOcrLocation(
    text: string,
    title: string,
    pageContext: { headingLine?: string; headingUnits?: string[] } | null,
  ) {
    const safe = this.cleanScheduleLine(text);
    if (/\s-\s*$|-$/.test(safe)) {
      return '-';
    }
    if (title === 'Intervalo' || title === 'Encerramento das atividades') {
      return '-';
    }
    if (title.startsWith('Chegada da Equipe') && /\s-\s*$|-$/.test(safe)) {
      return '-';
    }
    const facility = this.extractFacilityName(safe);
    if (/\bAudit[oó]rio\b/i.test(safe) && facility) {
      const article = /\b(COMAR|CBNB)\b/i.test(facility) ? 'do' : 'da';
      return `Auditório ${article} ${facility}`;
    }
    const explicitMatch = safe.match(
      /(Audit[oó]rio\s+d[oa]\s+[A-Z0-9À-ÿ\- ]+(?:COMAR|UNIFA|BASC|BAGL|CBNB))/i,
    );
    if (explicitMatch?.[1]) {
      return this.normalizeOcrLocation(explicitMatch[1]);
    }
    if (/\bAudit[oó]rio\b/i.test(safe)) {
      const contextFacility = this.extractFacilityName(
        `${safe} ${pageContext?.headingLine ?? ''}`,
      );
      if (contextFacility) {
        const article = /\b(COMAR|CBNB)\b/i.test(contextFacility) ? 'do' : 'da';
        return `Auditório ${article} ${contextFacility}`;
      }
    }
    if (title.startsWith('Chegada da Equipe')) {
      return '-';
    }
    return '';
  }

  private normalizeOcrLocation(value: string) {
    return this.cleanScheduleLine(value)
      .replace(/\bUNIEA\b/gi, 'UNIFA')
      .replace(/\bHI COMAR\b/gi, 'II COMAR');
  }

  private looksLikeOcrLocationFragment(line: string) {
    const normalized = this.normalizeFreeText(line);
    return (
      normalized.includes('auditorio') ||
      /^-\s*$/.test(line) ||
      /\b(comar|basc|bagl|cbnb|unifa|uniea)\b/i.test(line)
    );
  }

  private extractOcrResponsible(
    text: string,
    title: string,
    previousResponsible: string,
  ) {
    const normalized = this.normalizeFreeText(text);
    if (title === 'Intervalo') {
      return previousResponsible || 'Equipe de Campo';
    }
    if (title === 'Encerramento das atividades') {
      return 'Equipe de Campo';
    }
    if (title.startsWith('Chegada da Equipe')) {
      return 'Equipe de Campo';
    }
    if (title === 'Reunião com as CPCAs') {
      return 'Equipe de Campo';
    }
    if (title === 'Aplicação de pesquisa') {
      return '1S Raquel Melo';
    }
    if (title === 'Palestra de Conscientização e Prevenção ao Assédio') {
      return 'Cap Tamires';
    }
    if (title === 'Palestra sobre Violência Doméstica') {
      return 'Cap Tamires e Cap Ester';
    }
    if (title === 'Ciclo de Boas Práticas') {
      return normalized.includes('camargo')
        ? 'Cap Tamires, Cap Ester e Ten Camargo'
        : 'Cap Tamires, Cap Ester e Ten Camargo';
    }
    if (normalized.includes('raquel')) return '1S Raquel Melo';
    if (normalized.includes('equipe de campo')) return 'Equipe de Campo';
    if (normalized.includes('tamires') && normalized.includes('ester')) {
      return 'Cap Tamires e Cap Ester';
    }
    if (normalized.includes('tamires')) return 'Cap Tamires';
    return previousResponsible || 'Equipe de Campo';
  }

  private extractOcrParticipants(
    text: string,
    title: string,
    pageContext: { headingLine: string; headingUnits: string[] },
  ) {
    const normalized = this.normalizeFreeText(text);
    const unit = this.extractCoverageUnit(text, pageContext);
    if (
      title.startsWith('Chegada da Equipe') ||
      title === 'Intervalo' ||
      title === 'Encerramento das atividades'
    ) {
      return '-';
    }
    if (title === 'Palestra de Conscientização e Prevenção ao Assédio') {
      if (/\bcbnb\b/i.test(text)) return 'Todo efetivo do CBNB';
      return 'Todo efetivo escalado';
    }
    if (title === 'Palestra sobre Violência Doméstica') {
      if (/\bcbnb\b/i.test(text)) return 'Efetivo feminino do CBNB';
      return normalized.includes('escalado')
        ? 'Efetivo feminino escalado'
        : 'Efetivo feminino';
    }
    if (title === 'Aplicação de pesquisa') {
      if (/\bcbnb\b/i.test(text)) return 'Efetivo feminino do CBNB';
      return normalized.includes('escalado')
        ? 'Efetivo feminino escalado'
        : 'Efetivo feminino';
    }
    if (title === 'Reunião com as CPCAs') {
      return unit ? `CPCAs da ${unit}` : 'CPCAs';
    }
    if (title === 'Ciclo de Boas Práticas') {
      return unit
        ? `Jurídicos, Psicólogos e Assistentes Sociais da ${unit}`
        : 'Jurídicos, Psicólogos e Assistentes Sociais';
    }
    return '-';
  }

  private extractCoverageUnit(
    text: string,
    pageContext: { headingLine: string; headingUnits: string[] },
  ) {
    const safe = this.cleanScheduleLine(text);
    const guarnaeMatch = safe.match(/GUARNAE[-\s]+([A-Z]{2})/i);
    if (guarnaeMatch?.[1]) {
      return `GUARNAE-${String(guarnaeMatch[1]).toUpperCase()}`;
    }
    if (/\bCBNB\b/i.test(safe)) return 'CBNB';
    if (pageContext.headingUnits.length === 1) {
      return pageContext.headingUnits[0];
    }
    if (pageContext.headingUnits.length > 1) {
      if (/\bCBNB\b/i.test(safe)) {
        return 'CBNB';
      }
      const primaryGuarnae = pageContext.headingUnits.find((item) =>
        item.startsWith('GUARNAE-'),
      );
      if (primaryGuarnae) return primaryGuarnae;
      return pageContext.headingUnits[0];
    }
    return '';
  }

  private extractStructuredScheduleSegments(
    rawLine: string,
    bounds: {
      activityStart: number;
      cipavdStart: number;
      participantsStart: number;
      locationStart: number;
    },
  ) {
    const safeLine = rawLine.replace(/\r/g, '');
    const activity = safeLine
      .slice(bounds.activityStart, bounds.cipavdStart)
      .trim();
    const responsible = safeLine
      .slice(bounds.cipavdStart, bounds.participantsStart)
      .trim();
    const participants = safeLine
      .slice(bounds.participantsStart, bounds.locationStart)
      .trim();
    const location = safeLine.slice(bounds.locationStart).trim();
    return { activity, responsible, participants, location };
  }

  private appendStructuredSegments(
    row: {
      time: string;
      activity: string[];
      responsible: string[];
      participants: string[];
      location: string[];
    },
    segments: {
      activity?: string;
      responsible?: string;
      participants?: string;
      location?: string;
    },
  ) {
    if (segments.activity && !this.isSkippableScheduleLine(segments.activity)) {
      row.activity.push(segments.activity);
    }
    if (segments.responsible && !this.isLikelyNoiseLine(segments.responsible)) {
      row.responsible.push(segments.responsible);
    }
    if (segments.participants && !this.isLikelyNoiseLine(segments.participants)) {
      row.participants.push(segments.participants);
    }
    if (segments.location && !this.isLikelyNoiseLine(segments.location)) {
      row.location.push(segments.location);
    }
  }

  private parseScheduleDraftsFromText(
    text: string,
    fallbackLocation: string,
  ): Omit<
    AssistantScheduleDraftItem,
    'id' | 'sourceFileIds' | 'sourceFileNames'
  >[] {
    const pages = String(text ?? '')
      .split('\f')
      .map((page) => page.trim())
      .filter(Boolean);
    const parsedItems: Array<{
      title: string;
      startAt: string;
      durationMinutes: number;
      location: string;
      responsible: string;
      participants: string;
    }> = [];

    for (const page of pages) {
      const dateMatch = page.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
      const pageDate = dateMatch?.[0] ?? null;
      const chunks = this.extractScheduleChunks(page);
      if (!pageDate || !chunks.length) {
        continue;
      }
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const nextChunk = chunks[index + 1] ?? null;
        const item = this.parseScheduleChunk(
          chunk,
          pageDate,
          nextChunk?.normalizedTime ?? null,
          fallbackLocation,
        );
        if (item) {
          parsedItems.push(item);
        }
      }
    }

    return parsedItems.sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  private extractScheduleChunks(pageText: string) {
    const lines = String(pageText ?? '')
      .split('\n')
      .map((line) => this.cleanScheduleLine(line))
      .filter(Boolean);
    const chunks: Array<{ normalizedTime: string; lines: string[] }> = [];
    let active: { normalizedTime: string; lines: string[] } | null = null;

    for (const line of lines) {
      const timeMarker = this.extractTimeMarker(line);
      if (timeMarker) {
        if (active && active.lines.length) {
          chunks.push(active);
        }
        active = {
          normalizedTime: timeMarker.normalizedTime,
          lines: timeMarker.remainder ? [timeMarker.remainder] : [],
        };
        continue;
      }
      if (!active) {
        continue;
      }
      if (this.isSkippableScheduleLine(line)) {
        continue;
      }
      active.lines.push(line);
    }

    if (active && active.lines.length) {
      chunks.push(active);
    }
    return chunks;
  }

  private parseScheduleChunk(
    chunk: { normalizedTime: string; lines: string[] },
    pageDate: string,
    nextTime: string | null,
    fallbackLocation: string,
  ) {
    const contentLines = chunk.lines
      .map((line) => this.cleanScheduleLine(line))
      .filter((line) => line && !this.isSkippableScheduleLine(line));
    if (!contentLines.length) return null;

    let title = contentLines[0];
    let titleLinesConsumed = 1;
    if (
      contentLines[1] &&
      (contentLines[1].startsWith('(') ||
        /^[a-zà-ÿ]/i.test(contentLines[1]) ||
        /organiza(c|ç)[aã]o|log[ií]stica|atividades/i.test(contentLines[1]))
    ) {
      title = `${title} ${contentLines[1]}`.replace(/\s+/g, ' ').trim();
      titleLinesConsumed = 2;
    }

    const normalizedTitle = this.normalizeScheduleTitle(title);
    if (!normalizedTitle) return null;

    const remainingLines = contentLines.slice(titleLinesConsumed);
    const location =
      [...remainingLines].reverse().find((line) => this.isLikelyLocationLine(line)) ||
      fallbackLocation ||
      'A definir';
    const responsible =
      remainingLines.find((line) => this.isLikelyResponsibleLine(line)) ||
      this.inferResponsibleFromTitle(normalizedTitle);
    const participants = remainingLines
      .filter(
        (line) =>
          line !== location &&
          line !== responsible &&
          !this.isLikelyNoiseLine(line),
      )
      .join(' | ')
      .replace(/\s+/g, ' ')
      .trim();

    const startAt = this.combineDateAndTime(pageDate, chunk.normalizedTime);
    const durationMinutes = this.estimateDurationMinutes(
      chunk.normalizedTime,
      nextTime,
    );

    return {
      title: normalizedTitle,
      startAt,
      durationMinutes,
      location:
        location === '-' || location === '—' ? '-' : location,
      responsible: responsible || 'Equipe de Campo',
      participants,
    };
  }

  private extractTimeMarker(line: string) {
    const match = line.match(/^(\d{1,2})h(?:([0-5]\d))?(?:\s+|$)(.*)$/i);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? '0');
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return null;
    }
    return {
      normalizedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      remainder: this.cleanScheduleLine(match[3] ?? ''),
    };
  }

  private cleanScheduleLine(line: string) {
    return String(line ?? '')
      .replace(/[|¦]+/g, ' ')
      .replace(/[—–]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isSkippableScheduleLine(line: string) {
    const normalized = this.normalizeFreeText(line);
    if (!normalized) return true;
    if (
      [
        'data',
        'manha',
        'manha tarde',
        'tarde',
        'horario',
        'atividade',
        'participantes',
        'participantes cipavd',
        'local sugerido',
        'local',
      ].includes(normalized)
    ) {
      return true;
    }
    if (
      normalized.startsWith('cronograma') ||
      normalized.startsWith('dia ') ||
      /^\(\w+/i.test(line) ||
      /\bsegunda-feira\b|\bterca-feira\b|\bterça-feira\b|\bquarta-feira\b|\bquinta-feira\b|\bsexta-feira\b/i.test(
        normalized,
      ) ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(line)
    ) {
      return true;
    }
    return false;
  }

  private isLikelyLocationLine(line: string) {
    return /(audit[oó]rio|comar|unifa|basc|bagl|cbnb|base|sala|hangar|ala|guarnae|esquadrao|esquadr[aã]o)/i.test(
      line,
    );
  }

  private isLikelyResponsibleLine(line: string) {
    return /\b(cap|ten|maj|cel|brig|1s|2s|3s|cb|sd|equipe de campo|ten camargo|cap ester|cap tamires|raquel)\b/i.test(
      line,
    );
  }

  private inferResponsibleFromTitle(title: string) {
    if (/pesquisa/i.test(title)) return 'Equipe de Campo';
    if (/chegada da equipe|reuniao com as cpcas|encerramento|intervalo/i.test(this.normalizeFreeText(title))) {
      return 'Equipe de Campo';
    }
    return 'Equipe de Campo';
  }

  private isLikelyNoiseLine(line: string) {
    const normalized = this.normalizeFreeText(line);
    return (
      !normalized ||
      normalized === '-' ||
      normalized.length <= 2 ||
      /^[\W_]+$/.test(line)
    );
  }

  private normalizeScheduleTitle(title: string) {
    const safe = String(title ?? '')
      .replace(/\s+/g, ' ')
      .replace(/^(Chegada da Equipe.+?)\s+atividades\)?$/i, '$1 atividades)')
      .replace(
        /^(Cap|Ten|Maj|Cel|Brig|1S|2S|3S)\s+[A-ZÀ-ÿ][^\s]*\s+(?=(Palestra|Aplicação|Ciclo|Reunião|Chegada|Encerramento))/i,
        '',
      )
      .trim();
    if (!safe) return '';
    if (
      this.isSkippableScheduleLine(safe) ||
      /^(todo efetivo|efetivo feminino|juridicos|jur[ií]dicos|cpcas da)/i.test(
        safe,
      )
    ) {
      return '';
    }
    return safe;
  }

  private combineDateAndTime(date: string, normalizedTime: string) {
    const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      throw new BadRequestException(
        'Não consegui identificar a data do cronograma no arquivo enviado.',
      );
    }
    return `${match[3]}-${match[2]}-${match[1]}T${normalizedTime}:00`;
  }

  private estimateDurationMinutes(
    currentTime: string,
    nextTime: string | null,
  ) {
    if (!nextTime) return 60;
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [nextHour, nextMinute] = nextTime.split(':').map(Number);
    const currentTotal = currentHour * 60 + currentMinute;
    const nextTotal = nextHour * 60 + nextMinute;
    const diff = nextTotal - currentTotal;
    if (!Number.isFinite(diff) || diff < 10) return 60;
    if (diff > 240) return 60;
    return diff;
  }

  private buildScheduleUploadMessage(
    files: AssistantScheduleSourceFile[],
    items: AssistantScheduleDraftItem[],
  ) {
    const fileSummary = files
      .map(
        (file) =>
          `- **${file.name}**: ${file.itemCount} item(ns), extração por ${file.extractionMethod === 'text' ? 'texto' : 'OCR'}${file.pageCount ? `, ${file.pageCount} página(s)` : ''}`,
      )
      .join('\n');
    return [
      'Analisei os arquivos enviados e montei um rascunho do cronograma para revisão.',
      fileSummary,
      '',
      this.buildSchedulePreviewMessage(items),
      '',
      'Se estiver correto, confirme o cadastro. Se precisar ajustar, escreva por exemplo **alterar item 2** ou **remover item 3**.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSchedulePreviewMessage(items: AssistantScheduleDraftItem[]) {
    const preview = items.slice(0, 8).map((item, index) => {
      const when = this.formatScheduleDateTime(item.startAt);
      return `${index + 1}. **${item.title}**\nLocal: ${item.location || '-'}\nInício: ${when}\nDuração: ${item.durationMinutes} min\nResponsável: ${item.responsible || '-'}\nParticipantes: ${item.participants || '-'}`;
    });
    const remaining =
      items.length > preview.length
        ? `\n... e mais ${items.length - preview.length} item(ns) no rascunho.`
        : '';
    return `**Itens montados**\n\n${preview.join('\n\n')}${remaining}`;
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

  private formatScheduleDateTime(value: string) {
    const safe = String(value ?? '').trim();
    const match = safe.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/,
    );
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}`;
    }
    const date = new Date(safe);
    if (Number.isNaN(date.getTime())) return safe;
    return date.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    });
  }
}
