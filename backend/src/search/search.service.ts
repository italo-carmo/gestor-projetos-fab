import { Injectable, Logger } from '@nestjs/common';
import { LocalityCatalogType, PermissionScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { sanitizeForExecutive } from '../common/executive';
import {
  ROLE_COMANDANTE_COMGEP,
  ROLE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
  hasAnyRole,
  hasPermission,
  resolveAccessProfile,
} from '../rbac/role-access';
import { LitellmService } from '../llm/litellm.service';

type LegacySearchPayload = {
  tasks: Array<{
    id: string;
    title: string;
    scope: string;
    localityId: string | null;
    localityName: string;
    dueDate: Date | null;
    status: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate: Date | null;
  }>;
  meetings: Array<{
    id: string;
    datetime: Date;
    status: string;
    scope: string;
    localityId: string | null;
  }>;
  localities: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    localityId: string | null;
    localityName: string | null;
    fileName: string;
  }>;
};

type SemanticSearchItem = {
  id: string;
  entityType: 'TASK' | 'MEETING' | 'LOCALITY' | 'DOCUMENT' | 'SCREEN';
  entityTypeLabel: string;
  title: string;
  subtitle: string | null;
  url: string;
  probability: number;
};

type SemanticSearchPayload = {
  usedAi: boolean;
  model: string | null;
  items: SemanticSearchItem[];
};

type SearchPayload = LegacySearchPayload & {
  semantic: SemanticSearchPayload;
};

type SemanticCandidate = {
  candidateId: string;
  id: string;
  entityType: SemanticSearchItem['entityType'];
  entityTypeLabel: string;
  title: string;
  subtitle: string | null;
  url: string;
  keywords: string[];
  fallbackProbability: number;
};

type SearchPermissionFlags = {
  canViewTasks: boolean;
  canViewNotices: boolean;
  canViewMeetings: boolean;
  canViewLocalities: boolean;
  canViewDocuments: boolean;
};

type SearchScreenCandidate = {
  id: string;
  entityType: 'SCREEN';
  entityTypeLabel: string;
  path: string;
  title: string;
  subtitle: string;
  keywords: string[];
  isAllowed?: (user: RbacUser | undefined) => boolean;
};

type RouteWhitelistEntry = {
  path: string;
  allowedQueryKeys?: Set<string>;
  allowDynamicSuffix?: boolean;
};

const SEARCH_SCREEN_ALLOWED_ROUTES: RouteWhitelistEntry[] = [
  { path: '/dashboard/smif' },
  { path: '/dashboard/cipavd' },
  { path: '/dashboard/bi', allowedQueryKeys: new Set(['tab']) },
  { path: '/dashboard/bi-violencia-domestica' },
  { path: '/dashboard/bi-recrutas' },
  { path: '/dashboard/bi-ciclo-boas-praticas' },
  { path: '/dashboard/bi-encontro-cpca' },
  { path: '/dashboard/bi-avaliacao-gsd' },
  { path: '/dashboard/estrategico', allowedQueryKeys: new Set(['tab']) },
  { path: '/dashboard/cpca' },
  { path: '/tasks', allowedQueryKeys: new Set(['taskId']) },
  { path: '/meetings', allowedQueryKeys: new Set(['scope', 'meetingId']) },
  { path: '/activities' },
  { path: '/activities-cipavd' },
  { path: '/missions', allowedQueryKeys: new Set(['scope', 'missionId']) },
  { path: '/best-practices' },
  { path: '/library' },
  { path: '/smif-complaints', allowedQueryKeys: new Set(['scope', 'caseId']) },
  { path: '/cpca-cases', allowedQueryKeys: new Set(['scope', 'caseId']) },
  { path: '/documents', allowedQueryKeys: new Set(['docId']) },
  { path: '/dashboard/locality', allowDynamicSuffix: true },
];

