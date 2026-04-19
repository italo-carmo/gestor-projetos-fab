import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActivityScope, LocalityCatalogType } from '@prisma/client';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ActivitiesService } from '../activities/activities.service';
import {
  LitellmService,
  looksLikeInternalReasoning,
  stripReasoningPrefix,
} from '../llm/litellm.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from '../missions/missions.service';
import { SocialCommunicationService } from '../social-communication/social-communication.service';
import { TasksService } from '../tasks/tasks.service';

const execFileAsync = promisify(execFile);

type AssistantIntent =
  | 'create_mission'
  | 'create_activity'
  | 'create_task'
  | 'create_mission_schedule'
  | 'create_social_article';

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

type AssistantScheduleMissingFieldKey =
  | 'title'
  | 'location'
  | 'responsible'
  | 'participants';

type AssistantScheduleMissingField = {
  itemId: string;
  itemNumber: number;
  itemIndex: number;
  fieldKey: AssistantScheduleMissingFieldKey;
  fieldLabel: string;
};

type AssistantScheduleLlmDraftItem = {
  title?: string | null;
  startAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  responsible?: string | null;
  participants?: string | null;
  confidence?: number | null;
  notes?: string[] | null;
};

type AssistantGeneratedArticleDraft = {
  title: string;
  summary: string;
  contentText: string;
  tags: string[];
  audience: 'INTERNAL' | 'EXTERNAL';
  referencesUsed: Array<{
    id: string;
    title: string;
    publishedAt?: string | null;
    sourceUrl: string;
  }>;
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
  entityType:
    | 'mission'
    | 'activity'
    | 'task'
    | 'mission_schedule'
    | 'social_communication_article';
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
    schedulePreviewStartNumber?: number;
    schedulePreviewEndNumber?: number;
    scheduleTotalItems?: number;
    scheduleSavedCount?: number;
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
    title: 'Criar ou editar cronograma em missão',
    description:
      'Permite criar um cronograma novo ou editar um cronograma já salvo, sempre com confirmação antes de gravar.',
  },
  {
    id: 'create_social_article',
    title: 'Criar matéria a partir de missão',
    description:
      'Cruza missão, atividades executadas e matérias do mesmo escopo para montar uma notícia revisável antes de salvar.',
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
    title: 'Criar ou editar cronograma em missão',
    description:
      'Fluxo assistido para criar ou editar o cronograma da missão, revisar os dados e só depois gravar.',
    confirmLabel: 'Confirmar alteração no cronograma',
  },
  create_social_article: {
    title: 'Criar matéria a partir de missão',
    description:
      'Fluxo assistido para gerar uma matéria com base na missão, nas atividades executadas e nas matérias do mesmo escopo.',
    confirmLabel: 'Confirmar criação da matéria',
  },
};

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly sessionTtlMs = 4 * 60 * 60 * 1000;
  private readonly sessions = new Map<string, AssistantSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionsService,
    private readonly activities: ActivitiesService,
    private readonly tasks: TasksService,
    private readonly socialCommunication: SocialCommunicationService,
    private readonly litellm: LitellmService,
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
    workflow.draft.scheduleMissingFieldQueue = this.buildScheduleMissingFieldQueue(
      workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[],
    );
    workflow.draft.scheduleSourceFiles = [...existingFiles, ...parseResult.files];
    workflow.draft.scheduleBatchSize = this.getScheduleBatchSize();
    workflow.draft.scheduleSavedCount = 0;
    workflow.draft.scheduleTotalItems = (
      workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[]
    ).length;
    workflow.status = Array.isArray(workflow.draft.scheduleMissingFieldQueue) &&
      workflow.draft.scheduleMissingFieldQueue.length
        ? 'collecting'
        : 'confirming';
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
        this.buildScheduleUploadMessage(
          parseResult.files,
          parseResult.items,
          0,
          this.getCurrentScheduleMissingField(workflow.draft),
        ),
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
            'Posso atuar como assistente operacional para **criar missão**, **criar atividade de campo**, **criar tarefa**, **criar/editar cronograma em missão** ou **criar matéria a partir de missão**.',
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

    if (
      workflow.intent === 'create_social_article' &&
      rawMessage &&
      !fieldInput?.field &&
      !wantsSkip &&
      !wantsConfirm &&
      !workflowView.currentField &&
      this.readGeneratedArticleDraft(workflow.draft)
    ) {
      return await this.handleSocialArticleRevision(
        session,
        workflow,
        rawMessage,
        user,
      );
    }

    if (wantsConfirm && workflow.status === 'confirming') {
      try {
        if (
          workflow.intent === 'create_mission_schedule' &&
          workflow.draft.scheduleOperation === 'EDIT' &&
          this.getPendingExistingScheduleUpdate(workflow.draft)
        ) {
          return await this.confirmExistingScheduleItemEdit(session, workflow, user);
        }
        if (
          workflow.intent === 'create_mission_schedule' &&
          workflow.draft.scheduleInputMode === 'UPLOAD'
        ) {
          return await this.confirmScheduleUploadBatch(session, workflow, user);
        }
        const createdItem = await this.executeWorkflow(workflow, user);
        session.updatedAt = new Date().toISOString();
        if (workflow.intent === 'create_mission') {
          session.workflow = {
            intent: 'create_mission_schedule',
            status: 'collecting',
            currentField: null,
            draft: {
              scheduleOperation: 'CREATE',
              scope: workflow.draft.scope,
              missionId: createdItem.id,
              scheduleFromMissionCreation: true,
              scheduleCreateAfterMission: null,
            },
          };
          const nextWorkflowView = await this.buildWorkflowView(session.workflow, user);
          return this.buildReply(
            session,
            this.pushMessage(
              session,
              'assistant',
              [
                'Missão criada com sucesso.',
                `Registro criado: **${createdItem.title}**.`,
                'Deseja criar o cronograma dessa missão agora?',
              ].join('\n\n'),
            ),
            nextWorkflowView,
            createdItem,
          );
        }
        workflow.status = 'completed';
        session.workflow = null;
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
    if (
      workflow.intent === 'create_social_article' &&
      updatedView.readyToConfirm &&
      !this.readGeneratedArticleDraft(workflow.draft)
    ) {
      workflow.draft.generatedArticle = await this.generateSocialArticleDraft(
        workflow.draft,
        user,
      );
      workflow.status = 'confirming';
      const refreshedView = await this.buildWorkflowView(workflow, user);
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          this.buildSocialArticleDraftMessage(workflow.draft),
        ),
        refreshedView,
        null,
      );
    }
    if (
      workflow.intent === 'create_mission_schedule' &&
      workflow.draft.scheduleFromMissionCreation === true &&
      workflow.draft.scheduleCreateAfterMission === false
    ) {
      workflow.status = 'completed';
      session.workflow = null;
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          'Certo. A missão foi criada sem cronograma. Se precisar, você pode iniciar o cronograma depois pelo próprio assistente ou pela tela da missão.',
        ),
        null,
        null,
      );
    }
    if (
      workflow.intent === 'create_mission_schedule' &&
      workflow.draft.scheduleOperation === 'EDIT'
    ) {
      const selectedMissionNow =
        workflowView.currentField?.field === 'missionId' &&
        updatedView.currentField?.field === 'scheduleCreateIfMissing' &&
        !!workflow.draft.missionId;
      if (selectedMissionNow) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'Esta missão ainda não possui cronograma inserido. Deseja iniciar a criação agora?',
          ),
          updatedView,
          null,
        );
      }
      const scheduleReadyToSelectItem =
        workflowView.currentField?.field === 'missionId' &&
        updatedView.currentField?.field === 'scheduleExistingItemId' &&
        Array.isArray(workflow.draft.scheduleExistingItems) &&
        workflow.draft.scheduleExistingItems.length > 0;
      if (scheduleReadyToSelectItem) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            this.buildExistingScheduleListMessage(
              workflow.draft.scheduleExistingItems as AssistantScheduleDraftItem[],
            ),
          ),
          updatedView,
          null,
        );
      }
      const switchedToCreation =
        workflowView.currentField?.field === 'scheduleCreateIfMissing' &&
        workflow.draft.scheduleOperation === 'CREATE';
      if (switchedToCreation) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            updatedView.currentField
              ? `A missão ainda não tinha cronograma. Vou seguir com a criação. Agora preciso de **${updatedView.currentField.label.toLowerCase()}**.`
              : 'A missão ainda não tinha cronograma. Vou seguir com a criação.',
          ),
          updatedView,
          null,
        );
      }
      const declinedCreation =
        workflowView.currentField?.field === 'scheduleCreateIfMissing' &&
        updatedView.currentField?.field === 'missionId' &&
        !workflow.draft.missionId;
      if (declinedCreation) {
        return this.buildReply(
          session,
          this.pushMessage(
            session,
            'assistant',
            'Certo. Escolha outra missão para editar ou cancele o fluxo.',
          ),
          updatedView,
          null,
        );
      }
    }
    if (updatedView.readyToConfirm) {
      workflow.status = 'confirming';
      const confirmationMessage =
        workflow.intent === 'create_mission_schedule' &&
        workflow.draft.scheduleOperation !== 'EDIT'
          ? this.buildScheduleReadyToConfirmMessage(updatedView, workflow.draft)
          : workflow.intent === 'create_social_article'
            ? this.buildSocialArticleDraftMessage(workflow.draft)
          : workflow.intent === 'create_activity' ||
              workflow.intent === 'create_task' ||
              workflow.intent === 'create_mission'
            ? this.buildEntityReadyToConfirmMessage(updatedView)
          : [
              `Rascunho de **${updatedView.title.toLowerCase()}** pronto para conferência.`,
              'Revise os dados abaixo. Se estiver tudo certo, confirme a execução.',
            ].join('\n\n');
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          confirmationMessage,
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
        this.buildCurrentFieldPromptMessage(updatedView.currentField, workflow.draft),
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
    const schedulePreview =
      workflow &&
      workflow.intent === 'create_mission_schedule' &&
      workflow.draft.scheduleOperation !== 'EDIT'
        ? this.getSchedulePreviewState(workflow.draft)
        : null;
    const existingScheduleItems =
      workflow?.intent === 'create_mission_schedule' &&
      workflow?.draft?.scheduleOperation === 'EDIT' &&
      Array.isArray(workflow?.draft?.scheduleExistingItems)
        ? (workflow.draft.scheduleExistingItems as AssistantScheduleDraftItem[])
        : [];
    return {
      sessionId: session.id,
      message,
      workflow: workflow
        ? {
            ...workflow,
            attachments,
            scheduleItems:
              workflow.intent === 'create_mission_schedule' &&
              workflow.draft.scheduleOperation === 'EDIT'
                ? existingScheduleItems
                : schedulePreview?.items ?? [],
            schedulePreviewStartNumber: schedulePreview?.startNumber,
            schedulePreviewEndNumber: schedulePreview?.endNumber,
            scheduleTotalItems: schedulePreview?.total,
            scheduleSavedCount: schedulePreview?.savedCount,
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
    if (
      normalized.includes('noticia') ||
      normalized.includes('notícia') ||
      normalized.includes('materia') ||
      normalized.includes('matéria')
    ) {
      return 'create_social_article';
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
    const schedulePreview =
      workflow.intent === 'create_mission_schedule' &&
      workflow.draft.scheduleOperation !== 'EDIT' &&
      workflow.draft.scheduleInputMode === 'UPLOAD'
        ? this.getSchedulePreviewState(workflow.draft)
        : null;
    const pendingExistingEdit = this.getPendingExistingScheduleUpdate(workflow.draft);
    return {
      intent: workflow.intent,
      title: INTENT_META[workflow.intent].title,
      description: INTENT_META[workflow.intent].description,
      status: currentField ? 'collecting' : workflow.status,
      draft: workflow.draft,
      summary,
      currentField,
      readyToConfirm: !currentField,
      confirmLabel: pendingExistingEdit
        ? `Confirmar alteração do item ${pendingExistingEdit.itemNumber}`
        : schedulePreview
        ? `Confirmar itens ${schedulePreview.startNumber}-${schedulePreview.endNumber}`
        : INTENT_META[workflow.intent].confirmLabel,
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
    if (workflow.intent === 'create_mission_schedule') {
      if (field.field === 'scheduleCreateAfterMission') {
        workflow.draft.scheduleCreateAfterMission = this.parseBooleanValue(
          this.normalizeFieldValue(field, value),
          field.label,
        );
        return;
      }
      if (field.field === 'scheduleOperation') {
        const option = this.resolveSingleOption(
          field.options ?? [],
          this.normalizeFieldValue(field, value),
        );
        if (!option) {
          throw new BadRequestException(
            `Selecione uma opção válida para ${field.label.toLowerCase()}.`,
          );
        }
        workflow.draft.scheduleOperation = option.value;
        this.resetMissionScheduleDraftForOperationChange(workflow.draft);
        return;
      }
      if (field.field === 'missionId') {
        const option = this.resolveSingleOption(
          field.options ?? [],
          this.normalizeFieldValue(field, value),
        );
        if (!option) {
          throw new BadRequestException(
            `Selecione uma opção válida para ${field.label.toLowerCase()}.`,
          );
        }
        workflow.draft.missionId = option.value;
        this.resetMissionScheduleDraftForMissionChange(workflow.draft);
        if (workflow.draft.scheduleOperation === 'EDIT') {
          await this.syncExistingScheduleItems(workflow.draft, user);
        }
        return;
      }
    if (field.field === 'scheduleCreateIfMissing') {
        const shouldCreate = this.parseBooleanValue(
          this.normalizeFieldValue(field, value),
          field.label,
        );
        if (shouldCreate) {
          workflow.draft.scheduleOperation = 'CREATE';
          workflow.draft.scheduleCreateIfMissing = null;
          this.clearExistingScheduleSelection(workflow.draft);
        } else {
          workflow.draft.scheduleCreateIfMissing = false;
          workflow.draft.missionId = null;
          this.clearExistingScheduleSelection(workflow.draft);
          workflow.draft.scheduleExistingItems = [];
        }
        return;
      }
      if (field.field === 'scheduleExistingItemId') {
        const option = this.resolveSingleOption(
          field.options ?? [],
          this.normalizeFieldValue(field, value),
        );
        if (!option) {
          throw new BadRequestException(
            `Selecione uma opção válida para ${field.label.toLowerCase()}.`,
          );
        }
        workflow.draft.scheduleExistingItemId = option.value;
        workflow.draft.scheduleExistingEditFieldKey = null;
        workflow.draft.scheduleExistingPendingUpdate = null;
        return;
      }
      if (field.field === 'scheduleExistingEditFieldKey') {
        const option = this.resolveSingleOption(
          field.options ?? [],
          this.normalizeFieldValue(field, value),
        );
        if (!option) {
          throw new BadRequestException(
            `Selecione uma opção válida para ${field.label.toLowerCase()}.`,
          );
        }
        workflow.draft.scheduleExistingEditFieldKey = option.value;
        workflow.draft.scheduleExistingPendingUpdate = null;
        return;
      }
    }
    if (field.inputType === 'file_upload') {
      throw new BadRequestException(
        'Use o envio de arquivo do assistente para anexar o cronograma.',
      );
    }
    const normalized = this.normalizeFieldValue(field, value);
    if (field.field === 'scheduleMissingFieldValue') {
      this.applyMissingScheduleFieldValue(workflow, normalized);
      return;
    }
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
      if (field.field === 'scheduleMissingFieldValue') {
        this.applyMissingScheduleFieldValue(workflow, parsed);
        return;
      }
      if (field.field === 'scheduleExistingEditValue') {
        this.stageExistingScheduleItemEdit(workflow, parsed);
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
      if (field.field === 'scheduleMissingFieldValue') {
        this.applyMissingScheduleFieldValue(workflow, `${parsed}T00:00:00`);
        return;
      }
      if (field.field === 'scheduleExistingEditValue') {
        this.stageExistingScheduleItemEdit(workflow, `${parsed}T00:00:00`);
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
      if (field.field === 'scheduleMissingFieldValue') {
        this.applyMissingScheduleFieldValue(workflow, parsed);
        return;
      }
      if (field.field === 'scheduleExistingEditValue') {
        this.stageExistingScheduleItemEdit(workflow, parsed);
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
    if (field.field === 'scheduleMissingFieldValue') {
      this.applyMissingScheduleFieldValue(workflow, text || '');
      return;
    }
    if (field.field === 'scheduleExistingEditValue') {
      this.stageExistingScheduleItemEdit(workflow, text || '');
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
          options: await this.listActivityTypeOptions(draft.scope),
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
      const scopeField: AssistantFieldConfig = {
        field: 'scope',
        label: 'Escopo da tarefa',
        inputType: 'single_select',
        options: [
          { value: 'SMIF', label: 'SMIF' },
          { value: 'CIPAVD', label: 'CIPAVD' },
        ],
      };
      const scopeValue = String(draft.scope ?? '').trim().toUpperCase();
      if (scopeValue !== 'SMIF' && scopeValue !== 'CIPAVD') {
        return [scopeField];
      }
      return [
        scopeField,
        {
          field: 'localityIds',
          label: 'Localidades da tarefa',
          inputType: 'multi_select',
          multiple: true,
          options: await this.listTaskLocalityOptions(draft.scope),
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

    if (intent === 'create_social_article') {
      return [
        {
          field: 'scope',
          label: 'Escopo da matéria',
          inputType: 'single_select',
          options: [
            { value: 'SMIF', label: 'SMIF' },
            { value: 'CIPAVD', label: 'CIPAVD' },
          ],
        },
        {
          field: 'missionId',
          label: 'Missão de referência',
          inputType: 'single_select',
          options: await this.listMissionOptions(draft.scope, user),
        },
        {
          field: 'audience',
          label: 'Público da matéria',
          inputType: 'single_select',
          options: [
            {
              value: 'INTERNAL',
              label: 'Interno',
              description:
                'Texto mais institucional, voltado ao público interno do sistema.',
            },
            {
              value: 'EXTERNAL',
              label: 'Externo',
              description:
                'Texto com linguagem mais aberta para divulgação externa.',
            },
          ],
        },
        {
          field: 'articleAngle',
          label: 'Ângulo ou foco principal',
          inputType: 'textarea',
          optional: true,
          helperText:
            'Campo opcional. Ex.: destacar prevenção, alcance da missão, atuação nas OMs atendidas.',
        },
      ];
    }

    const isMissionCreatedInFlow = draft.scheduleFromMissionCreation === true;
    if (
      isMissionCreatedInFlow &&
      typeof draft.scheduleCreateAfterMission !== 'boolean'
    ) {
      return [
        {
          field: 'scheduleCreateAfterMission',
          label: 'Deseja criar o cronograma agora?',
          inputType: 'boolean',
          helperText:
            'Se responder Sim, o assistente continua imediatamente no fluxo de cronograma desta missão.',
        },
      ];
    }

    const baseFields: AssistantFieldConfig[] = isMissionCreatedInFlow
      ? []
      : [
          {
            field: 'scheduleOperation',
            label: 'O que deseja fazer no cronograma?',
            inputType: 'single_select',
            options: [
              {
                value: 'CREATE',
                label: 'Criar novo cronograma',
                description:
                  'Monta um cronograma novo para a missão, por PDF ou manualmente.',
              },
              {
                value: 'EDIT',
                label: 'Editar cronograma existente',
                description:
                  'Lista os itens já salvos e permite alterar um campo por vez com confirmação.',
              },
            ],
          },
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
        ];

    if (draft.scheduleOperation === 'EDIT') {
      const existingItems = await this.syncExistingScheduleItems(draft, user);
      if (draft.missionId && existingItems.length === 0) {
        return [
          ...baseFields,
          {
            field: 'scheduleCreateIfMissing',
            label: 'A missão ainda não possui cronograma. Deseja criar agora?',
            inputType: 'boolean',
            helperText:
              'Se responder Sim, o assistente segue para a criação do cronograma nesta mesma missão.',
          },
        ];
      }
      if (draft.scheduleExistingPendingUpdate) {
        return baseFields;
      }
      const editFields: AssistantFieldConfig[] = [
        ...baseFields,
        {
          field: 'scheduleExistingItemId',
          label: 'Item do cronograma para editar',
          inputType: 'single_select',
          options: existingItems.map((item: any, index: number) => ({
            value: item.id,
            label: `${index + 1}. ${item.title}`,
            description: `${this.formatScheduleDateTime(item.startAt)} • ${item.durationMinutes} min`,
          })),
        },
      ];
      if (!draft.scheduleExistingItemId) {
        return editFields;
      }
      if (!draft.scheduleExistingEditFieldKey) {
        return [
          ...editFields,
          {
            field: 'scheduleExistingEditFieldKey',
            label: 'Campo a alterar',
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
      const itemNumber =
        existingItems.findIndex(
          (item: any) => item.id === draft.scheduleExistingItemId,
        ) + 1;
      return [
        ...editFields,
        {
          field: 'scheduleExistingEditFieldKey',
          label: 'Campo a alterar',
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
        this.buildScheduleEditValueField(
          draft.scheduleExistingEditFieldKey,
          Math.max(itemNumber, 1),
          'scheduleExistingEditValue',
        ),
      ];
    }

    const createBaseFields: AssistantFieldConfig[] = [
      ...baseFields,
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

    const currentMissingField =
      draft.scheduleInputMode === 'UPLOAD'
        ? this.getCurrentScheduleMissingField(draft)
        : null;
    if (currentMissingField) {
      return [
        ...createBaseFields,
        this.buildMissingScheduleFieldConfig(draft, currentMissingField),
      ];
    }

    if (draft.scheduleInputMode === 'UPLOAD') {
      if (draft.scheduleEditIndex !== undefined && draft.scheduleEditIndex !== null) {
        if (!draft.scheduleEditFieldKey) {
          return [
            ...createBaseFields,
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
          ...createBaseFields,
          this.buildScheduleEditValueField(
            draft.scheduleEditFieldKey,
            this.getScheduleSavedCount(draft) +
              Number(draft.scheduleEditIndex) +
              1,
            'scheduleEditValue',
          ),
        ];
      }
      return [
        ...createBaseFields,
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
      ...createBaseFields,
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

  private async listTaskLocalityOptions(scope: string | undefined) {
    const normalizedScope = String(scope ?? '').toUpperCase();
    if (normalizedScope !== 'SMIF' && normalizedScope !== 'CIPAVD') {
      return [];
    }
    const catalogType =
      normalizedScope === 'CIPAVD'
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

  private async listActivityTypeOptions(scope?: string) {
    const response = await this.activities.listTypes(scope);
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
        { label: 'Escopo', value: draft.scope || 'SMIF' },
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

    if (intent === 'create_social_article') {
      const generatedDraft = this.readGeneratedArticleDraft(draft);
      return [
        { label: 'Escopo', value: draft.scope || '—' },
        { label: 'Missão', value: (await findOptionLabel('missionId', draft.missionId)) || '—' },
        {
          label: 'Público',
          value:
            draft.audience === 'EXTERNAL'
              ? 'Externo'
              : draft.audience === 'INTERNAL'
                ? 'Interno'
                : '—',
        },
        {
          label: 'Foco principal',
          value: draft.articleAngle || 'Matéria institucional baseada na missão',
        },
        {
          label: 'Título sugerido',
          value: generatedDraft?.title || 'Aguardando geração',
        },
        {
          label: 'Tags',
          value: generatedDraft?.tags?.length
            ? generatedDraft.tags.map((item) => `#${item}`).join(' ')
            : 'Aguardando geração',
        },
      ];
    }

    const missionLabel = await findOptionLabel('missionId', draft.missionId);
    if (draft.scheduleOperation === 'EDIT') {
      const existingItems = Array.isArray(draft.scheduleExistingItems)
        ? (draft.scheduleExistingItems as AssistantScheduleDraftItem[])
        : [];
      const selectedItem = existingItems.find(
        (item) => item.id === draft.scheduleExistingItemId,
      );
      const pendingUpdate = this.getPendingExistingScheduleUpdate(draft);
      return [
        { label: 'Modo do fluxo', value: 'Editar cronograma existente' },
        { label: 'Escopo', value: draft.scope || '—' },
        { label: 'Missão', value: missionLabel || '—' },
        {
          label: 'Itens salvos',
          value: existingItems.length
            ? `${existingItems.length} item(ns) no cronograma`
            : draft.missionId
              ? 'Nenhum item salvo nesta missão'
              : 'Selecione a missão',
        },
        {
          label: 'Item selecionado',
          value: selectedItem ? selectedItem.title : '—',
        },
        {
          label: 'Próxima ação',
          value: pendingUpdate
            ? `Confirmar a alteração do item ${pendingUpdate.itemNumber}.`
            : draft.missionId && !existingItems.length
              ? 'Definir se deseja criar um cronograma novo nesta missão.'
              : selectedItem
                ? 'Escolher o campo que deseja alterar e informar o novo valor.'
                : 'Selecionar o item do cronograma que deseja editar.',
        },
        ...(pendingUpdate
          ? [
              {
                label: 'Alteração proposta',
                value: `Item ${pendingUpdate.itemNumber} • ${pendingUpdate.title}\n${pendingUpdate.fieldLabel}: ${pendingUpdate.previousValue} -> ${pendingUpdate.nextValue}`,
              },
            ]
          : []),
      ];
    }

    if (draft.scheduleInputMode === 'UPLOAD') {
      const sourceFiles = Array.isArray(draft.scheduleSourceFiles)
        ? (draft.scheduleSourceFiles as AssistantScheduleSourceFile[])
        : [];
      const schedulePreview = this.getSchedulePreviewState(draft);
      return [
        { label: 'Modo do fluxo', value: 'Criar novo cronograma' },
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
          value: schedulePreview.total
            ? `${schedulePreview.total} item(ns) no total`
            : 'Aguardando leitura do cronograma',
        },
        {
          label: 'Lote em revisão',
          value: schedulePreview.items.length
            ? `${schedulePreview.startNumber}-${schedulePreview.endNumber}`
            : '—',
        },
        {
          label: 'Próxima ação',
          value:
            this.getCurrentScheduleMissingField(draft)
              ? `Informar ${this.getCurrentScheduleMissingField(draft)?.fieldLabel.toLowerCase()} do item ${this.getCurrentScheduleMissingField(draft)?.itemNumber}.`
              : draft.scheduleEditIndex !== undefined && draft.scheduleEditIndex !== null
              ? `Ajustando item ${
                  this.getScheduleSavedCount(draft) +
                  Number(draft.scheduleEditIndex) +
                  1
                }`
              : schedulePreview.total
                ? 'Você pode confirmar o lote atual, remover ou alterar itens específicos.'
                : 'Envie um ou mais PDFs para o assistente montar o cronograma.',
        },
      ];
    }
    return [
      { label: 'Modo do fluxo', value: 'Criar novo cronograma' },
      { label: 'Escopo', value: draft.scope || '—' },
      { label: 'Missão', value: missionLabel || '—' },
      ...(draft.scheduleFromMissionCreation === true
        ? [{ label: 'Origem', value: 'Missão criada nesta conversa' }]
        : []),
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
          scope: draft.scope || ActivityScope.SMIF,
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
        url: `/tasks?scope=${encodeURIComponent(
          String(draft.scope || 'SMIF'),
        )}&taskId=${encodeURIComponent(String(first.id))}`,
      };
    }

    if (workflow.intent === 'create_social_article') {
      const generatedDraft = this.readGeneratedArticleDraft(draft);
      if (!generatedDraft) {
        throw new BadRequestException(
          'Gere e revise o rascunho da matéria antes de confirmar a criação.',
        );
      }
      const mission = await this.resolveSocialArticleMission(draft.missionId, user);
      const created = await this.socialCommunication.create(
        {
          url: this.buildGeneratedArticleSourceUrl(mission.id),
          title: generatedDraft.title,
          summary: generatedDraft.summary,
          contentText: generatedDraft.contentText,
          tags: generatedDraft.tags,
          audience: generatedDraft.audience,
          publishedAt: new Date().toISOString(),
        },
        user,
      );
      return {
        entityType: 'social_communication_article',
        id: String(created.id),
        title: String(created.title),
        url: '/social-communication',
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

  private readGeneratedArticleDraft(
    draft: Record<string, any>,
  ): AssistantGeneratedArticleDraft | null {
    const raw = draft.generatedArticle;
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title ?? '').trim();
    const summary = String(raw.summary ?? '').trim();
    const contentText = String(raw.contentText ?? '').trim();
    if (!title || !summary || !contentText) return null;
    return {
      title,
      summary,
      contentText,
      tags: Array.isArray(raw.tags)
        ? raw.tags.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
        : [],
      audience: raw.audience === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      referencesUsed: Array.isArray(raw.referencesUsed)
        ? raw.referencesUsed
            .map((item: any) => ({
              id: String(item?.id ?? '').trim(),
              title: String(item?.title ?? '').trim(),
              publishedAt: item?.publishedAt ? String(item.publishedAt) : null,
              sourceUrl: String(item?.sourceUrl ?? '').trim(),
            }))
            .filter((item: any) => item.id && item.title)
        : [],
    };
  }

  private async resolveSocialArticleMission(missionId: string, user?: RbacUser) {
    const mission = (await this.missions.getById(missionId, user)) as any;
    if (!mission?.id) {
      throw new BadRequestException(
        'Selecione uma missão válida para gerar a matéria.',
      );
    }
    return mission;
  }

  private async listExecutedMissionActivities(mission: any) {
    const startDate = mission?.startDate ? new Date(mission.startDate) : null;
    const endDate = mission?.endDate ? new Date(mission.endDate) : null;
    if (!mission?.localityId || !startDate || !endDate) {
      return [];
    }

    const baseWhere = {
      localityId: String(mission.localityId),
      scope:
        String(mission.scope ?? '').toUpperCase() === 'CIPAVD'
          ? ActivityScope.CIPAVD
          : ActivityScope.SMIF,
      eventDate: {
        gte: startDate,
        lte: endDate,
      },
    } as any;

    const include = {
      locality: { select: { id: true, code: true, name: true } },
      activityType: { select: { id: true, name: true } },
      report: {
        select: {
          id: true,
          date: true,
          location: true,
          responsible: true,
          activitiesPerformed: true,
          mainPointsObserved: true,
          nextSteps: true,
          signedAt: true,
        },
      },
    } as const;

    const doneItems = await this.prisma.activity.findMany({
      where: {
        ...baseWhere,
        status: 'DONE',
      },
      include,
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    } as any);

    if (doneItems.length) {
      return doneItems;
    }

    return this.prisma.activity.findMany({
      where: {
        ...baseWhere,
        report: {
          isNot: null,
        },
      },
      include,
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    } as any);
  }

  private summarizeMissionActivities(activities: any[]) {
    return activities.map((activity, index) => {
      const when = activity?.eventDate ? this.formatDate(activity.eventDate) : 'sem data';
      const report = activity?.report;
      const reportNotes = [
        report?.activitiesPerformed
          ? `Execução registrada: ${String(report.activitiesPerformed).trim()}`
          : '',
        report?.mainPointsObserved
          ? `Pontos observados: ${String(report.mainPointsObserved).trim()}`
          : '',
        report?.nextSteps
          ? `Próximos passos: ${String(report.nextSteps).trim()}`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      return [
        `${index + 1}. ${String(activity?.title ?? 'Atividade').trim()}`,
        `Data: ${when}`,
        `Tipo: ${String(activity?.activityType?.name ?? 'Não informado')}`,
        `Localidade: ${String(activity?.locality?.code ?? activity?.locality?.name ?? 'Não informada')}`,
        `Descrição: ${String(activity?.description ?? '').trim() || 'Não informada'}`,
        reportNotes ? `Relatório: ${reportNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });
  }

  private async generateSocialArticleDraft(
    draft: Record<string, any>,
    user?: RbacUser,
  ): Promise<AssistantGeneratedArticleDraft> {
    const mission = await this.resolveSocialArticleMission(draft.missionId, user);
    const activities = await this.listExecutedMissionActivities(mission);
    const references = (
      await this.socialCommunication.listAssistantReferences(
        String(draft.scope ?? mission.scope ?? 'SMIF'),
        5,
      )
    ).items;

    const fallback = this.buildFallbackSocialArticleDraft(
      draft,
      mission,
      activities,
      references,
    );

    try {
      const response = await this.litellm.chatCompletion({
        temperature: 0.35,
        max_tokens: 2200,
        messages: [
          {
            role: 'system',
            content: [
              'Você é um redator institucional do COMAER.',
              'Sua tarefa é redigir uma matéria com linguagem clara, formal e objetiva.',
              'Use as matérias de referência apenas para absorver tom, estrutura e vocabulário. Nunca copie fatos, números ou nomes que não estejam no contexto factual fornecido.',
              'Não invente atividades, públicos, locais, resultados ou autoridades.',
              'Responda apenas em JSON válido.',
            ].join(' '),
          },
          {
            role: 'user',
            content: this.buildSocialArticleGenerationPrompt(
              draft,
              mission,
              activities,
              references,
            ),
          },
        ],
      });
      const parsed = this.parseSocialArticleDraftResponse(
        response.content,
        draft,
        mission,
        references,
      );
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao gerar matéria via LLM: ${this.extractErrorMessage(error)}`,
      );
    }

    return fallback;
  }

  private async handleSocialArticleRevision(
    session: AssistantSession,
    workflow: AssistantWorkflow,
    instruction: string,
    user?: RbacUser,
  ): Promise<AssistantReply> {
    const currentDraft = this.readGeneratedArticleDraft(workflow.draft);
    if (!currentDraft) {
      throw new BadRequestException(
        'Ainda não há rascunho de matéria para revisar.',
      );
    }

    const mission = await this.resolveSocialArticleMission(
      workflow.draft.missionId,
      user,
    );
    const activities = await this.listExecutedMissionActivities(mission);
    const references = (
      await this.socialCommunication.listAssistantReferences(
        String(workflow.draft.scope ?? mission.scope ?? 'SMIF'),
        5,
      )
    ).items;

    let nextDraft = currentDraft;
    try {
      const response = await this.litellm.chatCompletion({
        temperature: 0.3,
        max_tokens: 2200,
        messages: [
          {
            role: 'system',
            content: [
              'Você está revisando uma matéria institucional já rascunhada.',
              'Ajuste apenas o necessário para atender à instrução do usuário.',
              'Mantenha aderência total aos fatos fornecidos. Não invente fatos novos.',
              'Responda apenas em JSON válido.',
            ].join(' '),
          },
          {
            role: 'user',
            content: this.buildSocialArticleRevisionPrompt(
              instruction,
              workflow.draft,
              mission,
              activities,
              references,
              currentDraft,
            ),
          },
        ],
      });
      const parsed = this.parseSocialArticleDraftResponse(
        response.content,
        workflow.draft,
        mission,
        references,
      );
      if (parsed) {
        nextDraft = parsed;
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao revisar matéria via LLM: ${this.extractErrorMessage(error)}`,
      );
    }

    workflow.draft.generatedArticle = nextDraft;
    workflow.status = 'confirming';
    const updatedView = await this.buildWorkflowView(workflow, user);
    return this.buildReply(
      session,
      this.pushMessage(
        session,
        'assistant',
        this.buildSocialArticleDraftMessage(workflow.draft),
      ),
      updatedView,
      null,
    );
  }

  private buildSocialArticleGenerationPrompt(
    draft: Record<string, any>,
    mission: any,
    activities: any[],
    references: any[],
  ) {
    const missionPeriod =
      mission?.startDate && mission?.endDate
        ? `${this.formatDate(mission.startDate)} a ${this.formatDate(mission.endDate)}`
        : 'período não informado';
    const referenceLines = references.length
      ? references
          .map(
            (item: any, index: number) =>
              `${index + 1}. ${String(item.title).trim()} (${item.publishedAt ? this.formatDate(item.publishedAt) : 'sem data'})\nTexto-base:\n${String(item.referenceText ?? '').trim()}`,
          )
          .join('\n\n')
      : 'Nenhuma matéria de referência encontrada para este escopo.';

    const activityLines = activities.length
      ? this.summarizeMissionActivities(activities).join('\n\n')
      : 'Nenhuma atividade executada encontrada no período/localidade da missão.';

    return [
      'Gere uma matéria institucional a partir do contexto abaixo.',
      '',
      `Escopo: ${String(draft.scope ?? mission.scope ?? 'SMIF')}`,
      `Público: ${draft.audience === 'EXTERNAL' ? 'EXTERNO' : 'INTERNO'}`,
      `Foco principal pedido pelo usuário: ${String(draft.articleAngle ?? '').trim() || 'não informado'}`,
      '',
      'Fatos da missão:',
      `- Título: ${String(mission?.title ?? '').trim()}`,
      `- Descrição: ${String(mission?.description ?? '').trim() || 'não informada'}`,
      `- Localidade: ${String(mission?.locality?.code ?? '').trim()} - ${String(mission?.locality?.name ?? '').trim()}`,
      `- Período: ${missionPeriod}`,
      `- Participantes cadastrados na missão: ${Array.isArray(mission?.participants) ? mission.participants.length : 0}`,
      '',
      'Atividades executadas relacionadas à missão:',
      activityLines,
      '',
      'Matérias de referência do mesmo escopo:',
      referenceLines,
      '',
      'Regras obrigatórias:',
      '- Use apenas os fatos informados acima.',
      '- Não invente números, autoridades, resultados, públicos ou locais.',
      '- Se alguma informação não estiver no contexto, omita.',
      '- Use as matérias de referência só para tom e estrutura.',
      '- Gere uma matéria pronta para revisão humana.',
      '',
      'Responda APENAS em JSON com este formato:',
      '{',
      '  "title": "titulo da materia",',
      '  "summary": "resumo curto com 2 ou 3 frases",',
      '  "contentText": "texto completo da materia em markdown simples ou texto corrido",',
      '  "tags": ["tag1", "tag2"],',
      '  "referencesUsed": ["id-da-referencia-1", "id-da-referencia-2"]',
      '}',
    ].join('\n');
  }

  private buildSocialArticleRevisionPrompt(
    instruction: string,
    draft: Record<string, any>,
    mission: any,
    activities: any[],
    references: any[],
    currentDraft: AssistantGeneratedArticleDraft,
  ) {
    return [
      'Revise a matéria abaixo conforme a instrução do usuário.',
      `Instrução: ${instruction}`,
      '',
      'Rascunho atual:',
      JSON.stringify(currentDraft, null, 2),
      '',
      'Fatos da missão:',
      this.buildSocialArticleGenerationPrompt(draft, mission, activities, references),
      '',
      'Regras:',
      '- Ajuste apenas o necessário para atender à instrução.',
      '- Mantenha aderência total aos fatos disponíveis.',
      '- Não invente informações novas.',
      '- Preserve tags úteis e atualize-as se fizer sentido.',
      '',
      'Responda APENAS em JSON com o mesmo formato do rascunho atual.',
    ].join('\n');
  }

  private parseSocialArticleDraftResponse(
    rawContent: string,
    draft: Record<string, any>,
    mission: any,
    references: any[],
  ): AssistantGeneratedArticleDraft | null {
    const safe = String(rawContent ?? '').trim();
    if (!safe) return null;
    const jsonMatch =
      safe.match(/```json\s*([\s\S]*?)```/i)?.[1] ??
      safe.match(/(\{[\s\S]*\})/)?.[1] ??
      safe;
    try {
      const parsed = JSON.parse(jsonMatch);
      const title = String(parsed?.title ?? '').trim();
      const summary = String(parsed?.summary ?? '').trim();
      const contentText = String(parsed?.contentText ?? '').trim();
      if (!title || !summary || !contentText) {
        return null;
      }
      const normalizedTags = this.normalizeGeneratedArticleTags(
        Array.isArray(parsed?.tags) ? parsed.tags : [],
        String(draft.scope ?? mission?.scope ?? 'SMIF'),
        mission,
      );
      const referencesUsed = Array.isArray(parsed?.referencesUsed)
        ? references.filter((item: any) =>
            parsed.referencesUsed.includes(item.id),
          )
        : [];
      return {
        title,
        summary,
        contentText,
        tags: normalizedTags,
        audience: draft.audience === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
        referencesUsed: referencesUsed.map((item: any) => ({
          id: String(item.id),
          title: String(item.title),
          publishedAt: item.publishedAt ? String(item.publishedAt) : null,
          sourceUrl: String(item.sourceUrl ?? ''),
        })),
      };
    } catch {
      return null;
    }
  }

  private buildFallbackSocialArticleDraft(
    draft: Record<string, any>,
    mission: any,
    activities: any[],
    references: any[],
  ): AssistantGeneratedArticleDraft {
    const localityLabel = [
      String(mission?.locality?.code ?? '').trim(),
      String(mission?.locality?.name ?? '').trim(),
    ]
      .filter(Boolean)
      .join(' - ');
    const firstParagraph = [
      `A ${String(draft.scope ?? mission?.scope ?? 'SMIF')} realizou a missão **${String(mission?.title ?? '').trim()}** em ${localityLabel || 'localidade não informada'}, no período de ${this.formatDate(mission?.startDate)} a ${this.formatDate(mission?.endDate)}.`,
      activities.length
        ? `Durante a agenda, foram executadas ${activities.length} atividade(s) de campo relacionadas ao escopo da missão, com foco em prevenção, orientação institucional e apoio às organizações atendidas.`
        : 'A agenda registrada destaca a atuação institucional da comissão no período, com ênfase em prevenção e orientação.',
    ].join(' ');

    const activityParagraphs = activities.slice(0, 8).map((activity: any) => {
      const report = activity?.report;
      const details = [
        String(activity?.title ?? '').trim(),
        String(activity?.description ?? '').trim(),
        String(report?.activitiesPerformed ?? '').trim(),
      ]
        .filter(Boolean)
        .join(' ');
      return `- ${details || 'Atividade registrada na missão.'}`;
    });

    const contentParts = [
      firstParagraph,
      draft.articleAngle
        ? `O enfoque desta matéria é ${String(draft.articleAngle).trim()}.`
        : '',
      activityParagraphs.length
        ? ['Entre as ações executadas, destacam-se:', ...activityParagraphs].join('\n')
        : '',
      'A iniciativa reforça o acompanhamento institucional e a atuação coordenada da comissão no escopo da missão.',
    ].filter(Boolean);

    return {
      title: `Missão ${String(draft.scope ?? mission?.scope ?? 'SMIF')} em ${String(mission?.locality?.name ?? 'localidade atendida').trim()} destaca ações institucionais`,
      summary: firstParagraph,
      contentText: contentParts.join('\n\n'),
      tags: this.normalizeGeneratedArticleTags([], String(draft.scope ?? mission?.scope ?? 'SMIF'), mission),
      audience: draft.audience === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      referencesUsed: references.slice(0, 2).map((item: any) => ({
        id: String(item.id),
        title: String(item.title),
        publishedAt: item.publishedAt ? String(item.publishedAt) : null,
        sourceUrl: String(item.sourceUrl ?? ''),
      })),
    };
  }

  private normalizeGeneratedArticleTags(
    rawTags: unknown[],
    scopeRaw: string,
    mission: any,
  ) {
    const seen = new Set<string>();
    const normalized: string[] = [];
    const add = (value: unknown) => {
      const clean = String(value ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase();
      const slug = clean.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      normalized.push(slug);
    };

    rawTags.forEach(add);
    add(scopeRaw);
    add('missao');
    add(mission?.locality?.code);
    add(mission?.locality?.name);
    return normalized.slice(0, 12);
  }

  private buildSocialArticleDraftMessage(draft: Record<string, any>) {
    const generatedDraft = this.readGeneratedArticleDraft(draft);
    if (!generatedDraft) {
      return 'Ainda não consegui montar um rascunho válido da matéria.';
    }
    const referenceList = generatedDraft.referencesUsed.length
      ? generatedDraft.referencesUsed
          .map((item, index) => {
            const dateLabel = item.publishedAt
              ? this.formatDate(item.publishedAt)
              : 'sem data';
            return `${index + 1}. ${item.title} (${dateLabel})`;
          })
          .join('\n')
      : 'Nenhuma matéria de referência precisou ser citada explicitamente.';
    return [
      'Rascunho de **criar matéria a partir de missão** pronto para conferência.',
      `**Título sugerido:** ${generatedDraft.title}`,
      `**Resumo:** ${generatedDraft.summary}`,
      `**Tags:** ${generatedDraft.tags.map((item) => `#${item}`).join(' ') || '—'}`,
      '### Texto sugerido',
      generatedDraft.contentText,
      '### Referências de estilo consideradas',
      referenceList,
      'Se quiser ajustar o texto, responda no chat com a mudança desejada. Se estiver tudo certo, confirme a criação.',
    ].join('\n\n');
  }

  private buildGeneratedArticleSourceUrl(missionId: string) {
    return `https://cipavd.ccabr.intraer/social-communication/generated/${encodeURIComponent(
      String(missionId ?? '').trim() || 'mission',
    )}`;
  }

  private buildScheduleEditValueField(
    fieldKey: string,
    itemNumber: number,
    field = 'scheduleEditValue',
  ): AssistantFieldConfig {
    switch (fieldKey) {
      case 'startAt':
        return {
          field,
          label: `Novo início do item ${itemNumber}`,
          inputType: 'datetime',
          helperText: 'Use DD/MM/AAAA HH:MM ou o seletor de data e hora.',
        };
      case 'durationMinutes':
        return {
          field,
          label: `Nova duração do item ${itemNumber}`,
          inputType: 'number',
          min: 1,
          max: 1440,
        };
      case 'location':
        return {
          field,
          label: `Novo local do item ${itemNumber}`,
          inputType: 'text',
        };
      case 'responsible':
        return {
          field,
          label: `Novo responsável do item ${itemNumber}`,
          inputType: 'text',
        };
      case 'participants':
        return {
          field,
          label: `Novos participantes do item ${itemNumber}`,
          inputType: 'textarea',
          optional: true,
          helperText: 'Campo opcional.',
        };
      default:
        return {
          field,
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
    const savedCount = this.getScheduleSavedCount(workflow.draft);

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
      const itemIndex = itemNumber - savedCount - 1;
      if (
        !Number.isInteger(itemNumber) ||
        itemNumber <= savedCount ||
        itemIndex < 0 ||
        itemIndex >= items.length
      ) {
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
      const [removed] = items.splice(itemIndex, 1);
      workflow.draft.scheduleItemsDraft = items;
      workflow.draft.scheduleTotalItems = Math.max(
        savedCount,
        this.getScheduleTotalItems(workflow.draft) - 1,
      );
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
      const itemIndex = itemNumber - savedCount - 1;
      if (
        !Number.isInteger(itemNumber) ||
        itemNumber <= savedCount ||
        itemIndex < 0 ||
        itemIndex >= items.length
      ) {
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
      workflow.draft.scheduleEditIndex = itemIndex;
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
            ? this.buildSchedulePreviewMessage(items, savedCount)
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
      const heuristicDrafts =
        extraction.method === 'text'
          ? this.parseStructuredScheduleDraftsFromText(
              extraction.text,
              missionContext.fallbackLocation,
            )
          : this.parseOcrScheduleDraftsFromText(
              extraction.text,
              missionContext.fallbackLocation,
            );
      const itemDrafts = await this.refineScheduleDraftsWithLlm(
        {
          fileName: file.originalname || 'arquivo.pdf',
          extractionMethod: extraction.method,
          extractedText: extraction.text,
          heuristicDrafts,
          missionContext,
        },
        user,
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

    const deduplicatedItems = this.deduplicateScheduleDraftItems(parsedItems)
      .sort((left, right) => left.startAt.localeCompare(right.startAt));
    return {
      files: parsedFiles,
      items: deduplicatedItems,
    };
  }

  private async resolveMissionContext(missionId: string, user?: RbacUser) {
    if (!missionId) {
      throw new BadRequestException(
        'Selecione a missão antes de enviar o cronograma.',
      );
    }
    const mission = (await this.missions.getById(missionId, user)) as any;
    const localityName = String(mission?.locality?.name ?? '').trim();
    const localityCode = String(mission?.locality?.code ?? '').trim();
    return {
      missionTitle: String(mission?.title ?? '').trim(),
      missionScope: String(mission?.scope ?? 'SMIF').trim(),
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

  private async refineScheduleDraftsWithLlm(
    params: {
      fileName: string;
      extractionMethod: 'text' | 'ocr';
      extractedText: string;
      heuristicDrafts: Array<
        Omit<
          AssistantScheduleDraftItem,
          'id' | 'sourceFileIds' | 'sourceFileNames'
        >
      >;
      missionContext: {
        missionTitle?: string;
        missionScope?: string;
        fallbackLocation?: string;
      };
    },
    _user?: RbacUser,
  ): Promise<
    Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >
  > {
    const fallbackItems = params.heuristicDrafts;
    if (!this.litellm.isConfigured()) {
      return fallbackItems;
    }
    const pages = this.buildScheduleLlmPages(
      params.extractedText,
      params.extractionMethod,
    );
    if (!pages.length) {
      return fallbackItems;
    }

    const refinedItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    > = [];

    for (const page of pages) {
      const pageFallbackItems = fallbackItems.filter((item) =>
        String(item.startAt ?? '').startsWith(`${page.isoDate}T`),
      );
      const refinedPageItems = await this.extractSchedulePageItemsWithLlm({
        fileName: params.fileName,
        extractionMethod: params.extractionMethod,
        missionTitle: params.missionContext.missionTitle || '-',
        missionScope: params.missionContext.missionScope || '-',
        page,
        fallbackItems: pageFallbackItems,
      });
      const selectedPageItems = this.selectSchedulePageItems({
        extractionMethod: params.extractionMethod,
        refinedItems: refinedPageItems,
        fallbackItems: pageFallbackItems,
      });
      refinedItems.push(
        ...this.reconcileSelectedScheduleItemsWithFallback(
          selectedPageItems,
          pageFallbackItems,
        ),
      );
    }

    const deduplicated = this.deduplicateScheduleDraftItems(
      refinedItems.map((item) => ({
        ...item,
        id: randomUUID(),
        sourceFileIds: [],
        sourceFileNames: [],
      })),
    ).map(({ id, sourceFileIds, sourceFileNames, ...item }) => item);

    if (!deduplicated.length) {
      this.logger.warn(
        `Falha ao refinar cronograma via LLM (${params.fileName}); mantendo parser local. Motivo: SCHEDULE_LLM_EMPTY_RESULT`,
      );
      return fallbackItems;
    }
    return deduplicated;
  }

  private selectSchedulePageItems(params: {
    extractionMethod: 'text' | 'ocr';
    refinedItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >;
    fallbackItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >;
  }) {
    if (!params.refinedItems.length) {
      return params.fallbackItems;
    }
    if (params.extractionMethod !== 'ocr') {
      return params.refinedItems;
    }
    const refinedScore = this.scoreScheduleDraftItems(params.refinedItems);
    const fallbackScore = this.scoreScheduleDraftItems(params.fallbackItems);
    if (
      params.refinedItems.length < Math.max(1, params.fallbackItems.length - 1) ||
      refinedScore < fallbackScore
    ) {
      return params.fallbackItems;
    }
    return params.refinedItems;
  }

  private scoreScheduleDraftItems(
    items: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
  ) {
    let score = 0;
    for (const item of items) {
      const normalizedTitle = this.normalizeFreeText(item.title);
      if (
        normalizedTitle &&
        normalizedTitle !== 'atividade a confirmar' &&
        !/^[0-9-]+$/.test(normalizedTitle)
      ) {
        score += 3;
      } else {
        score -= 3;
      }
      if (String(item.location ?? '').trim() && !this.isAmbiguousScheduleLocation(item.location)) {
        score += 1;
      }
      if (String(item.responsible ?? '').trim()) {
        score += 1;
      }
      if (String(item.participants ?? '').trim()) {
        score += 1;
      }
    }
    return score;
  }

  private reconcileSelectedScheduleItemsWithFallback(
    items: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
    fallbackItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
  ) {
    const reconciled = items.map((item, index) => {
      const fallback =
        this.findBestScheduleFallbackForItem(item, fallbackItems) ??
        fallbackItems[index] ??
        null;
      const title = this.reconcileScheduleTitleWithFallback(
        item.title,
        fallback?.title ?? '',
      );
      let location = this.normalizeScheduleLocationText(item.location);
      const fallbackLocation = this.normalizeScheduleLocationText(
        fallback?.location ?? '',
      );
      if (
        (!location || this.isAmbiguousScheduleLocation(location)) &&
        fallbackLocation &&
        !this.isAmbiguousScheduleLocation(fallbackLocation)
      ) {
        location = fallbackLocation;
      }
      let responsible = this.cleanScheduleLine(item.responsible);
      const fallbackResponsible = this.cleanScheduleLine(
        fallback?.responsible ?? '',
      );
      if (
        responsible === 'Equipe de Campo' &&
        fallbackResponsible &&
        !/^(?:[ivxlcdm]+\s+)?(?:encontro de comiss[oõ]es|reuni[aã]o com as cpcas|visita [àa]s instala[cç][õo]es|acompanhamento e observa[cç][ãa]o)/i.test(
          this.normalizeFreeText(title),
        )
      ) {
        responsible = fallbackResponsible;
      } else if (
        (!responsible || this.isAmbiguousScheduleResponsible(responsible)) &&
        fallbackResponsible &&
        !this.isAmbiguousScheduleResponsible(fallbackResponsible)
      ) {
        responsible = fallbackResponsible;
      }
      let participants = this.cleanScheduleLine(item.participants);
      const fallbackParticipants = this.cleanScheduleLine(
        fallback?.participants ?? '',
      );
      if (
        (!participants || this.isAmbiguousScheduleParticipants(participants)) &&
        fallbackParticipants &&
        !this.isAmbiguousScheduleParticipants(fallbackParticipants)
      ) {
        participants = fallbackParticipants;
      }
      return this.sanitizeScheduleDraftItem({
        ...item,
        title,
        location: this.defaultScheduleLocationForTitle(title, location),
        responsible,
        participants,
      });
    });
    const existingKeys = new Set(
      reconciled.map(
        (item) =>
          `${item.startAt}|${this.normalizeFreeText(String(item.title ?? ''))}`,
      ),
    );
    for (const fallback of fallbackItems) {
      const fallbackKey = `${fallback.startAt}|${this.normalizeFreeText(String(fallback.title ?? ''))}`;
      const duplicatesExistingTime = reconciled.some((item) =>
        this.isScheduleSameTimeDuplicateCandidate(item, fallback),
      );
      if (!existingKeys.has(fallbackKey) && !duplicatesExistingTime) {
        reconciled.push(
          this.sanitizeScheduleDraftItem({
          ...fallback,
          title: this.reconcileScheduleTitleWithFallback(
            fallback.title,
            fallback.title,
          ),
          location: this.defaultScheduleLocationForTitle(
            fallback.title,
            this.normalizeScheduleLocationText(fallback.location),
          ),
          }),
        );
      }
    }
    const rebalanced = this.rebalanceScheduleAdjacentFields(
      reconciled.sort((left, right) => left.startAt.localeCompare(right.startAt)),
      fallbackItems,
    );
    return rebalanced.sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  private findBestScheduleFallbackForItem(
    item: Omit<
      AssistantScheduleDraftItem,
      'id' | 'sourceFileIds' | 'sourceFileNames'
    >,
    fallbackItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
  ) {
    const sameStart = fallbackItems.filter(
      (fallback) => fallback.startAt === item.startAt,
    );
    if (!sameStart.length) {
      return null;
    }
    const itemTitle = this.normalizeFreeText(item.title);
    let best: (typeof fallbackItems)[number] | null = null;
    let bestScore = -1;
    for (const candidate of sameStart) {
      const candidateTitle = this.normalizeFreeText(candidate.title);
      let score = 0;
      if (candidateTitle === itemTitle) score += 5;
      if (candidateTitle.includes(itemTitle) || itemTitle.includes(candidateTitle)) {
        score += 3;
      }
      if (
        candidateTitle.startsWith(itemTitle) ||
        itemTitle.startsWith(candidateTitle)
      ) {
        score += 2;
      }
      if (String(candidate.location ?? '').trim()) score += 1;
      if (String(candidate.responsible ?? '').trim()) score += 1;
      if (String(candidate.participants ?? '').trim()) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  private sanitizeScheduleDraftItem(
    item: Omit<
      AssistantScheduleDraftItem,
      'id' | 'sourceFileIds' | 'sourceFileNames'
    >,
  ) {
    let title = this.cleanScheduleLine(item.title);
    let normalizedTitle = this.normalizeFreeText(title);
    let location = this.normalizeScheduleLocationText(item.location);
    let responsible = this.cleanScheduleLine(item.responsible);
    let participants = this.cleanScheduleLine(item.participants);

    const extractedParticipantsFromLocation =
      this.extractScheduleParticipantsFromMixedLocation(location);
    if (
      extractedParticipantsFromLocation &&
      (!participants || participants === '-')
    ) {
      participants = extractedParticipantsFromLocation.participants;
      location = extractedParticipantsFromLocation.location;
    }

    const titleAndLocation = this.reconcileScheduleTitleAndLocationFragments(
      normalizedTitle,
      title,
      location,
    );
    title = titleAndLocation.title;
    normalizedTitle = this.normalizeFreeText(title);
    location = titleAndLocation.location;

    if (normalizedTitle.startsWith('chegada da equipe')) {
      location = '-';
      participants = '-';
      responsible = 'Equipe de Campo';
    } else if (
      normalizedTitle === 'intervalo' ||
      normalizedTitle === 'encerramento das atividades'
    ) {
      location = '-';
      responsible = '-';
      participants = '-';
    }

    const normalizedFields = this.normalizeScheduleResponsibleAndParticipants(
      normalizedTitle,
      responsible,
      participants,
    );
    responsible = normalizedFields.responsible;
    participants = normalizedFields.participants;

    return {
      ...item,
      title,
      location: this.defaultScheduleLocationForTitle(title, location),
      responsible,
      participants,
    };
  }

  private extractScheduleParticipantsFromMixedLocation(location: string) {
    const safe = this.normalizeScheduleLocationText(location);
    if (!safe) return null;
    const patterns = [
      /^(Audit[oó]rio)\s+(Todo efetivo escalado)\s+(da\s+[A-Z0-9-]+)$/i,
      /^(Audit[oó]rio)\s+(Efetivo feminino)\s+(da\s+[A-Z0-9-]+)$/i,
      /^(Audit[oó]rio)\s+(Recrutas.*|Instrutores.*|Equipe.*)\s+(da\s+[A-Z0-9-]+)$/i,
      /^(Centro de Convenções do GAP-CO)\s+(Todo efetivo escalado|Efetivo feminino)$/i,
      /^(Todo efetivo escalado|Efetivo feminino|Recrutas.*|Instrutores.*)\s+(Audit[oó]rio(?:\s+(?:da|do))?\s+.+)$/i,
    ];
    for (const pattern of patterns) {
      const match = safe.match(pattern);
      if (!match) continue;
      if (match.length === 4) {
        return {
          location: `${match[1]} ${match[3]}`.replace(/\s+/g, ' ').trim(),
          participants: match[2].replace(/\s+/g, ' ').trim(),
        };
      }
      if (match.length === 3) {
        return {
          location: match[1].replace(/\s+/g, ' ').trim(),
          participants: match[2].replace(/\s+/g, ' ').trim(),
        };
      }
    }
    return null;
  }

  private isScheduleSameTimeDuplicateCandidate(
    existing: Omit<
      AssistantScheduleDraftItem,
      'id' | 'sourceFileIds' | 'sourceFileNames'
    >,
    candidate: Omit<
      AssistantScheduleDraftItem,
      'id' | 'sourceFileIds' | 'sourceFileNames'
    >,
  ) {
    if (existing.startAt !== candidate.startAt) return false;
    const existingTitle = this.normalizeFreeText(existing.title);
    const candidateTitle = this.normalizeFreeText(candidate.title);
    if (!existingTitle || !candidateTitle) return false;
    return (
      existingTitle.includes(candidateTitle) ||
      candidateTitle.includes(existingTitle)
    );
  }

  private buildScheduleLlmPages(
    text: string,
    extractionMethod: 'text' | 'ocr',
  ): Array<{
    pageNumber: number;
    headingLine: string;
    isoDate: string;
    displayDate: string;
    rows: Array<{
      rowNumber: number;
      time: string;
      nextTime: string | null;
      rawText: string;
      activityText?: string;
      responsibleText?: string;
      participantsText?: string;
      locationText?: string;
    }>;
  }> {
    const pages = String(text ?? '')
      .split('\f')
      .map((page) => page.replace(/\r/g, '').trim())
      .filter(Boolean);
    const results: Array<{
      pageNumber: number;
      headingLine: string;
      isoDate: string;
      displayDate: string;
      rows: Array<{
        rowNumber: number;
        time: string;
        nextTime: string | null;
        rawText: string;
        activityText?: string;
        responsibleText?: string;
        participantsText?: string;
        locationText?: string;
      }>;
    }> = [];
    let baseExplicitDate: string | null = null;
    let baseExplicitDayIndex: number | null = null;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const headingLine =
        page
          .split('\n')
          .map((line) => this.cleanScheduleLine(line))
          .find((line) => /cronograma/i.test(line)) ?? '';
      let displayDate = page.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] ?? null;
      const dayIndex = Number(page.match(/\bDIA\s+(\d+)/i)?.[1] ?? 0) || null;
      if (displayDate && dayIndex) {
        baseExplicitDate = displayDate;
        baseExplicitDayIndex = dayIndex;
      }
      if (!displayDate && baseExplicitDate && baseExplicitDayIndex && dayIndex) {
        displayDate = this.offsetDateByDays(
          baseExplicitDate,
          dayIndex - baseExplicitDayIndex,
        );
      }
      if (!displayDate) continue;
      const isoDate = this.convertScheduleDisplayDateToIso(displayDate);
      if (!isoDate) continue;

      const rawRows: Array<{
        time: string;
        nextTimeHint?: string | null;
        rawText: string;
        activityText?: string;
        responsibleText?: string;
        participantsText?: string;
        locationText?: string;
      }> =
        extractionMethod === 'text'
          ? this.extractStructuredScheduleRowsForLlm(page).map((row) => ({
              time: row.time,
              nextTimeHint: row.nextTimeHint ?? null,
              rawText: [
                row.activityText ? `Atividade: ${row.activityText}` : '',
                row.responsibleText
                  ? `Participantes CIPAVD: ${row.responsibleText}`
                  : '',
                row.participantsText
                  ? `Participantes: ${row.participantsText}`
                  : '',
                row.locationText ? `Local Sugerido: ${row.locationText}` : '',
              ]
                .filter(Boolean)
                .join(' | '),
              activityText: row.activityText,
              responsibleText: row.responsibleText,
              participantsText: row.participantsText,
              locationText: row.locationText,
            }))
          : this.extractOcrScheduleRows(page).map((row) => ({
              time: row.time,
              rawText: [...row.prefixLines, row.mainLine, ...row.suffixLines]
                .map((line) => this.cleanScheduleLine(line))
                .filter(Boolean)
                .join(' | '),
            }));

      const rows = rawRows
        .filter((row) => row.rawText.trim().length > 0)
        .map((row, index, all) => ({
          rowNumber: index + 1,
          time: row.time,
          nextTime: row.nextTimeHint ?? all[index + 1]?.time ?? null,
          rawText: row.rawText,
          activityText: row.activityText,
          responsibleText: row.responsibleText,
          participantsText: row.participantsText,
          locationText: row.locationText,
        }));
      if (!rows.length) continue;

      results.push({
        pageNumber: pageIndex + 1,
        headingLine,
        isoDate,
        displayDate,
        rows,
      });
    }

    return results;
  }

  private async extractSchedulePageItemsWithLlm(params: {
    fileName: string;
    extractionMethod: 'text' | 'ocr';
    missionTitle: string;
    missionScope: string;
    page: {
      pageNumber: number;
      headingLine: string;
      isoDate: string;
      displayDate: string;
      rows: Array<{
        rowNumber: number;
        time: string;
        nextTime: string | null;
        rawText: string;
        activityText?: string;
        responsibleText?: string;
        participantsText?: string;
        locationText?: string;
      }>;
    };
    fallbackItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >;
  }) {
    const systemPrompt =
      'Você extrai linhas de cronograma CIPAVD/SMIF. ' +
      'Responda somente com um objeto JSON válido, sem qualquer texto antes ou depois. ' +
      'Nunca invente local, responsável ou participantes. ' +
      'Se não houver evidência suficiente, retorne string vazia. ' +
      'Use "-" apenas quando o campo não se aplica de forma clara.';

    const userPrompt = [
      'Normalize os itens da página do cronograma abaixo.',
      'Cada row já representa uma linha do cronograma com horário separado.',
      'Use a data desta página em todos os itens.',
      'Regras:',
      '- title deve ser o nome da atividade.',
      '- startAt = data da página + row.time em formato YYYY-MM-DDTHH:mm:00.',
      '- durationMinutes = diferença para o nextTime da mesma página; se não houver nextTime e o item estiver claro, use 60.',
      '- responsible = coluna Participantes CIPAVD.',
      '- participants = coluna Participantes.',
      '- location = coluna Local Sugerido.',
      '- Não use a localidade da missão como local do item.',
      '- Se uma row estiver corrompida demais, não a inclua.',
      '- Se houver dúvida real sobre local/responsável/participantes, retorne string vazia.',
      '- Títulos canônicos aceitos quando fizer sentido: Chegada da Equipe..., Palestra de Conscientização e Prevenção ao Assédio, Intervalo, Palestra sobre Violência Doméstica, Aplicação de pesquisa, Reunião com as CPCAs, Encontro de Comissões (CPCA), Ciclo de Boas Práticas, Encerramento das atividades.',
      '- Quando activityText/responsibleText/participantsText/locationText vierem preenchidos, trate esses campos como a melhor separação de colunas já identificada no documento.',
      'Formato obrigatório:',
      '{"items":[{"rowNumber":1,"title":"","startAt":"YYYY-MM-DDTHH:mm:00","durationMinutes":60,"location":"","responsible":"","participants":"","confidence":0.0,"notes":[]}]}',
      '',
      `Arquivo: ${params.fileName}`,
      `Método: ${params.extractionMethod === 'text' ? 'texto estruturado' : 'OCR'}`,
      `Missão: ${params.missionTitle}`,
      `Escopo: ${params.missionScope}`,
      `Página: ${params.page.pageNumber}`,
      `Cabeçalho: ${params.page.headingLine || '-'}`,
      `Data da página: ${params.page.displayDate}`,
      '',
      'Candidatos heurísticos da mesma data:',
      JSON.stringify(
        params.fallbackItems.map((item, index) => ({
          index: index + 1,
          title: item.title,
          startAt: item.startAt,
          durationMinutes: item.durationMinutes,
          location: item.location,
          responsible: item.responsible,
          participants: item.participants,
        })),
        null,
        2,
      ),
      '',
      'Rows da página:',
      JSON.stringify(params.page.rows, null, 2),
    ].join('\n');

    try {
      const { content } = await this.litellm.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 1800,
      });

      const cleaned = stripReasoningPrefix(String(content ?? '').trim()).trim();
      if (!cleaned || looksLikeInternalReasoning(cleaned)) {
        throw new Error('SCHEDULE_LLM_PAGE_REASONING_OUTPUT');
      }

      const parsed = this.parseJsonLoose(cleaned);
      return this.normalizeLlmScheduleDraftItems(parsed, params.fallbackItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao extrair página ${params.page.pageNumber} do cronograma via LLM (${params.fileName}). Motivo: ${message}`,
      );
      return [];
    }
  }

  private convertScheduleDisplayDateToIso(displayDate: string) {
    const match = String(displayDate ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  private extractStructuredScheduleRowsForLlm(page: string) {
    const lines = String(page ?? '').split('\n');
    const headerLineIndex = lines.findIndex(
      (line) =>
        line.includes('Horário') &&
        line.includes('Atividade') &&
        line.includes('Local Sugerido'),
    );
    const headerLine = headerLineIndex >= 0 ? lines[headerLineIndex] : null;
    if (!headerLine) return [];

    const rawActivityStart = headerLine.indexOf('Atividade');
    const rawCipavdStart = headerLine.indexOf('Participantes CIPAVD');
    const rawParticipantsStart = headerLine.indexOf(
      'Participantes',
      rawCipavdStart + 'Participantes CIPAVD'.length,
    );
    const rawLocationStart = headerLine.indexOf('Local Sugerido');
    if (
      rawActivityStart < 0 ||
      rawCipavdStart < 0 ||
      rawParticipantsStart < 0 ||
      rawLocationStart < 0
    ) {
      return [];
    }

    const activityStart = Math.max(0, rawActivityStart - 15);
    const cipavdStart = rawCipavdStart;
    const participantsStart = rawParticipantsStart;
    const locationStart = rawLocationStart;

    const rows: Array<{
      time: string;
      nextTimeHint?: string | null;
      awaitingEndTime?: boolean;
      activity: string[];
      responsible: string[];
      participants: string[];
      location: string[];
    }> = [];
    let activeRow:
      | {
          time: string;
          nextTimeHint?: string | null;
          awaitingEndTime?: boolean;
          activity: string[];
          responsible: string[];
          participants: string[];
          location: string[];
        }
      | null = null;
    let pendingPrelude: {
      activity: string[];
      responsible: string[];
      participants: string[];
      location: string[];
    } = {
      activity: [],
      responsible: [],
      participants: [],
      location: [],
    };

    const appendChunk = (
      target: {
        activity: string[];
        responsible: string[];
        participants: string[];
        location: string[];
      },
      field: 'activity' | 'responsible' | 'participants' | 'location',
      value: string,
    ) => {
      const safe = this.cleanScheduleLine(value);
      if (!safe) return;
      if (
        (field === 'responsible' || field === 'participants') &&
        safe === '-'
      ) {
        target[field].push('-');
        return;
      }
      if (field === 'location' && safe === '-') {
        target.location.push('-');
        return;
      }
      target[field].push(safe);
    };

    const flushActiveRow = () => {
      if (!activeRow) return;
      rows.push(activeRow);
      activeRow = null;
    };

    const flushPendingPreludeToActive = () => {
      if (!activeRow) return;
      activeRow.activity.push(...pendingPrelude.activity);
      activeRow.responsible.push(...pendingPrelude.responsible);
      activeRow.participants.push(...pendingPrelude.participants);
      activeRow.location.push(...pendingPrelude.location);
      pendingPrelude = {
        activity: [],
        responsible: [],
        participants: [],
        location: [],
      };
    };

    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index] ?? '';
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      if (
        index <= headerLineIndex ||
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
          pendingPrelude = {
            activity: [],
            responsible: [],
            participants: [],
            location: [],
          };
        }
        continue;
      }

      const timeInfo = this.extractStructuredScheduleTimeInfo(rawLine);
      const chunks = this.extractStructuredScheduleLineChunks(
        timeInfo?.lineWithoutDateAndTime ?? rawLine,
      );
      const nextNonEmpty = lines
        .slice(index + 1)
        .map((line) => line.trim())
        .find(Boolean);
      const nextTimeInfo = nextNonEmpty
        ? this.extractStructuredScheduleTimeInfo(nextNonEmpty)
        : null;
      const nextIsTimedRow = !!nextTimeInfo?.startTime;

      if (
        timeInfo?.startTime &&
        activeRow &&
        activeRow.awaitingEndTime &&
        !chunks.length &&
        !timeInfo.explicitEndTime
      ) {
        activeRow.nextTimeHint = timeInfo.startTime;
        activeRow.awaitingEndTime = false;
        continue;
      }

      if (timeInfo?.startTime) {
        flushActiveRow();
        activeRow = {
          time: timeInfo.startTime,
          nextTimeHint: timeInfo.explicitEndTime ?? null,
          awaitingEndTime:
            !timeInfo.explicitEndTime && timeInfo.partialRange ? true : false,
          activity: [],
          responsible: [],
          participants: [],
          location: [],
        };
        flushPendingPreludeToActive();
        for (const chunk of chunks) {
          const field = this.classifyStructuredScheduleChunk(chunk, {
            activityStart,
            cipavdStart,
            participantsStart,
            locationStart,
          });
          if (field) {
            appendChunk(activeRow, field, chunk.text);
          }
        }
        continue;
      }

      if (!activeRow) {
        for (const chunk of chunks) {
          const field = this.classifyStructuredScheduleChunk(chunk, {
            activityStart,
            cipavdStart,
            participantsStart,
            locationStart,
          });
          if (field) {
            appendChunk(pendingPrelude, field, chunk.text);
          }
        }
        continue;
      }

      const currentActivityText = activeRow.activity.join(' ').trim();
      const currentActivityIncomplete = this.isStructuredScheduleActivityIncomplete(
        currentActivityText,
      );
      for (const chunk of chunks) {
        const field = this.classifyStructuredScheduleChunk(chunk, {
          activityStart,
          cipavdStart,
          participantsStart,
          locationStart,
        });
        if (!field) continue;
        if (
          field === 'participants' &&
          activeRow.activity.length > 0 &&
          this.normalizeFreeText(activeRow.activity.join(' ')).startsWith(
            'chegada da equipe',
          ) &&
          activeRow.participants.some((value) => value.trim() === '-')
        ) {
          appendChunk(pendingPrelude, field, chunk.text);
          continue;
        }
        const shouldDeferToNextRow =
          nextIsTimedRow &&
          !activeRow.awaitingEndTime &&
          ((field === 'activity' &&
            activeRow.activity.length > 0 &&
            !currentActivityIncomplete) ||
            (field === 'location' &&
              activeRow.location.length > 0 &&
              !currentActivityIncomplete) ||
            (field === 'participants' && activeRow.participants.length > 0) ||
            (field === 'responsible' &&
              activeRow.responsible.length > 0 &&
              !this.normalizeFreeText(chunk.text).includes('cpcas')));
        if (shouldDeferToNextRow) {
          appendChunk(pendingPrelude, field, chunk.text);
          continue;
        }
        appendChunk(activeRow, field, chunk.text);
      }
    }

    flushActiveRow();

    const normalizedRows = rows.map((row) => ({
      time: row.time,
      nextTimeHint: row.nextTimeHint ?? null,
      activityText: row.activity.join(' ').replace(/\s+/g, ' ').trim(),
      responsibleText: row.responsible.join(' ').replace(/\s+/g, ' ').trim(),
      participantsText: row.participants.join(' ').replace(/\s+/g, ' ').trim(),
      locationText: row.location.join(' ').replace(/\s+/g, ' ').trim(),
    }));

    const mergedRows: typeof normalizedRows = [];
    for (let index = 0; index < normalizedRows.length; index += 1) {
      const row = normalizedRows[index];
      const hasSemanticContent =
        !!row.activityText || !!row.responsibleText || !!row.participantsText;
      if (!hasSemanticContent && row.locationText) {
        const nextRow = normalizedRows[index + 1];
        const previousRow = mergedRows[mergedRows.length - 1];
        if (nextRow && nextRow.time === row.time) {
          nextRow.locationText = [row.locationText, nextRow.locationText]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          continue;
        }
        if (previousRow && previousRow.time === row.time) {
          previousRow.locationText = [previousRow.locationText, row.locationText]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          continue;
        }
      }
      mergedRows.push(row);
    }

    return mergedRows;
  }

  private truncateScheduleExtractionText(text: string, maxChars = 24000) {
    const source = String(text ?? '').trim();
    if (source.length <= maxChars) return source;
    const head = source.slice(0, Math.floor(maxChars * 0.65)).trimEnd();
    const tail = source.slice(-Math.floor(maxChars * 0.3)).trimStart();
    return `${head}\n\n[... texto intermediário omitido para caber no contexto ...]\n\n${tail}`;
  }

  private normalizeLlmScheduleDraftItems(
    parsed: unknown,
    fallbackItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
  ) {
    const sourceList = Array.isArray(parsed)
      ? parsed
      : this.isRecord(parsed) && Array.isArray(parsed.items)
        ? parsed.items
        : [];
    const items: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    > = [];

    for (let index = 0; index < sourceList.length; index += 1) {
      const row = sourceList[index];
      if (!this.isRecord(row)) continue;
      const fallback = fallbackItems[index] ?? null;
      const titleRaw = String(row.title ?? '').trim();
      const llmTitle =
        this.canonicalizeOcrScheduleTitle(titleRaw) ||
        this.normalizeScheduleTitle(titleRaw);
      const title = this.reconcileScheduleTitleWithFallback(
        llmTitle,
        fallback?.title ?? '',
      );
      if (!title) continue;

      const startAt = this.normalizeScheduleStartAtValue(
        row.startAt,
        fallback?.startAt ?? null,
      );
      if (!startAt) continue;

      const durationMinutes = this.normalizeScheduleDurationValue(
        row.durationMinutes,
        fallback?.durationMinutes ?? null,
      );
      if (!durationMinutes) continue;

      const location = this.normalizeScheduleLocationText(
        this.normalizeScheduleOptionalFieldValue(row.location),
      );
      const responsible = this.normalizeScheduleOptionalFieldValue(
        row.responsible,
      );
      const participants = this.normalizeScheduleOptionalFieldValue(
        row.participants,
      );
      const confidence = Number(row.confidence);
      const notes = Array.isArray(row.notes)
        ? row.notes.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];

      if (
        !this.shouldKeepLlmScheduleItem({
          title,
          location,
          responsible,
          participants,
          confidence,
          notes,
        })
      ) {
        continue;
      }

      items.push({
        title,
        startAt,
        durationMinutes,
        location: this.defaultScheduleLocationForTitle(title, location),
        responsible:
          responsible ||
          (this.requiresScheduleResponsibleConfirmation({
            ...(fallback ?? {
              id: '',
              sourceFileIds: [],
              sourceFileNames: [],
            }),
            title,
            startAt,
            durationMinutes,
            location,
            responsible: '',
            participants,
          } as AssistantScheduleDraftItem)
            ? ''
            : this.inferResponsibleFromTitle(title)),
        participants:
          participants ||
          (title.startsWith('Chegada da Equipe') ||
          this.normalizeFreeText(title) === 'intervalo' ||
          this.normalizeFreeText(title) === 'encerramento das atividades'
            ? '-'
            : ''),
      });
    }

    return items.sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  private normalizeScheduleStartAtValue(
    value: unknown,
    fallback: string | null,
  ) {
    const source = String(value ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(source)) {
      return source;
    }
    if (fallback && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(fallback)) {
      return fallback;
    }
    return null;
  }

  private normalizeScheduleDurationValue(
    value: unknown,
    fallback: number | null,
  ) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 5 && numeric <= 240) {
      return Math.round(numeric);
    }
    if (Number.isFinite(Number(fallback)) && Number(fallback) >= 5) {
      return Math.round(Number(fallback));
    }
    return null;
  }

  private normalizeScheduleOptionalFieldValue(value: unknown) {
    const safe = this.cleanScheduleLine(String(value ?? ''));
    if (!safe) return '';
    if (safe === '-' || safe === '—') return '-';
    return safe;
  }

  private normalizeScheduleLocationText(value: string) {
    const safe = this.cleanScheduleLine(String(value ?? ''));
    if (!safe || safe === '-' || safe === '—') return safe;
    const tokens = safe.split(/\s+/).filter(Boolean);
    const dedupedTokens: string[] = [];
    for (const token of tokens) {
      if (
        !dedupedTokens.some(
          (existing) => existing.toLowerCase() === token.toLowerCase(),
        )
      ) {
        dedupedTokens.push(token);
      }
    }
    let normalized = dedupedTokens.join(' ').trim();
    const auditIndex = normalized.search(/\bAudit[oó]rio\b/i);
    if (auditIndex > 0) {
      const auditLabel = normalized.match(/\bAudit[oó]rio\b/i)?.[0] ?? 'Auditório';
      const rest = normalized
        .replace(/\bAudit[oó]rio\b/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      normalized = rest ? `${auditLabel} ${rest}` : auditLabel;
    }
    normalized = normalized.replace(
      /\bAudit[oó]rio\s+([A-Z0-9-]+)\s+do$/i,
      'Auditório do $1',
    );
    normalized = normalized.replace(
      /\bAudit[oó]rio\s+Sala de Instru[cç][aã]o\b/i,
      'Sala de Instrução',
    );
    normalized = normalized.replace(/\s+Centro de$/i, '');
    if (/^Conven[cç][oõ]es do GAP-CO$/i.test(normalized)) {
      normalized = 'Centro de Convenções do GAP-CO';
    }
    return normalized;
  }

  private reconcileScheduleTitleAndLocationFragments(
    normalizedTitle: string,
    title: string,
    location: string,
  ) {
    let safeTitle = this.cleanScheduleLine(title);
    let safeLocation = this.normalizeScheduleLocationText(location);
    if (
      (/^a ser definido pelo gsd$/i.test(normalizedTitle) || !normalizedTitle) &&
      /visita [àa]s instala[cç][õo]es/i.test(safeLocation)
    ) {
      safeTitle = 'Visita às instalações';
      safeLocation = safeLocation
        .replace(/visita [àa]s instala[cç][õo]es/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (/^do smif$/i.test(safeLocation)) {
        safeLocation = 'Locais de atividades do SMIF';
      }
      if (!safeLocation) {
        safeLocation = 'Locais de atividades do SMIF';
      }
    }
    return {
      title: safeTitle,
      location: safeLocation,
    };
  }

  private normalizeScheduleResponsibleAndParticipants(
    normalizedTitle: string,
    responsible: string,
    participants: string,
  ) {
    let safeResponsible = this.cleanScheduleLine(responsible);
    let safeParticipants = this.cleanScheduleLine(participants);
    const teamToken = 'Equipe de Campo';

    if (
      safeResponsible &&
      safeResponsible !== teamToken &&
      safeResponsible.includes(teamToken)
    ) {
      const suffix = this.cleanScheduleLine(
        safeResponsible.replace(teamToken, ''),
      );
      safeResponsible = teamToken;
      safeParticipants = this.mergeScheduleParticipantFragments(
        safeParticipants,
        suffix,
      );
    }

    const firstRoleIndex = this.findScheduleResponsibleRoleIndex(safeResponsible);
    if (firstRoleIndex > 0) {
      const participantPrefix = this.cleanScheduleParticipantFragment(
        safeResponsible.slice(0, firstRoleIndex),
      );
      safeResponsible = this.cleanScheduleLine(
        safeResponsible.slice(firstRoleIndex),
      );
      safeParticipants = this.mergeScheduleParticipantFragments(
        safeParticipants,
        participantPrefix,
      );
    }

    const trailingParticipantIndex =
      this.findScheduleParticipantMarkerIndex(safeResponsible);
    if (trailingParticipantIndex > 0) {
      const participantSuffix = this.cleanScheduleParticipantFragment(
        safeResponsible.slice(trailingParticipantIndex),
      );
      safeResponsible = this.cleanScheduleLine(
        safeResponsible.slice(0, trailingParticipantIndex),
      );
      safeParticipants = this.mergeScheduleParticipantFragments(
        safeParticipants,
        participantSuffix,
      );
    }

    safeParticipants = this.cleanScheduleParticipantFragment(safeParticipants);
    if (normalizedTitle.startsWith('chegada da equipe')) {
      safeParticipants = '-';
      safeResponsible = teamToken;
    }
    if (normalizedTitle === 'intervalo' || normalizedTitle === 'encerramento das atividades') {
      safeParticipants = '-';
      safeResponsible = '-';
    }

    return {
      responsible: safeResponsible || this.inferResponsibleFromTitle(normalizedTitle),
      participants: safeParticipants || '',
    };
  }

  private findScheduleResponsibleRoleIndex(value: string) {
    const safe = String(value ?? '');
    if (!safe) return -1;
    const match = safe.match(
      /\b(?:Equipe de Campo|Cap(?:it[aã]o)?|1T|2T|Ten(?:ente)?|1S|2S|Maj|Cel|Tc|Cb|Sgt)\b/i,
    );
    return match?.index ?? -1;
  }

  private findScheduleParticipantMarkerIndex(value: string) {
    const safe = String(value ?? '');
    if (!safe) return -1;
    const match = safe.match(
      /\b(?:Todo efetivo(?: escalado)?|Efetivo feminino(?: do [A-Z0-9-]+)?|Efetivo da [A-Z0-9-]+|Recrutas(?: \((?:Todos|Todas)\))?(?: e Instrutores(?: do [A-Z0-9-]+)?)?|Instrutores(?: \([^)]+\))?|CPCAs(?: da [A-Z0-9-]+)?|Jur[ií]dicos|Psic[oó]logos|Assistentes Sociais(?: da [A-Z0-9-]+)?|ECE|BE|SLZ|CTRB)\b/i,
    );
    return match?.index ?? -1;
  }

  private cleanScheduleParticipantFragment(value: string) {
    let safe = this.cleanScheduleLine(value);
    if (!safe) return '';
    if (safe === '-') return '-';
    safe = safe
      .replace(/^e\s+/i, '')
      .replace(/\s+e$/i, '')
      .replace(/\s+,/g, ',')
      .trim();
    safe = safe.replace(/^feminino do\s+/i, 'Efetivo feminino do ');
    safe = safe.replace(/^efetivo do\s+/i, 'Efetivo do ');
    safe = safe.replace(/^todo efetivo escalado\s+e\s+/i, 'Todo efetivo escalado e ');
    safe = safe.replace(/^efetivo feminino\s+e\s+efetivo$/i, 'Efetivo feminino');
    safe = safe.replace(/^recrutas e instrutores do\s+/i, 'Recrutas e Instrutores do ');
    safe = safe.replace(/^cpcas da\s+/i, 'CPCAs da ');
    safe = safe.replace(/^assistentes sociais da\s+/i, 'Assistentes Sociais da ');
    safe = safe.replace(/^(?:-\s*)+/, '');
    safe = safe.replace(/\b(da|do|de)\s*([A-Z]{2,}(?:-[A-Z0-9]+)?)\b/g, '$1 $2');
    safe = safe.replace(/\bGUARNAE-\s+([A-Z0-9]+)\b/g, 'GUARNAE-$1');
    safe = safe.replace(
      /^(Recrutas e Instrutores do [A-Z0-9-]+)\s+Recrutas e Instrutores$/i,
      '$1',
    );
    safe = safe.replace(
      /^(Efetivo feminino da [A-Z0-9-]+)\s+Efetivo feminino$/i,
      '$1',
    );
    return safe.trim();
  }

  private mergeScheduleParticipantFragments(
    current: string,
    incoming: string,
  ) {
    const safeCurrent = this.cleanScheduleParticipantFragment(current);
    const safeIncoming = this.cleanScheduleParticipantFragment(incoming);
    if (!safeIncoming) return safeCurrent;
    if (!safeCurrent) return safeIncoming;
    const currentNorm = this.normalizeFreeText(safeCurrent);
    const incomingNorm = this.normalizeFreeText(safeIncoming);
    if (currentNorm === incomingNorm) return safeCurrent;
    if (currentNorm.includes(incomingNorm)) return safeCurrent;
    if (incomingNorm.includes(currentNorm)) return safeIncoming;
    if (/[ -]$/.test(safeCurrent) || /\b(?:da|do|de)-?$/i.test(safeCurrent)) {
      return `${safeCurrent}${safeIncoming}`.replace(/\s+/g, ' ').trim();
    }
    if (/[ -]$/.test(safeIncoming) || /\b(?:da|do|de)-?$/i.test(safeIncoming)) {
      return `${safeIncoming}${safeCurrent}`.replace(/\s+/g, ' ').trim();
    }
    if (/^(BE|SLZ|ECE|CTRB)$/i.test(safeCurrent)) {
      return `${safeIncoming} ${safeCurrent}`.replace(/\s+/g, ' ').trim();
    }
    if (/^(BE|SLZ|ECE|CTRB)$/i.test(safeIncoming)) {
      return `${safeCurrent} ${safeIncoming}`.replace(/\s+/g, ' ').trim();
    }
    if (
      /^Efetivo feminino$/i.test(safeIncoming) &&
      /^Efetivo feminino do /i.test(safeCurrent)
    ) {
      return safeCurrent;
    }
    if (
      /^Efetivo feminino$/i.test(safeCurrent) &&
      /^Efetivo feminino do /i.test(safeIncoming)
    ) {
      return safeIncoming;
    }
    return `${safeCurrent} ${safeIncoming}`.replace(/\s+/g, ' ').trim();
  }

  private rebalanceScheduleAdjacentFields(
    items: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
    fallbackItems: Array<
      Omit<
        AssistantScheduleDraftItem,
        'id' | 'sourceFileIds' | 'sourceFileNames'
      >
    >,
  ) {
    const result = items.map((item) => ({ ...item }));
    for (let index = 0; index < fallbackItems.length - 1; index += 1) {
      const sourceFallback = fallbackItems[index];
      const target = result[index + 1];
      if (!sourceFallback || !target) continue;
      const sourceTitle = this.normalizeFreeText(sourceFallback.title);
      const carryFromParticipants = this.extractScheduleCarryoverFragment(
        sourceFallback.participants,
      );
      const carryFromResponsible = this.extractScheduleCarryoverFragment(
        sourceFallback.responsible,
      );
      if (
        sourceTitle !== 'intervalo' &&
        !sourceTitle.startsWith('chegada da equipe') &&
        !this.shouldCarryScheduleFragmentToNextItem(carryFromParticipants) &&
        !this.shouldCarryScheduleFragmentToNextItem(carryFromResponsible)
      ) {
        continue;
      }

      const carryover = this.mergeScheduleParticipantFragments(
        carryFromResponsible,
        carryFromParticipants,
      );
      if (!carryover) continue;
      if (!target.startAt.startsWith(sourceFallback.startAt.slice(0, 10))) {
        continue;
      }
      if (
        this.shouldCarryScheduleFragmentToNextItem(carryover) &&
        /^(?:[A-Z]{2,}(?:-[A-Z0-9]+)?|GSD-[A-Z0-9-]+)$/i.test(
          this.cleanScheduleLine(target.participants),
        )
      ) {
        target.participants = `${carryover} ${this.cleanScheduleLine(
          target.participants,
        )}`
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        target.participants = this.mergeScheduleParticipantFragments(
          target.participants,
          carryover,
        );
      }
      const normalizedFields = this.normalizeScheduleResponsibleAndParticipants(
        this.normalizeFreeText(target.title),
        target.responsible,
        target.participants,
      );
      target.responsible = normalizedFields.responsible;
      target.participants = normalizedFields.participants;
    }
    return result;
  }

  private shouldCarryScheduleFragmentToNextItem(value: string) {
    const normalized = this.normalizeFreeText(value);
    if (!normalized) return false;
    return /\b(?:da|do|de|pelo)$/i.test(normalized);
  }

  private extractScheduleCarryoverFragment(value: string) {
    const safe = this.cleanScheduleLine(value);
    if (!safe || safe === '-' || safe === 'Equipe de Campo') return '';
    if (safe.includes('Equipe de Campo')) {
      return this.cleanScheduleParticipantFragment(
        safe.replace('Equipe de Campo', ''),
      );
    }
    if (
      this.findScheduleResponsibleRoleIndex(safe) === 0 &&
      !this.shouldCarryScheduleFragmentToNextItem(safe)
    ) {
      return '';
    }
    return this.cleanScheduleParticipantFragment(safe);
  }

  private reconcileScheduleTitleWithFallback(
    llmTitle: string,
    fallbackTitle: string,
  ) {
    const safeLlmTitle = String(llmTitle ?? '').trim();
    const safeFallbackTitle = String(fallbackTitle ?? '').trim();
    if (
      safeLlmTitle &&
      safeFallbackTitle &&
      this.normalizeFreeText(safeLlmTitle).startsWith('chegada da equipe') &&
      this.normalizeFreeText(safeFallbackTitle).startsWith('chegada da equipe') &&
      safeFallbackTitle.length > safeLlmTitle.length
    ) {
      return safeFallbackTitle;
    }
    return safeLlmTitle;
  }

  private shouldKeepLlmScheduleItem(input: {
    title: string;
    location: string;
    responsible: string;
    participants: string;
    confidence: number;
    notes: string[];
  }) {
    const normalizedTitle = this.normalizeFreeText(input.title);
    if (!normalizedTitle) return false;
    const suspiciousTitle =
      /(?:[a-z]{4,}\s){2,}[A-Z]{2,}/.test(input.title) ||
      /(?:[qxz]{2,}|[A-Z]{4,}\s+[a-z]{1,2}\s+[A-Z]{3,})/.test(input.title);
    if (suspiciousTitle && (!Number.isFinite(input.confidence) || input.confidence < 0.75)) {
      return false;
    }
    if (
      Array.isArray(input.notes) &&
      input.notes.some((note) =>
        /corrompid|ileg[ií]vel|incerto|baixa confianc/i.test(
          this.normalizeFreeText(note),
        ),
      ) &&
      (!Number.isFinite(input.confidence) || input.confidence < 0.72)
    ) {
      return false;
    }
    return true;
  }

  private parseJsonLoose(raw: string): unknown {
    const source = String(raw ?? '').trim();
    if (!source) return null;

    const tryParse = (input: string): unknown => {
      try {
        return JSON.parse(input) as unknown;
      } catch {
        return null;
      }
    };

    const direct = tryParse(source);
    if (direct !== null) return direct;

    const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      const fenced = tryParse(fencedMatch[1].trim());
      if (fenced !== null) return fenced;
    }

    const firstBrace = source.indexOf('{');
    const lastBrace = source.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const objectLike = tryParse(source.slice(firstBrace, lastBrace + 1));
      if (objectLike !== null) return objectLike;
    }

    const firstBracket = source.indexOf('[');
    const lastBracket = source.lastIndexOf(']');
    if (
      firstBracket !== -1 &&
      lastBracket !== -1 &&
      lastBracket > firstBracket
    ) {
      const arrayLike = tryParse(source.slice(firstBracket, lastBracket + 1));
      if (arrayLike !== null) return arrayLike;
    }

    return null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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
    _fallbackLocation: string,
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
      const structuredRows = this.extractStructuredScheduleRowsForLlm(page);
      if (!structuredRows.length) {
        parsedItems.push(
          ...this.parseScheduleDraftsFromText(page, _fallbackLocation),
        );
        continue;
      }
      const pageDate = page.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] ?? null;
      if (!pageDate) {
        parsedItems.push(
          ...this.parseScheduleDraftsFromText(page, _fallbackLocation),
        );
        continue;
      }

      for (let index = 0; index < structuredRows.length; index += 1) {
        const row = structuredRows[index];
        const nextRow = structuredRows[index + 1] ?? null;
        const activityText = String(row.activityText ?? '').trim();
        const responsibleText = String(row.responsibleText ?? '').trim();
        const cleanedResponsibleText = responsibleText
          .replace(/^Intervalo\s+/i, '')
          .trim();
        const participantsText = String(row.participantsText ?? '').trim();
        const locationText = String(row.locationText ?? '').trim();
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
          durationMinutes: this.estimateDurationMinutes(
            row.time,
            row.nextTimeHint ?? nextRow?.time ?? null,
          ),
          location: this.defaultScheduleLocationForTitle(
            normalizedTitle,
            this.normalizeScheduleLocationText(locationText),
          ),
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

  private getScheduleBatchSize() {
    return 10;
  }

  private getScheduleSavedCount(draft: Record<string, any>) {
    const parsed = Number(draft.scheduleSavedCount ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  private getScheduleTotalItems(draft: Record<string, any>) {
    const pendingCount = Array.isArray(draft.scheduleItemsDraft)
      ? (draft.scheduleItemsDraft as AssistantScheduleDraftItem[]).length
      : 0;
    const parsed = Number(
      draft.scheduleTotalItems ?? pendingCount + this.getScheduleSavedCount(draft),
    );
    if (!Number.isFinite(parsed) || parsed < 0) {
      return pendingCount + this.getScheduleSavedCount(draft);
    }
    return Math.floor(parsed);
  }

  private getSchedulePreviewState(draft: Record<string, any>) {
    const pendingItems = Array.isArray(draft.scheduleItemsDraft)
      ? (draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
      : [];
    const batchSize = Math.max(
      1,
      Number(draft.scheduleBatchSize ?? this.getScheduleBatchSize()) ||
        this.getScheduleBatchSize(),
    );
    const savedCount = this.getScheduleSavedCount(draft);
    const items = pendingItems.slice(0, batchSize);
    const startNumber = items.length ? savedCount + 1 : savedCount;
    const endNumber = items.length ? savedCount + items.length : savedCount;
    return {
      items,
      batchSize,
      savedCount,
      total: this.getScheduleTotalItems(draft),
      startNumber,
      endNumber,
      hasMore: pendingItems.length > batchSize,
      pendingCount: pendingItems.length,
    };
  }

  private buildScheduleMissingFieldQueue(items: AssistantScheduleDraftItem[]) {
    const queue: AssistantScheduleMissingField[] = [];
    items.forEach((item, index) => {
      if (this.requiresScheduleTitleConfirmation(item)) {
        queue.push({
          itemId: item.id,
          itemNumber: index + 1,
          itemIndex: index,
          fieldKey: 'title',
          fieldLabel: 'Atividade',
        });
      }
      if (this.requiresScheduleLocationConfirmation(item)) {
        queue.push({
          itemId: item.id,
          itemNumber: index + 1,
          itemIndex: index,
          fieldKey: 'location',
          fieldLabel: 'Local',
        });
      }
      if (this.requiresScheduleResponsibleConfirmation(item)) {
        queue.push({
          itemId: item.id,
          itemNumber: index + 1,
          itemIndex: index,
          fieldKey: 'responsible',
          fieldLabel: 'Responsável',
        });
      }
      if (this.requiresScheduleParticipantsConfirmation(item)) {
        queue.push({
          itemId: item.id,
          itemNumber: index + 1,
          itemIndex: index,
          fieldKey: 'participants',
          fieldLabel: 'Participantes',
        });
      }
    });
    return queue;
  }

  private getCurrentScheduleMissingField(draft: Record<string, any>) {
    const queue = Array.isArray(draft.scheduleMissingFieldQueue)
      ? draft.scheduleMissingFieldQueue
      : [];
    if (!queue.length) return null;
    return queue[0] as AssistantScheduleMissingField;
  }

  private buildMissingScheduleFieldConfig(
    draft: Record<string, any>,
    missingField: AssistantScheduleMissingField,
  ): AssistantFieldConfig {
    const items = Array.isArray(draft.scheduleItemsDraft)
      ? (draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
      : [];
    const item = items[missingField.itemIndex];
    const itemScheduleLabel = item?.startAt
      ? this.formatScheduleDateTime(item.startAt)
      : '';
    return {
      field: 'scheduleMissingFieldValue',
      label: itemScheduleLabel
        ? `${missingField.fieldLabel} do item ${missingField.itemNumber} (${itemScheduleLabel})`
        : `${missingField.fieldLabel} do item ${missingField.itemNumber}`,
      inputType: 'text',
      placeholder: this.getScheduleMissingFieldPlaceholder(missingField.fieldKey),
      helperText: item
        ? this.buildMissingScheduleFieldPromptMessage(draft, missingField)
        : `Informe ${missingField.fieldLabel.toLowerCase()} do item ${missingField.itemNumber}.`,
    };
  }

  private applyMissingScheduleFieldValue(
    workflow: AssistantWorkflow,
    rawValue: string | string[] | number,
  ) {
    const currentMissing = this.getCurrentScheduleMissingField(workflow.draft);
    if (!currentMissing) {
      throw new BadRequestException(
        'Não há campo pendente do cronograma aguardando confirmação.',
      );
    }
    const items = Array.isArray(workflow.draft.scheduleItemsDraft)
      ? [...(workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])]
      : [];
    const item = items[currentMissing.itemIndex];
    if (!item || item.id !== currentMissing.itemId) {
      throw new BadRequestException(
        'O item do cronograma aguardando complementação não está mais disponível.',
      );
    }
    const text = Array.isArray(rawValue)
      ? String(rawValue[0] ?? '').trim()
      : String(rawValue ?? '').trim();
    if (!text) {
      throw new BadRequestException(
        `Informe ${currentMissing.fieldLabel.toLowerCase()} ou use "-" se não se aplica.`,
      );
    }
    item[currentMissing.fieldKey] = text;
    items[currentMissing.itemIndex] = item;
    workflow.draft.scheduleItemsDraft = items;
    const remainingQueue = Array.isArray(workflow.draft.scheduleMissingFieldQueue)
      ? [...workflow.draft.scheduleMissingFieldQueue]
      : [];
    remainingQueue.shift();
    workflow.draft.scheduleMissingFieldQueue = remainingQueue;
    workflow.status = remainingQueue.length ? 'collecting' : 'confirming';
  }

  private requiresScheduleLocationConfirmation(item: AssistantScheduleDraftItem) {
    const title = this.normalizeFreeText(item.title);
    if (
      title.startsWith('chegada da equipe') ||
      title === 'intervalo' ||
      title === 'encerramento das atividades'
    ) {
      return false;
    }
    const location = String(item.location ?? '').trim();
    return !location || this.isAmbiguousScheduleLocation(location);
  }

  private requiresScheduleTitleConfirmation(item: AssistantScheduleDraftItem) {
    const normalized = this.normalizeFreeText(item.title);
    if (!normalized || normalized === 'atividade a confirmar') {
      return true;
    }
    return this.isSuspiciousScheduleTitle(item.title);
  }

  private isAmbiguousScheduleLocation(location: string) {
    const normalized = this.normalizeFreeText(location);
    if (!normalized) return true;
    if (/^(auditorio|sala|hangar|ala)$/.test(normalized)) {
      return true;
    }
    if (
      /(todo efetivo escalado|efetivo feminino|recrutas|instrutores|equipe gsd|equipe de instrutores|elos indicados pelo|cpcas|juridicos|psicologos|assistentes sociais)/i.test(
        normalized,
      )
    ) {
      return true;
    }
    if (
      /\bcentro de$/.test(normalized) ||
      /\bconven[cç]oes do$/.test(normalized)
    ) {
      return true;
    }
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) {
        return true;
      }
      seen.add(token);
    }
    if (
      tokens.length === 1 &&
      !/^(basc|bagl|unifa|cbnb|bafl|baaf|ii|iii|comar|dtcea-[a-z]+|gsd-[a-z]+)$/i.test(
        tokens[0],
      )
    ) {
      return true;
    }
    return false;
  }

  private isSuspiciousScheduleTitle(title: string) {
    const safe = String(title ?? '').trim();
    const normalized = this.normalizeFreeText(safe);
    if (!normalized) return true;
    if (
      /(?:[a-z]{4,}\s){2,}[A-Z]{2,}/.test(safe) ||
      /(?:[qxz]{2,}|[A-Z]{4,}\s+[a-z]{1,2}\s+[A-Z]{3,})/.test(safe)
    ) {
      return true;
    }
    return /(gianni|srisisidto|crea da|dh nl|ino dtcea|auditorio da bagl$)/i.test(
      normalized,
    );
  }

  private requiresScheduleResponsibleConfirmation(item: AssistantScheduleDraftItem) {
    const title = this.normalizeFreeText(item.title);
    if (
      title.startsWith('chegada da equipe') ||
      title === 'intervalo' ||
      title === 'encerramento das atividades'
    ) {
      return false;
    }
    const responsible = String(item.responsible ?? '').trim();
    if (
      responsible === 'Equipe de Campo' &&
      !/^(?:[ivxlcdm]+\s+)?(?:encontro de comiss[oõ]es|reuni[aã]o com as cpcas|visita [àa]s instala[cç][õo]es|acompanhamento e observa[cç][ãa]o)/i.test(
        title,
      )
    ) {
      return true;
    }
    return !responsible || this.isAmbiguousScheduleResponsible(responsible);
  }

  private requiresScheduleParticipantsConfirmation(item: AssistantScheduleDraftItem) {
    const title = this.normalizeFreeText(item.title);
    if (
      title.startsWith('chegada da equipe') ||
      title === 'intervalo' ||
      title === 'encerramento das atividades'
    ) {
      return false;
    }
    const participants = String(item.participants ?? '').trim();
    return !participants || this.isAmbiguousScheduleParticipants(participants);
  }

  private isAmbiguousScheduleResponsible(responsible: string) {
    const normalized = this.normalizeFreeText(responsible);
    if (!normalized) return true;
    return (
      /(todo efetivo|efetivo feminino|recrutas|instrutores|cpcas|juridicos|psicologos|assistentes sociais)/i.test(
        normalized,
      ) ||
      /\bda$|\bdo$|\bde$/.test(normalized)
    );
  }

  private isAmbiguousScheduleParticipants(participants: string) {
    const normalized = this.normalizeFreeText(participants);
    if (!normalized) return true;
    return (
      /^(be|slz|co|sm|ece|ctrb|cla|comar|gds|gsd-[a-z]+)$/i.test(normalized) ||
      /^do gsd-/.test(normalized) ||
      /^feminino do /.test(normalized) ||
      /^efetivo do /.test(normalized) ||
      /^elos indicados pelo$/.test(normalized) ||
      /\bpelo$/.test(normalized) ||
      /(recrutas e instrutores do [a-z0-9-]+)\s+recrutas e instrutores$/.test(
        normalized,
      ) ||
      /(efetivo feminino da [a-z0-9-]+)\s+efetivo feminino$/.test(normalized) ||
      /\bda$|\bdo$|\bde$/.test(normalized)
    );
  }

  private getScheduleMissingFieldPlaceholder(
    fieldKey: AssistantScheduleMissingFieldKey,
  ) {
    switch (fieldKey) {
      case 'title':
        return 'Ex.: Reunião com as CPCAs';
      case 'location':
        return 'Ex.: Auditório da UNIFA ou -';
      case 'responsible':
        return 'Ex.: Cap Tamires ou -';
      case 'participants':
        return 'Ex.: Todo efetivo escalado ou -';
      default:
        return 'Informe o valor correto ou use -';
    }
  }

  private deduplicateScheduleDraftItems(items: AssistantScheduleDraftItem[]) {
    const seen = new Map<string, AssistantScheduleDraftItem>();
    for (const item of items) {
      const key = [
        this.normalizeFreeText(item.title),
        String(item.startAt ?? '').trim(),
        String(item.durationMinutes ?? '').trim(),
        this.normalizeFreeText(item.location || '-'),
        this.normalizeFreeText(item.responsible || '-'),
        this.normalizeFreeText(item.participants || '-'),
      ].join('|');
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, item);
        continue;
      }
      existing.sourceFileIds = Array.from(
        new Set([...(existing.sourceFileIds ?? []), ...(item.sourceFileIds ?? [])]),
      );
      existing.sourceFileNames = Array.from(
        new Set([...(existing.sourceFileNames ?? []), ...(item.sourceFileNames ?? [])]),
      );
    }
    const deduped = Array.from(seen.values()).sort((left, right) =>
      String(left.startAt ?? '').localeCompare(String(right.startAt ?? '')),
    );
    const collapsed: AssistantScheduleDraftItem[] = [];
    for (const item of deduped) {
      const previous = collapsed[collapsed.length - 1];
      if (
        previous &&
        previous.startAt === item.startAt &&
        this.normalizeFreeText(previous.title).startsWith('chegada da equipe') &&
        this.normalizeFreeText(item.title).startsWith('chegada da equipe')
      ) {
        const keep =
          String(item.title ?? '').length > String(previous.title ?? '').length
            ? item
            : previous;
        const drop = keep === item ? previous : item;
        keep.sourceFileIds = Array.from(
          new Set([...(keep.sourceFileIds ?? []), ...(drop.sourceFileIds ?? [])]),
        );
        keep.sourceFileNames = Array.from(
          new Set([...(keep.sourceFileNames ?? []), ...(drop.sourceFileNames ?? [])]),
        );
        collapsed[collapsed.length - 1] = keep;
        continue;
      }
      collapsed.push(item);
    }
    return collapsed;
  }

  private resetMissionScheduleDraftForOperationChange(draft: Record<string, any>) {
    draft.scheduleInputMode = null;
    draft.scheduleFiles = null;
    draft.scheduleItemsDraft = [];
    draft.scheduleSourceFiles = [];
    draft.scheduleBatchSize = this.getScheduleBatchSize();
    draft.scheduleSavedCount = 0;
    draft.scheduleTotalItems = 0;
    draft.scheduleEditIndex = null;
    draft.scheduleEditFieldKey = null;
    draft.title = null;
    draft.startAt = null;
    draft.durationMinutes = null;
    draft.location = null;
    draft.responsible = null;
    draft.participants = null;
    draft.scheduleCreateIfMissing = null;
    this.clearExistingScheduleSelection(draft);
    draft.scheduleExistingItems = [];
  }

  private resetMissionScheduleDraftForMissionChange(draft: Record<string, any>) {
    draft.scheduleInputMode = null;
    draft.scheduleFiles = null;
    draft.scheduleItemsDraft = [];
    draft.scheduleSourceFiles = [];
    draft.scheduleBatchSize = this.getScheduleBatchSize();
    draft.scheduleSavedCount = 0;
    draft.scheduleTotalItems = 0;
    draft.scheduleEditIndex = null;
    draft.scheduleEditFieldKey = null;
    draft.title = null;
    draft.startAt = null;
    draft.durationMinutes = null;
    draft.location = null;
    draft.responsible = null;
    draft.participants = null;
    draft.scheduleCreateIfMissing = null;
    this.clearExistingScheduleSelection(draft);
    draft.scheduleExistingItems = [];
  }

  private clearExistingScheduleSelection(draft: Record<string, any>) {
    draft.scheduleExistingItemId = null;
    draft.scheduleExistingEditFieldKey = null;
    draft.scheduleExistingPendingUpdate = null;
  }

  private async syncExistingScheduleItems(
    draft: Record<string, any>,
    user?: RbacUser,
  ) {
    if (!draft.missionId || draft.scheduleOperation !== 'EDIT') {
      draft.scheduleExistingItems = [];
      return [];
    }

    const mission = (await this.missions.getById(
      String(draft.missionId),
      user,
    )) as any;
    const items = Array.isArray(mission?.scheduleItems)
      ? mission.scheduleItems.map((item: any) => ({
          id: String(item.id),
          title: String(item.title ?? ''),
          startAt: new Date(item.startAt).toISOString(),
          durationMinutes: Number(item.durationMinutes ?? 0),
          location: String(item.location ?? ''),
          responsible: String(item.responsible ?? ''),
          participants: String(item.participants ?? ''),
          sourceFileIds: [],
          sourceFileNames: [],
        }))
      : [];
    draft.scheduleExistingItems = items;
    return items;
  }

  private getPendingExistingScheduleUpdate(draft: Record<string, any>) {
    const pending = draft.scheduleExistingPendingUpdate;
    if (!pending || typeof pending !== 'object') return null;
    return pending as {
      itemId: string;
      itemNumber: number;
      title: string;
      fieldKey: string;
      fieldLabel: string;
      previousValue: string;
      nextValue: string;
      payload: Record<string, any>;
    };
  }

  private stageExistingScheduleItemEdit(
    workflow: AssistantWorkflow,
    rawValue: string | number,
  ) {
    const itemId = String(workflow.draft.scheduleExistingItemId ?? '').trim();
    const fieldKey = String(workflow.draft.scheduleExistingEditFieldKey ?? '').trim();
    const items = Array.isArray(workflow.draft.scheduleExistingItems)
      ? (workflow.draft.scheduleExistingItems as AssistantScheduleDraftItem[])
      : [];
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (!itemId || itemIndex < 0) {
      throw new BadRequestException(
        'Selecione o item do cronograma que deseja alterar.',
      );
    }
    if (!fieldKey) {
      throw new BadRequestException(
        'Selecione primeiro o campo do cronograma que deseja alterar.',
      );
    }

    const current = items[itemIndex];
    let nextRawValue: string | number = rawValue;
    if (fieldKey === 'title' || fieldKey === 'responsible') {
      const text = String(rawValue ?? '').trim();
      if (!text) {
        throw new BadRequestException(
          `Informe um valor válido para ${this.getScheduleFieldLabel(fieldKey).toLowerCase()}.`,
        );
      }
      nextRawValue = text;
    } else if (fieldKey === 'location') {
      nextRawValue = String(rawValue ?? '').trim();
    } else if (fieldKey === 'participants') {
      nextRawValue = String(rawValue ?? '').trim();
    } else if (fieldKey === 'durationMinutes') {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new BadRequestException('Informe uma duração válida em minutos.');
      }
      nextRawValue = Math.round(parsed);
    } else if (fieldKey === 'startAt') {
      nextRawValue = String(rawValue ?? '').trim();
    }

    workflow.draft.scheduleExistingPendingUpdate = {
      itemId,
      itemNumber: itemIndex + 1,
      title: current.title,
      fieldKey,
      fieldLabel: this.getScheduleFieldLabel(fieldKey),
      previousValue: this.formatScheduleFieldValue(current, fieldKey),
      nextValue: this.formatScheduleFieldValue(
        { ...current, [fieldKey]: nextRawValue },
        fieldKey,
      ),
      payload: { [fieldKey]: nextRawValue },
    };
    workflow.status = 'confirming';
  }

  private async confirmExistingScheduleItemEdit(
    session: AssistantSession,
    workflow: AssistantWorkflow,
    user?: RbacUser,
  ) {
    const pending = this.getPendingExistingScheduleUpdate(workflow.draft);
    if (!pending) {
      throw new BadRequestException('Nenhuma alteração pendente foi montada.');
    }

    await this.missions.updateScheduleItem(
      workflow.draft.missionId,
      pending.itemId,
      pending.payload,
      user,
    );
    const refreshedItems = await this.syncExistingScheduleItems(workflow.draft, user);
    this.clearExistingScheduleSelection(workflow.draft);
    workflow.status = 'collecting';
    session.updatedAt = new Date().toISOString();

    const updatedView = await this.buildWorkflowView(workflow, user);
    return this.buildReply(
      session,
      this.pushMessage(
        session,
        'assistant',
        [
          `Alteração salva no **item ${pending.itemNumber}**.`,
          this.buildExistingScheduleListMessage(refreshedItems),
          'Se quiser ajustar outro item, selecione-o abaixo. Se terminou, cancele o fluxo ou inicie outra ação.',
        ].join('\n\n'),
      ),
      updatedView,
      null,
    );
  }

  private async confirmScheduleUploadBatch(
    session: AssistantSession,
    workflow: AssistantWorkflow,
    user?: RbacUser,
  ) {
    const pendingItems = Array.isArray(workflow.draft.scheduleItemsDraft)
      ? [...(workflow.draft.scheduleItemsDraft as AssistantScheduleDraftItem[])]
      : [];
    const preview = this.getSchedulePreviewState(workflow.draft);
    const batchItems = preview.items;
    if (!batchItems.length) {
      throw new BadRequestException(
        'Não há itens pendentes para cadastrar neste cronograma.',
      );
    }

    for (const item of batchItems) {
      await this.missions.createScheduleItem(
        workflow.draft.missionId,
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

    workflow.draft.scheduleItemsDraft = pendingItems.slice(batchItems.length);
    workflow.draft.scheduleSavedCount = preview.savedCount + batchItems.length;
    workflow.status = Array.isArray(workflow.draft.scheduleItemsDraft) &&
      workflow.draft.scheduleItemsDraft.length
        ? 'confirming'
        : 'completed';
    session.updatedAt = new Date().toISOString();

    if (
      Array.isArray(workflow.draft.scheduleItemsDraft) &&
      workflow.draft.scheduleItemsDraft.length
    ) {
      const nextPreview = this.getSchedulePreviewState(workflow.draft);
      const updatedView = await this.buildWorkflowView(workflow, user);
      return this.buildReply(
        session,
        this.pushMessage(
          session,
          'assistant',
          [
            `Itens **${preview.startNumber}-${preview.endNumber}** cadastrados com sucesso.`,
            `Agora revise o próximo lote (**${nextPreview.startNumber}-${nextPreview.endNumber}**) e confirme quando estiver correto.`,
            this.buildSchedulePreviewMessage(
              nextPreview.items,
              nextPreview.savedCount,
            ),
          ].join('\n\n'),
        ),
        updatedView,
        null,
      );
    }

    const totalCreated = this.getScheduleTotalItems(workflow.draft);
    workflow.status = 'completed';
    session.workflow = null;
    return this.buildReply(
      session,
      this.pushMessage(
        session,
        'assistant',
        [
          'Ação executada com sucesso.',
          `Registro criado: **Cronograma cadastrado com ${totalCreated} item(ns)**.`,
          'Você pode abrir o item pelo link retornado ou iniciar outra ação assistida.',
        ].join('\n\n'),
      ),
      null,
      {
        entityType: 'mission_schedule',
        id: String(workflow.draft.missionId),
        title: `Cronograma cadastrado com ${totalCreated} item(ns)`,
        url: `/missions?scope=${encodeURIComponent(String(workflow.draft.scope ?? 'SMIF'))}&missionId=${encodeURIComponent(String(workflow.draft.missionId))}`,
      },
    );
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
          : '');
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

  private extractStructuredScheduleTimeInfo(rawLine: string) {
    const lineWithoutDate = String(rawLine ?? '').replace(
      /\b\d{2}\/\d{2}\/\d{4}\b/g,
      ' ',
    );
    const patterns = [
      {
        regex:
          /(\d{1,2})h([0-5]\d)?\s*[-–]\s*(\d{1,2})h([0-5]\d)?/i,
        resolve: (match: RegExpMatchArray) => ({
          startTime: `${String(Number(match[1])).padStart(2, '0')}:${String(Number(match[2] ?? '0')).padStart(2, '0')}`,
          explicitEndTime: `${String(Number(match[3])).padStart(2, '0')}:${String(Number(match[4] ?? '0')).padStart(2, '0')}`,
          partialRange: false,
        }),
      },
      {
        regex: /(\d{1,2})h([0-5]\d)?\s*[-–](?!\s*\d)/i,
        resolve: (match: RegExpMatchArray) => ({
          startTime: `${String(Number(match[1])).padStart(2, '0')}:${String(Number(match[2] ?? '0')).padStart(2, '0')}`,
          explicitEndTime: null,
          partialRange: true,
        }),
      },
      {
        regex: /\b(\d{1,2})h([0-5]\d)?\b/i,
        resolve: (match: RegExpMatchArray) => ({
          startTime: `${String(Number(match[1])).padStart(2, '0')}:${String(Number(match[2] ?? '0')).padStart(2, '0')}`,
          explicitEndTime: null,
          partialRange: false,
        }),
      },
    ] as const;

    for (const pattern of patterns) {
      const match = lineWithoutDate.match(pattern.regex);
      if (!match || (match.index ?? 999) > 40) {
        continue;
      }
      const resolved = pattern.resolve(match);
      return {
        ...resolved,
        lineWithoutDateAndTime:
          lineWithoutDate.slice(0, match.index ?? 0) +
          ' '.repeat(match[0].length) +
          lineWithoutDate.slice((match.index ?? 0) + match[0].length),
      };
    }

    return null;
  }

  private extractStructuredScheduleLineChunks(rawLine: string) {
    const source = String(rawLine ?? '').replace(/\r/g, '');
    const matches = source.matchAll(/\S(?:.*?\S)?(?=(?:\s{2,}|$))/g);
    const chunks: Array<{ text: string; start: number }> = [];
    for (const match of matches) {
      const text = this.cleanScheduleLine(match[0]);
      if (!text) continue;
      if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(text) ||
        /^\([^)]+\)$/.test(text)
      ) {
        continue;
      }
      chunks.push({ text, start: match.index ?? 0 });
    }
    return chunks;
  }

  private classifyStructuredScheduleChunk(
    chunk: { text: string; start: number },
    bounds: {
      activityStart: number;
      cipavdStart: number;
      participantsStart: number;
      locationStart: number;
    },
  ): 'activity' | 'responsible' | 'participants' | 'location' | null {
    const normalized = this.normalizeFreeText(chunk.text);
    if (!normalized) return null;
    if (normalized === 'tarde' || normalized === 'manha') return null;
    if (chunk.text === '-' || chunk.text === '—') {
      if (chunk.start >= bounds.participantsStart - 4) {
        return 'participants';
      }
      return null;
    }
    const looksLikeActivity =
      normalized.includes('chegada da equipe') ||
      normalized.includes('apresentacao ao comandante') ||
      normalized.includes('logistica de atividades') ||
      normalized.includes('conscientizacao') ||
      normalized.includes('preven') ||
      normalized === 'assedio' ||
      normalized.includes('violencia domest') ||
      normalized.includes('aplicacao de pesquisa') ||
      normalized.includes('reuniao com as cpcas') ||
      normalized.includes('encontro de comissoes') ||
      normalized.includes('ciclo de boas pratic') ||
      normalized.includes('encerramento das atividades') ||
      normalized === 'intervalo';
    if (looksLikeActivity) {
      return 'activity';
    }
    if (
      chunk.start >= bounds.locationStart - 4 ||
      /(audit[oó]rio|comar|unifa|basc|bagl|cbnb|cinema|sala|hangar|ala)\b/i.test(
        chunk.text,
      )
    ) {
      return 'location';
    }
    if (chunk.start >= bounds.participantsStart - 4) {
      return 'participants';
    }
    if (
      chunk.start >= bounds.cipavdStart - 4 ||
      this.isLikelyResponsibleLine(chunk.text)
    ) {
      return 'responsible';
    }
    if (chunk.start >= bounds.activityStart - 4) {
      return 'activity';
    }
    return null;
  }

  private isStructuredScheduleActivityIncomplete(text: string) {
    const normalized = this.normalizeFreeText(text);
    if (!normalized) return true;
    return (
      normalized.endsWith('ao') ||
      normalized.endsWith('de') ||
      normalized.endsWith('da') ||
      normalized === 'assedio' ||
      normalized.includes('conscientizacao e prevencao ao') ||
      (normalized.includes('palestra sobre violencia') &&
        !normalized.includes('domestica'))
    );
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
      this.defaultScheduleLocationForTitle(normalizedTitle);
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
        this.defaultScheduleLocationForTitle(normalizedTitle, location),
      responsible: responsible || 'Equipe de Campo',
      participants,
    };
  }

  private extractTimeMarker(line: string) {
    const match = line.match(
      /^(\d{1,2})h(?:([0-5]\d))?(?:\s*[-–]\s*\d{1,2}h(?:[0-5]\d)?)?(?:\s+|$)(.*)$/i,
    );
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

  private defaultScheduleLocationForTitle(title: string, explicitLocation = '') {
    const safeLocation = String(explicitLocation ?? '').trim();
    const normalizedTitle = this.normalizeFreeText(title);
    if (
      normalizedTitle.startsWith('chegada da equipe') ||
      normalizedTitle === 'intervalo' ||
      normalizedTitle === 'encerramento das atividades'
    ) {
      return '-';
    }
    if (safeLocation === '-' || safeLocation === '—') return '-';
    if (safeLocation) return safeLocation;
    return '';
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
    startOffset = 0,
    missingField: AssistantScheduleMissingField | null = null,
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
      this.buildSchedulePreviewMessage(items, startOffset),
      missingField
        ? this.buildMissingScheduleFieldPromptMessage(
            { scheduleItemsDraft: items },
            missingField,
            { markdown: true },
          )
        : 'Se estiver correto, confirme o lote atual. Se precisar ajustar, use a numeração exibida no rascunho, por exemplo **alterar item 2** ou **remover item 3**.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildSchedulePreviewMessage(
    items: AssistantScheduleDraftItem[],
    startOffset = 0,
  ) {
    const preview = items.slice(0, this.getScheduleBatchSize()).map((item, index) => {
      const when = this.formatScheduleDateTime(item.startAt);
      return `${startOffset + index + 1}. **${item.title}**\nLocal: ${item.location || '(a confirmar)'}\nInício: ${when}\nDuração: ${item.durationMinutes} min\nResponsável: ${item.responsible || '-'}\nParticipantes: ${item.participants || '-'}`;
    });
    const remaining =
      items.length > preview.length
        ? `... e mais ${items.length - preview.length} item(ns) no rascunho.`
        : '';
    return `**Itens montados**\n\n${preview.join('\n\n')}${remaining ? `\n\n${remaining}` : ''}`;
  }

  private buildCurrentFieldPromptMessage(
    currentField: AssistantFieldConfig | null,
    draft?: Record<string, any>,
  ) {
    if (!currentField) {
      return 'Fluxo atualizado.';
    }
    if (
      currentField.field === 'scheduleMissingFieldValue' &&
      draft
    ) {
      const missingField = this.getCurrentScheduleMissingField(draft);
      if (missingField) {
        return `Certo. ${this.buildMissingScheduleFieldPromptMessage(draft, missingField, {
          markdown: true,
        })}`;
      }
      if (currentField.helperText) {
        return `Certo. ${currentField.helperText}`;
      }
    }
    return `Certo. Agora preciso de **${currentField.label.toLowerCase()}**.`;
  }

  private buildMissingScheduleFieldPromptMessage(
    draft: Record<string, any>,
    missingField: AssistantScheduleMissingField,
    options?: { markdown?: boolean },
  ) {
    const items = Array.isArray(draft.scheduleItemsDraft)
      ? (draft.scheduleItemsDraft as AssistantScheduleDraftItem[])
      : [];
    const item = items[missingField.itemIndex];
    const itemTitle = String(item?.title ?? `item ${missingField.itemNumber}`).trim();
    const itemScheduleLabel = item?.startAt
      ? this.formatScheduleDateTime(item.startAt)
      : '';
    const markdown = Boolean(options?.markdown);
    const titleText = markdown ? `**"${itemTitle}"**` : `"${itemTitle}"`;
    const scheduleText = itemScheduleLabel
      ? markdown
        ? ` em **${itemScheduleLabel}**`
        : ` em ${itemScheduleLabel}`
      : '';
    const fieldText = markdown
      ? `**${missingField.fieldLabel.toLowerCase()}**`
      : missingField.fieldLabel.toLowerCase();
    const fallbackValueText = markdown ? '**"-"**' : '"-"';
    return [
      `Não consegui identificar ${fieldText} para ${titleText}${scheduleText}.`,
      `Informe o valor correto ou use ${fallbackValueText} se não se aplica.`,
    ].join(' ');
  }

  private buildScheduleReadyToConfirmMessage(
    workflowView: {
      title: string;
      currentField: AssistantFieldConfig | null;
      readyToConfirm: boolean;
      summary?: Array<{ label: string; value: string }>;
    },
    draft: Record<string, any>,
  ) {
    const preview = this.getSchedulePreviewState(draft);
    const lines = [
      `Rascunho de **${workflowView.title.toLowerCase()}** pronto para conferência.`,
    ];
    if (preview.items.length) {
      lines.push(this.buildSchedulePreviewMessage(preview.items, preview.savedCount));
      lines.push('Revise os itens acima. Se estiver tudo certo, confirme a execução.');
    } else {
      lines.push('Revise os dados abaixo. Se estiver tudo certo, confirme a execução.');
    }
    return lines.join('\n\n');
  }

  private buildEntityReadyToConfirmMessage(workflowView: {
    title: string;
    summary?: Array<{ label: string; value: string }>;
  }) {
    const lines = [
      `Rascunho de **${workflowView.title.toLowerCase()}** pronto para conferência.`,
    ];

    const summary = Array.isArray(workflowView.summary)
      ? workflowView.summary
      : [];
    if (summary.length) {
      lines.push(
        summary
          .map((item) => `- **${item.label}:** ${item.value || '—'}`)
          .join('\n'),
      );
    }

    lines.push('Se estiver tudo certo, confirme a execução.');
    return lines.join('\n\n');
  }

  private buildExistingScheduleListMessage(items: AssistantScheduleDraftItem[]) {
    if (!items.length) {
      return 'Esta missão ainda não possui itens salvos no cronograma.';
    }
    const lines = items.map((item, index) => {
      const when = this.formatScheduleDateTime(item.startAt);
      return `${index + 1}. **${item.title}**\nLocal: ${item.location || '(a confirmar)'}\nInício: ${when}\nDuração: ${item.durationMinutes} min\nResponsável: ${item.responsible || '-'}\nParticipantes: ${item.participants || '-'}`;
    });
    return [
      `A missão já possui **${items.length} item(ns)** no cronograma.`,
      'Escolha abaixo qual item deseja editar.',
      '',
      lines.join('\n\n'),
    ].join('\n');
  }

  private getScheduleFieldLabel(fieldKey: string) {
    switch (fieldKey) {
      case 'startAt':
        return 'Início';
      case 'durationMinutes':
        return 'Duração em minutos';
      case 'location':
        return 'Local';
      case 'responsible':
        return 'Responsável';
      case 'participants':
        return 'Participantes';
      default:
        return 'Título';
    }
  }

  private formatScheduleFieldValue(
    item: AssistantScheduleDraftItem,
    fieldKey: string,
  ) {
    switch (fieldKey) {
      case 'startAt':
        return this.formatScheduleDateTime(item.startAt);
      case 'durationMinutes':
        return `${item.durationMinutes} min`;
      case 'location':
        return item.location || '-';
      case 'responsible':
        return item.responsible || '-';
      case 'participants':
        return item.participants || '-';
      default:
        return item.title || '-';
    }
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