const SEARCH_SCREEN_CANDIDATES: SearchScreenCandidate[] = [
  {
    id: 'dashboard-comgep',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/estrategico?tab=comgep',
    title: 'Sala COMGEP',
    subtitle:
      'Recorte executivo com cobertura CPCA, risco e presença operacional',
    keywords: [
      'comgep',
      'sala de situacao',
      'sala de situação',
      'risco institucional',
      'cobertura cpca',
      'presenca operacional',
      'presença operacional',
    ],
    isAllowed: (user) => hasAnyRole(user, [ROLE_COMGEP, ROLE_TI]),
  },
  {
    id: 'tasks',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/tasks',
    title: 'Tarefas',
    subtitle: 'Lista de tarefas do sistema',
    keywords: ['tarefas', 'tarefas de campo', 'pendências', 'tarefas cipavd'],
    isAllowed: (user) => hasPermission(user, 'task_instances', 'view'),
  },
  {
    id: 'meetings',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/meetings',
    title: 'Reuniões',
    subtitle: 'Agenda e reuniões por localidade',
    keywords: ['reuniões', 'reunioes', 'ata', 'reunião', 'palestra'],
    isAllowed: (user) => hasPermission(user, 'meetings', 'view'),
  },
  {
    id: 'activities-smif',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/activities',
    title: 'Atividades de Campo (SMIF)',
    subtitle: 'Painel de atividades de campo e relatórios',
    keywords: [
      'atividade',
      'atividades',
      'campo',
      'smif',
      'atividade de campo',
    ],
  },
  {
    id: 'activities-cipavd',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/activities-cipavd',
    title: 'Atividades de Campo (CIPAVD)',
    subtitle: 'Atividades de campo específicas da CIPAVD',
    keywords: [
      'atividade',
      'atividades',
      'campo',
      'cipavd',
      'atividade de campo',
    ],
  },
  {
    id: 'missions',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/missions',
    title: 'Missões',
    subtitle: 'Execução de missões e planejamento',
    keywords: ['missões', 'missoes', 'missão', 'plano de missão', 'missao'],
    isAllowed: (user) => hasPermission(user, 'missions', 'view'),
  },
  {
    id: 'best-practices',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/best-practices',
    title: 'Boas Práticas',
    subtitle: 'Base de boas práticas institucionais',
    keywords: ['boas práticas', 'boas praticas', 'boas-práticas', 'boas'],
    isAllowed: (user) => hasPermission(user, 'best_practices', 'view'),
  },
  {
    id: 'bi-schools',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/bi?tab=schools',
    title: 'Pesquisas de escolas',
    subtitle: 'Pesquisa institucional de escolas',
    keywords: [
      'pesquisa',
      'pesquisas',
      'escolas',
      'institucional',
      'questionário',
    ],
    isAllowed: (user) => hasPermission(user, 'bi', 'view'),
  },
  {
    id: 'bi-domestic-violence',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/bi?tab=domestic-violence',
    title: 'Pesquisa de Violência Doméstica',
    subtitle: 'Indicadores e histórico de violência doméstica',
    keywords: ['violência', 'violencia', 'domestica', 'violência doméstica'],
    isAllowed: (user) => hasPermission(user, 'bi', 'view'),
  },
  {
    id: 'bi-recruits',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/bi?tab=recruits',
    title: 'Pesquisa de Recrutas',
    subtitle: 'Percepção e riscos para recrutamento',
    keywords: ['recrutas', 'recrutamento', 'pesquisa de recrutas', 'risco'],
    isAllowed: (user) => hasPermission(user, 'bi', 'view'),
  },
  {
    id: 'bi-best-practice-cycle',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/bi?tab=best-practices-cycle',
    title: 'Pesquisa de Ciclo de Boas Práticas',
    subtitle: 'Monitoramento de ciclo de boas práticas',
    keywords: [
      'boas práticas',
      'ciclo',
      'boas praticas',
      'pesquisa de ciclo',
      'ciclo de boas praticas',
    ],
    isAllowed: (user) => hasPermission(user, 'bi', 'view'),
  },
  {
    id: 'bi-cpca-meeting',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/bi?tab=cpca-meeting',
    title: 'Pesquisa de Encontro CPCA',
    subtitle: 'Indicadores de encontro CPCA',
    keywords: ['cpca', 'encontro', 'cpca meeting', 'encontro cpca'],
    isAllowed: (user) => hasPermission(user, 'bi', 'view'),
  },
  {
    id: 'bi-gsd-evaluation',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/bi?tab=gsd-evaluation',
    title: 'Pesquisa de Avaliação GSD',
    subtitle: 'Avaliação de clima e ambiente de segurança',
    keywords: ['gsd', 'avaliação', 'avaliacao', 'pesquisa gsd'],
    isAllowed: (user) => hasPermission(user, 'bi', 'view'),
  },
  {
    id: 'complaints-smif',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/smif-complaints',
    title: 'Denúncias SMIF',
    subtitle: 'Fluxo de denúncias do sistema SMIF',
    keywords: ['denúncia', 'denuncias', 'smif', 'caso'],
    isAllowed: (user) => hasPermission(user, 'smif_complaints', 'view'),
  },
  {
    id: 'complaints-cpca',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/cpca-cases',
    title: 'Denúncias CPCA',
    subtitle: 'Casos e andamento de denúncias CPCA',
    keywords: ['cpca', 'denúncia', 'denuncias', 'caso cpca'],
    isAllowed: (user) => hasPermission(user, 'cpca_cases', 'view'),
  },
  {
    id: 'dashboard-cipavd',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/cipavd',
    title: 'Dashboard CIPAVD',
    subtitle: 'Painel executivo com visão consolidada',
    keywords: [
      'painel',
      'dashboard',
      'estratégico',
      'executivo',
      'cipavd',
      'dashboard cipavd',
    ],
    isAllowed: () => true,
  },
  {
    id: 'dashboard-smif',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/smif',
    title: 'Dashboard SMIF',
    subtitle: 'Indicadores nacionais do sistema SMIF',
    keywords: ['dashboard', 'smif', 'comum', 'nacional', 'escolas'],
    isAllowed: (user) =>
      hasPermission(user, 'dashboard', 'view', PermissionScope.NATIONAL),
  },
  {
    id: 'dashboard-estrategico',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/estrategico',
    title: 'Dashboard Estratégico',
    subtitle: 'Painel consolidado de análise estratégica',
    keywords: ['dashboard', 'estratégico', 'estrategico', 'estrategia'],
    isAllowed: (user) =>
      hasAnyRole(user, [ROLE_COMGEP, ROLE_TI, ROLE_COORDENACAO_CIPAVD]),
  },
  {
    id: 'dashboard-cpca',
    entityType: 'SCREEN',
    entityTypeLabel: 'Tela',
    path: '/dashboard/cpca',
    title: 'Dashboard CPCA',
    subtitle: 'Painel de indicadores de denúncias CPCA',
    keywords: ['cpca', 'denúncia', 'denuncias', 'dashboard cpca'],
    isAllowed: (user) => hasPermission(user, 'cpca_cases', 'view'),
  },
];

type TaskSearchRow = {
  id: string;
  scope: string | null;
  titleOverride: string | null;
  localityId: string;
  dueDate: Date;
  status: string;
  specialtyId: string | null;
  assignedToId: string | null;
  eloRoleId: string | null;
  taskTemplate: { title: string } | null;
  locality: { id: string; name: string; code: string } | null;
};

type NoticeSearchRow = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
};

type MeetingSearchRow = {
  id: string;
  datetime: Date;
  status: string;
  scope: string;
  localityId: string | null;
};

type LocalitySearchRow = {
  id: string;
  code: string;
  name: string;
};

type DocumentSearchRow = {
  id: string;
  title: string;
  category: string;
  localityId: string | null;
  fileName: string;
  locality: { id: string; name: string; code: string } | null;
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly maxItemsPerEntity = 20;
  private readonly maxSemanticCandidates = 70;
  private readonly maxSemanticResults = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly litellm: LitellmService,
  ) {}

  async query(q: string, user?: RbacUser): Promise<SearchPayload> {
    const query = q?.trim();
    if (!query) {
      return this.emptyPayload();
    }

    const constraints = this.getScopeConstraints(user);
    const permissions = this.resolveSearchPermissions(user);
    const queryTokens = this.extractQueryTokens(query);

    const taskWhere = permissions.canViewTasks
      ? this.buildTaskWhere(query, queryTokens, constraints, user)
      : null;
    const noticeWhere = permissions.canViewNotices
      ? this.buildNoticeWhere(query, queryTokens, constraints)
      : null;
    const meetingWhere = permissions.canViewMeetings
      ? this.buildMeetingWhere(query, queryTokens, constraints)
      : null;
    const localityWhere = permissions.canViewLocalities
      ? this.buildLocalityWhere(query, queryTokens, constraints)
      : null;
    const documentWhere = permissions.canViewDocuments
      ? this.buildDocumentWhere(query, queryTokens, user)
      : null;

    const [tasks, notices, meetings, localities, documents] = await Promise.all(
      [
        taskWhere
          ? (this.prisma.taskInstance.findMany({
              where: taskWhere,
              select: {
                id: true,
                scope: true,
                titleOverride: true,
                localityId: true,
                dueDate: true,
                status: true,
                specialtyId: true,
                assignedToId: true,
                eloRoleId: true,
                taskTemplate: { select: { title: true } },
                locality: { select: { id: true, name: true, code: true } },
              },
              orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
              take: this.maxItemsPerEntity,
            }) as Promise<TaskSearchRow[]>)
          : Promise.resolve([] as TaskSearchRow[]),
        noticeWhere
          ? (this.prisma.notice.findMany({
              where: noticeWhere,
              select: {
                id: true,
                title: true,
                priority: true,
                dueDate: true,
              },
              orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
              take: this.maxItemsPerEntity,
            }) as Promise<NoticeSearchRow[]>)
          : Promise.resolve([] as NoticeSearchRow[]),
        meetingWhere
          ? (this.prisma.meeting.findMany({
              where: meetingWhere,
              select: {
                id: true,
                datetime: true,
                status: true,
                scope: true,
                localityId: true,
              },
              orderBy: [{ datetime: 'desc' }, { updatedAt: 'desc' }],
              take: this.maxItemsPerEntity,
            }) as Promise<MeetingSearchRow[]>)
          : Promise.resolve([] as MeetingSearchRow[]),
        localityWhere
          ? (this.prisma.locality.findMany({
              where: localityWhere,
              select: { id: true, code: true, name: true },
              orderBy: { name: 'asc' },
              take: this.maxItemsPerEntity,
            }) as Promise<LocalitySearchRow[]>)
          : Promise.resolve([] as LocalitySearchRow[]),
        documentWhere
          ? (this.prisma.documentAsset.findMany({
              where: documentWhere,
              select: {
                id: true,
                title: true,
                category: true,
                localityId: true,
                fileName: true,
                locality: { select: { id: true, name: true, code: true } },
              },
              orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
              take: this.maxItemsPerEntity,
            }) as Promise<DocumentSearchRow[]>)
          : Promise.resolve([] as DocumentSearchRow[]),
      ],
    );

    const payload: SearchPayload = {
      tasks: tasks.map((task) => ({
        id: task.id,
        title: this.resolveTaskTitle(task),
        scope: String(task.scope ?? 'SMIF'),
        localityId: task.localityId,
        localityName: task.locality?.name ?? '',
        dueDate: task.dueDate,
        status: task.status,
      })),
      notices: notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        priority: notice.priority,
        dueDate: notice.dueDate,
      })),
      meetings: meetings.map((meeting) => ({
        id: meeting.id,
        datetime: meeting.datetime,
        status: meeting.status,
        scope: meeting.scope,
        localityId: meeting.localityId,
      })),
      localities: localities.map((loc) => ({
        id: loc.id,
        code: loc.code,
        name: loc.name,
      })),
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        localityId: doc.localityId,
        localityName: doc.locality?.name ?? null,
        fileName: doc.fileName,
      })),
      semantic: await this.buildSemanticResults({
        query,
        user,
        payload: {
          tasks: tasks.map((task) => ({
            id: task.id,
            title: this.resolveTaskTitle(task),
            scope: String(task.scope ?? 'SMIF'),
            localityId: task.localityId,
            localityName: task.locality?.name ?? '',
            dueDate: task.dueDate,
            status: task.status,
          })),
          notices: notices.map((notice) => ({
            id: notice.id,
            title: notice.title,
            priority: notice.priority,
            dueDate: notice.dueDate,
          })),
          meetings: meetings.map((meeting) => ({
            id: meeting.id,
            datetime: meeting.datetime,
            status: meeting.status,
            scope: meeting.scope,
            localityId: meeting.localityId,
          })),
          localities: localities.map((loc) => ({
            id: loc.id,
            code: loc.code,
            name: loc.name,
          })),
          documents: documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            localityId: doc.localityId,
            localityName: doc.locality?.name ?? null,
            fileName: doc.fileName,
          })),
        },
      }),
    };

    return user?.executiveHidePii ? sanitizeForExecutive(payload) : payload;
  }

  private emptyPayload(): SearchPayload {
    return {
      tasks: [],
      notices: [],
      meetings: [],
      localities: [],
      documents: [],
      semantic: {
        usedAi: false,
        model: null,
        items: [],
      },
    };
  }

  private resolveSearchPermissions(user?: RbacUser): SearchPermissionFlags {
    return {
      canViewTasks: hasPermission(user, 'task_instances', 'view'),
      canViewNotices: hasPermission(user, 'notices', 'view'),
      canViewMeetings: hasPermission(user, 'meetings', 'view'),
      canViewLocalities:
        hasPermission(user, 'dashboard', 'view') ||
        hasPermission(user, 'localities', 'view'),
      canViewDocuments: hasPermission(user, 'documents', 'view'),
    };
  }

  private buildTaskWhere(
    query: string,
    tokens: string[],
    constraints: { localityId?: string; specialtyId?: string },
    user?: RbacUser,
  ): Prisma.TaskInstanceWhereInput {
    const needles = this.buildNeedles(query, tokens);
    const matchAnyNeedle: Prisma.TaskInstanceWhereInput[] = needles.flatMap(
      (needle) => [
        { titleOverride: { contains: needle, mode: 'insensitive' } },
        { taskTemplate: { title: { contains: needle, mode: 'insensitive' } } },
        { locality: { name: { contains: needle, mode: 'insensitive' } } },
        { locality: { code: { contains: needle, mode: 'insensitive' } } },
      ],
    );

    const and: Prisma.TaskInstanceWhereInput[] = [
      {
        OR: matchAnyNeedle,
      },
    ];

    if (constraints.localityId)
      and.push({ localityId: constraints.localityId });
    if (constraints.specialtyId) {
      and.push({
        OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
      });
    }

    const accessWhere = this.buildTaskViewAccessWhere(user);
    if (Object.keys(accessWhere).length > 0) and.push(accessWhere);

    return and.length === 1 ? and[0] : { AND: and };
  }

  private buildNoticeWhere(
    query: string,
    tokens: string[],
    constraints: { localityId?: string; specialtyId?: string },
  ): Prisma.NoticeWhereInput {
    const needles = this.buildNeedles(query, tokens);
    const matchAnyNeedle: Prisma.NoticeWhereInput[] = needles.flatMap(
      (needle) => [
        { title: { contains: needle, mode: 'insensitive' } },
        { body: { contains: needle, mode: 'insensitive' } },
      ],
    );

    const and: Prisma.NoticeWhereInput[] = [
      {
        OR: matchAnyNeedle,
      },
    ];

    if (constraints.localityId) {
      and.push({
        OR: [{ localityId: null }, { localityId: constraints.localityId }],
      });
    }
    if (constraints.specialtyId) {
      and.push({
        OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
      });
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  private buildMeetingWhere(
    query: string,
    tokens: string[],
    constraints: { localityId?: string; specialtyId?: string },
  ): Prisma.MeetingWhereInput {
    const needles = this.buildNeedles(query, tokens);
    const matchAnyNeedle: Prisma.MeetingWhereInput[] = needles.flatMap(
      (needle) => [
        { scope: { contains: needle, mode: 'insensitive' } },
        { agenda: { contains: needle, mode: 'insensitive' } },
        { location: { contains: needle, mode: 'insensitive' } },
      ],
    );

    const and: Prisma.MeetingWhereInput[] = [
      {
        OR: matchAnyNeedle,
      },
    ];

    if (constraints.localityId) {
      and.push({
        OR: [{ localityId: null }, { localityId: constraints.localityId }],
      });
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  private buildLocalityWhere(
    query: string,
    tokens: string[],
    constraints: { localityId?: string; specialtyId?: string },
  ): Prisma.LocalityWhereInput {
    const needles = this.buildNeedles(query, tokens);
    const matchAnyNeedle: Prisma.LocalityWhereInput[] = needles.flatMap(
      (needle) => [
        { name: { contains: needle, mode: 'insensitive' } },
        { code: { contains: needle, mode: 'insensitive' } },
      ],
    );

    const and: Prisma.LocalityWhereInput[] = [
      { catalogType: LocalityCatalogType.SMIF },
      {
        OR: matchAnyNeedle,
      },
    ];

    if (constraints.localityId) and.push({ id: constraints.localityId });
    return { AND: and };
  }

  private buildDocumentWhere(
    query: string,
    tokens: string[],
    user?: RbacUser,
  ): Prisma.DocumentAssetWhereInput {
    const needles = this.buildNeedles(query, tokens);
    const matchAnyNeedle: Prisma.DocumentAssetWhereInput[] = needles.flatMap(
      (needle) => [
        { title: { contains: needle, mode: 'insensitive' } },
        { sourcePath: { contains: needle, mode: 'insensitive' } },
        { fileName: { contains: needle, mode: 'insensitive' } },
        {
          subcategory: { name: { contains: needle, mode: 'insensitive' } },
        },
      ],
    );

    const and: Prisma.DocumentAssetWhereInput[] = [
      {
        OR: matchAnyNeedle,
      },
    ];

    const scopeWhere = this.documentScopeWhere(user);
    if (Object.keys(scopeWhere).length > 0) and.push(scopeWhere);

    return and.length === 1 ? and[0] : { AND: and };
  }

  private buildTaskViewAccessWhere(
    user?: RbacUser,
  ): Prisma.TaskInstanceWhereInput {
    if (!user?.id) return {};
    const profile = resolveAccessProfile(user);

    if (profile.ti || profile.nationalCommission) return {};
    if (profile.localityAdmin && profile.localityId) {
      return { localityId: profile.localityId };
    }

    if (profile.specialtyAdmin) {
      const and: Prisma.TaskInstanceWhereInput[] = [];
      if (profile.localityId) and.push({ localityId: profile.localityId });

      const groupOr: Prisma.TaskInstanceWhereInput[] = [];
      if (profile.groupSpecialtyId) {
        groupOr.push({
          OR: [
            { specialtyId: null },
            { specialtyId: profile.groupSpecialtyId },
          ],
        });
      }
      if (profile.groupEloRoleId) {
        groupOr.push({ eloRoleId: profile.groupEloRoleId });
        groupOr.push({ assignedElo: { eloRoleId: profile.groupEloRoleId } });
      }
      if (groupOr.length > 0) and.push({ OR: groupOr });
      if (and.length === 0) return { id: '__forbidden__' };
      return and.length === 1 ? and[0] : { AND: and };
    }

    const viewerOr: Prisma.TaskInstanceWhereInput[] = [
      { assignedToId: user.id },
      { responsibles: { some: { userId: user.id } } },
    ];

    if (user.localityId) {
      const groupOr: Prisma.TaskInstanceWhereInput[] = [];
      if (user.specialtyId) {
        groupOr.push({
          OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }],
        });
      }
      if (user.eloRoleId) {
        groupOr.push({ eloRoleId: user.eloRoleId });
        groupOr.push({ assignedElo: { eloRoleId: user.eloRoleId } });
      }
      if (groupOr.length > 0) {
        viewerOr.push({
          localityId: user.localityId,
          OR: groupOr,
        });
      }
    }
    return { OR: viewerOr };
  }

  private isAdminUser(user?: RbacUser): boolean {
    if (!user) return false;
    const hasPermissionEntry = (resource: string, action: string) =>
      user.permissions.some(
        (permission) =>
          (permission.resource === resource || permission.resource === '*') &&
          (permission.action === action || permission.action === '*'),
      );

    if (
      hasPermissionEntry('roles', 'view') ||
      hasPermissionEntry('roles', 'update') ||
      hasPermissionEntry('admin_rbac', 'export')
    ) {
      return true;
    }

    return user.roles.some((role) => role.name.toLowerCase().includes('admin'));
  }

  private shouldApplyDocumentLocalityScope(user?: RbacUser): boolean {
    if (!user?.localityId) return false;
    if (this.isAdminUser(user)) return false;

    const hasNationalDocumentsViewScope = user.permissions.some(
      (permission) =>
        (permission.resource === 'documents' || permission.resource === '*') &&
        (permission.action === 'view' || permission.action === '*') &&
        permission.scope === PermissionScope.NATIONAL,
    );

    return !hasNationalDocumentsViewScope;
  }

  private documentScopeWhere(user?: RbacUser): Prisma.DocumentAssetWhereInput {
    if (!this.shouldApplyDocumentLocalityScope(user)) return {};
    return {
      OR: [{ localityId: null }, { localityId: user?.localityId as string }],
    };
  }

  private resolveTaskTitle(task: {
    titleOverride?: string | null;
    taskTemplate?: { title?: string | null } | null;
  }) {
    const titleOverride = String(task.titleOverride ?? '').trim();
    if (titleOverride) return titleOverride;
    return String(task.taskTemplate?.title ?? '').trim() || 'Tarefa';
  }

  private extractQueryTokens(query: string) {
    const tokens = new Set<string>();
    for (const rawToken of query.split(/\s+/)) {
      const token = String(rawToken ?? '')
        .trim()
        .toLowerCase();
      if (token.length < 3) continue;
      const variants = new Set<string>([
        token,
        token.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      ]);

      for (const variant of Array.from(variants)) {
        if (!variant) continue;
        // Heurística simples para reduzir plural/sufixos muito comuns.
        if (variant.endsWith('es') && variant.length >= 6) {
          variants.add(variant.slice(0, -2));
        }
        if (variant.endsWith('s') && variant.length >= 5) {
          variants.add(variant.slice(0, -1));
        }
      }

      for (const variant of variants) {
        const clean = String(variant ?? '').trim();
        if (clean.length >= 3) tokens.add(clean);
      }
    }
    return Array.from(tokens).slice(0, 8);
  }

  private buildNeedles(query: string, tokens: string[]): string[] {
    const needles = new Set<string>();
    const full = String(query ?? '').trim();
    if (full) {
      needles.add(full);
      needles.add(full.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    }
    for (const token of tokens) {
      const clean = String(token ?? '').trim();
      if (!clean) continue;
      needles.add(clean);
    }
    return Array.from(needles);
  }

  private async buildSemanticResults(args: {
    query: string;
    user?: RbacUser;
    payload: LegacySearchPayload;
  }): Promise<SemanticSearchPayload> {
    const candidates = this.buildSemanticCandidates(
      args.query,
      args.payload,
      args.user,
    )
      .sort((a, b) => b.fallbackProbability - a.fallbackProbability)
      .slice(0, this.maxSemanticCandidates);

    if (candidates.length === 0) {
      return { usedAi: false, model: null, items: [] };
    }

    const aiRank = await this.rankWithAi(args.query, candidates);
    const orderedByFallback = [...candidates].sort(
      (a, b) => b.fallbackProbability - a.fallbackProbability,
    );

    const merged = new Map<string, SemanticSearchItem>();
    if (aiRank?.results?.length) {
      for (const result of aiRank.results) {
        const candidate = candidates.find(
          (item) => item.candidateId === result.candidateId,
        );
        if (!candidate) continue;
        merged.set(candidate.candidateId, {
          id: candidate.id,
          entityType: candidate.entityType,
          entityTypeLabel: candidate.entityTypeLabel,
          title: candidate.title,
          subtitle: candidate.subtitle,
          url: candidate.url,
          probability: result.probability,
        });
        if (merged.size >= this.maxSemanticResults) break;
      }
    }

    for (const fallback of orderedByFallback) {
      if (merged.size >= this.maxSemanticResults) break;
      if (merged.has(fallback.candidateId)) continue;
      merged.set(fallback.candidateId, {
        id: fallback.id,
        entityType: fallback.entityType,
        entityTypeLabel: fallback.entityTypeLabel,
        title: fallback.title,
        subtitle: fallback.subtitle,
        url: fallback.url,
        probability: fallback.fallbackProbability,
      });
    }

    const items = Array.from(merged.values())
      .sort((a, b) => b.probability - a.probability)
      .slice(0, this.maxSemanticResults);

    return {
      usedAi: Boolean(aiRank?.results?.length),
      model: aiRank?.model ?? null,
      items,
    };
  }

  private buildSemanticCandidates(
    query: string,
    payload: LegacySearchPayload,
    user?: RbacUser,
  ): SemanticCandidate[] {
    const candidates: SemanticCandidate[] = [];
    const pushCandidate = (
      candidate: Omit<SemanticCandidate, 'fallbackProbability'>,
    ) => {
      if (!this.isAllowedSearchUrl(candidate.url)) return;
      const fallbackProbability = this.fallbackProbability(query, [
        candidate.title,
        candidate.subtitle ?? '',
        candidate.entityTypeLabel,
        ...candidate.keywords,
      ]);
      candidates.push({
        ...candidate,
        fallbackProbability,
      });
    };

    for (const screen of SEARCH_SCREEN_CANDIDATES) {
      if (screen.isAllowed && !screen.isAllowed(user)) continue;
      pushCandidate({
        candidateId: `screen:${screen.id}`,
        id: screen.id,
        entityType: 'SCREEN',
        entityTypeLabel: screen.entityTypeLabel,
        title: screen.title,
        subtitle: screen.subtitle,
        url: screen.path,
        keywords: screen.keywords,
      });
    }

    for (const task of payload.tasks) {
      pushCandidate({
        candidateId: `task:${task.id}`,
        id: task.id,
        entityType: 'TASK',
        entityTypeLabel: 'Tarefa',
        title: task.title,
        subtitle: task.localityName || null,
        url: `/tasks?scope=${encodeURIComponent(
          String(task.scope ?? 'SMIF'),
        )}&taskId=${encodeURIComponent(task.id)}`,
        keywords: [task.status, task.localityName ?? ''],
      });
    }

    for (const meeting of payload.meetings) {
      pushCandidate({
        candidateId: `meeting:${meeting.id}`,
        id: meeting.id,
        entityType: 'MEETING',
        entityTypeLabel: 'Reunião',
        title: meeting.scope?.trim() || 'Reunião',
        subtitle: meeting.datetime?.toISOString() ?? null,
        url: `/meetings?meetingId=${encodeURIComponent(meeting.id)}`,
        keywords: [meeting.status],
      });
    }

    for (const locality of payload.localities) {
      pushCandidate({
        candidateId: `locality:${locality.id}`,
        id: locality.id,
        entityType: 'LOCALITY',
        entityTypeLabel: 'Localidade',
        title: locality.name,
        subtitle: locality.code || null,
        url: `/dashboard/locality/${encodeURIComponent(locality.id)}`,
        keywords: [locality.code],
      });
    }

    for (const document of payload.documents) {
      pushCandidate({
        candidateId: `document:${document.id}`,
        id: document.id,
        entityType: 'DOCUMENT',
        entityTypeLabel: 'Documento',
        title: document.title,
        subtitle: document.localityName ?? null,
        url: `/documents?docId=${encodeURIComponent(document.id)}`,
        keywords: [document.category, document.fileName],
      });
    }

    return candidates;
  }

  private isAllowedSearchUrl(url: string) {
    const parsed = this.parseSearchUrl(url);
    if (!parsed) return false;
    const { pathname, queryKeys } = parsed;

    for (const entry of SEARCH_SCREEN_ALLOWED_ROUTES) {
      if (!this.searchRouteMatches(pathname, entry)) continue;
      if (!this.searchRouteQueryAllowed(queryKeys, entry)) continue;
      return true;
    }
    return false;
  }

  private parseSearchUrl(url: string): {
    pathname: string;
    queryKeys: Set<string>;
  } | null {
    try {
      const parsed = new URL(url, 'https://_placeholder');
      const pathname = (parsed.pathname || '/').replace(/\/+$/, '').trim();
      const queryKeys = new Set(Array.from(parsed.searchParams.keys()));
      return { pathname, queryKeys };
    } catch {
      return null;
    }
  }

  private searchRouteMatches(
    pathname: string,
    entry: RouteWhitelistEntry,
  ): boolean {
    const candidatePath = pathname || '/';
    if (entry.allowDynamicSuffix) {
      if (candidatePath === entry.path) return true;
      if (!candidatePath.startsWith(`${entry.path}/`)) return false;
      const parts = candidatePath
        .slice(entry.path.length)
        .split('/')
        .filter(Boolean);
      return parts.length === 1;
    }
    return candidatePath === entry.path;
  }

  private searchRouteQueryAllowed(
    queryKeys: Set<string>,
    entry: RouteWhitelistEntry,
  ): boolean {
    if (!entry.allowedQueryKeys) {
      return queryKeys.size === 0;
    }
    for (const key of queryKeys) {
      if (!entry.allowedQueryKeys.has(key)) return false;
    }
    return true;
  }

  private async rankWithAi(
    query: string,
    candidates: SemanticCandidate[],
  ): Promise<{
    model: string;
    results: Array<{ candidateId: string; probability: number }>;
  } | null> {
    if (!this.litellm.isConfigured()) return null;

    const compactCandidates = candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      type: candidate.entityTypeLabel,
      title: String(candidate.title ?? '').slice(0, 180),
      subtitle: String(candidate.subtitle ?? '').slice(0, 180),
      url: candidate.url,
      keywords: candidate.keywords
        .map((keyword) => String(keyword ?? '').trim())
        .filter(Boolean)
        .slice(0, 4),
    }));

    const prompt = JSON.stringify(
      {
        query,
        candidates: compactCandidates,
      },
      null,
      2,
    );

    try {
      const { content, model } = await this.litellm.chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Você é um motor de ranking semântico para busca interna. ' +
              'Responda estritamente em JSON válido, sem markdown e sem texto extra.',
          },
          {
            role: 'user',
            content:
              'Classifique os candidatos mais prováveis para a consulta do usuário.\n' +
              'Regras obrigatórias:\n' +
              '- Use apenas candidateId da lista.\n' +
              '- Não invente links nem IDs.\n' +
              '- Priorize os candidatos que melhor representem a intenção semântica da frase.\n' +
              '- Retorne no máximo 15 resultados.\n' +
              '- probability deve ser número entre 0 e 1.\n' +
              '- Ordene por probability desc.\n' +
              'Formato obrigatório de saída JSON:\n' +
              '{ "results": [ { "candidateId": "...", "probability": 0.0 } ] }\n\n' +
              prompt,
          },
        ],
        temperature: 0,
        max_tokens: 900,
      });

      const parsed = this.parseSemanticResponse(content);
      if (!parsed?.length) return null;

      const candidateIdSet = new Set(
        candidates.map((item) => item.candidateId),
      );
      const dedup = new Map<
        string,
        { candidateId: string; probability: number }
      >();
      for (const item of parsed) {
        if (!candidateIdSet.has(item.candidateId)) continue;
        if (dedup.has(item.candidateId)) continue;
        dedup.set(item.candidateId, item);
      }

      return {
        model,
        results: Array.from(dedup.values()).sort(
          (a, b) => b.probability - a.probability,
        ),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Busca semântica IA indisponível: ${message}`);
      return null;
    }
  }

  private parseSemanticResponse(
    raw: string,
  ): Array<{ candidateId: string; probability: number }> | null {
    const parsed = this.parseJsonLoose(raw);
    if (parsed == null) return null;

    const list = Array.isArray(parsed)
      ? parsed
      : this.isRecord(parsed) && Array.isArray(parsed.results)
        ? parsed.results
        : null;
    if (!list) return null;

    const items: Array<{ candidateId: string; probability: number }> = [];
    for (const row of list) {
      if (!this.isRecord(row)) continue;
      const candidateIdValue = row.candidateId;
      if (
        typeof candidateIdValue !== 'string' &&
        typeof candidateIdValue !== 'number'
      ) {
        continue;
      }
      const candidateId = String(candidateIdValue).trim();
      if (!candidateId) continue;
      const probabilityRaw = Number(row.probability);
      if (!Number.isFinite(probabilityRaw)) continue;
      const probability = Math.max(0, Math.min(1, probabilityRaw));
      items.push({
        candidateId,
        probability: Number(probability.toFixed(4)),
      });
    }
    return items;
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

  private fallbackProbability(query: string, fragments: string[]) {
    const normalizedQuery = this.normalizeSearchText(query);
    const normalizedContent = this.normalizeSearchText(fragments.join(' '));
    if (!normalizedQuery || !normalizedContent) return 0.05;

    const tokens = normalizedQuery
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);

    let score = 0;
    if (normalizedContent.includes(normalizedQuery)) score += 0.55;

    const uniqueTokenMatches = new Set<string>();
    for (const token of tokens) {
      if (normalizedContent.includes(token)) {
        uniqueTokenMatches.add(token);
        score += 0.12;
      }
    }

    if (tokens.length > 0 && uniqueTokenMatches.size === tokens.length) {
      score += 0.18;
    }

    return Number(Math.max(0.05, Math.min(0.98, score)).toFixed(4));
  }

  private normalizeSearchText(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return {};
    if (profile.localityAdmin) {
      return {
        localityId: profile.localityId ?? undefined,
        specialtyId: undefined,
      };
    }
    if (profile.specialtyAdmin) {
      return {
        localityId: profile.localityId ?? undefined,
        specialtyId: profile.groupSpecialtyId ?? undefined,
      };
    }
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
    };
  }
}
