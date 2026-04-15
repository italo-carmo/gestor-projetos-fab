import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BiImportFormat, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parsePagination } from '../common/pagination';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import {
  BI_NORMALIZATION_SOURCE_TYPES,
  BiNormalizationService,
} from './bi-normalization.service';

type DomesticViolenceFilters = {
  from?: string;
  to?: string;
  organization?: string;
  rank?: string;
  maritalStatus?: string;
  education?: string;
  naturality?: string;
  fabBond?: string;
  situationScope?: string;
  sufferedLifetime?: string;
  sufferedLast12Months?: string;
  frequency?: string;
  affectiveBond?: string;
  violenceType?: string;
  authorRelation?: string;
  impactIntensity?: string;
  impactArea?: string;
  soughtHelp?: string;
  complaintChannel?: string;
  noComplaintReason?: string;
  authorMilitaryLink?: string;
  occurrencePlace?: string;
  witnesses?: string;
  responseId?: string;
  q?: string;
  combineMode?: string;
};

type ImportDomesticViolenceOptions = {
  replaceAll?: boolean;
};

type DomesticViolenceCardSettingInput = {
  title?: string;
  description?: string | null;
};

type ParsedDomesticViolenceRow = {
  submittedAt: Date | null;
  age: number | null;
  organization: string | null;
  maritalStatus: string | null;
  education: string | null;
  naturality: string | null;
  fabBond: string | null;
  rank: string | null;
  situationScope: string | null;
  sufferedLifetimeRaw: string | null;
  sufferedLifetime: boolean | null;
  sufferedLast12MonthsRaw: string | null;
  sufferedLast12Months: boolean | null;
  frequency: string | null;
  affectiveBond: string | null;
  violenceTypes: string[];
  authorRelation: string | null;
  authorMilitaryLink: string | null;
  occurrencePlace: string | null;
  witnessesRaw: string | null;
  witnesses: boolean | null;
  impactIntensity: string | null;
  impactAreas: string[];
  soughtHelpRaw: string | null;
  soughtHelp: boolean | null;
  complaintChannels: string[];
  noComplaintReasons: string[];
  rawPayload: Prisma.InputJsonValue;
  sourceRow: number;
  sourceHash: string;
};

const DOMESTIC_VIOLENCE_TYPE_OPTIONS = [
  'Psicológica',
  'Moral',
  'Física',
  'Sexual',
  'Patrimonial',
] as const;

const IMPACT_AREA_OPTIONS = [
  'Saúde mental',
  'Saúde física',
  'Vida pessoal',
  'Vida social',
  'Vida profissional',
] as const;

const COMPLAINT_CHANNEL_OPTIONS = [
  'Foi a Delegacia',
  'Ligou para polícia (190)',
  'Apoio institucional',
  'Disque 180',
  'Não procurei',
  'Não denunciei',
] as const;

const NO_REPORT_REASON_OPTIONS = [
  'Medo de retaliação',
  'Vergonha ou constrangimento',
  'Falta de confiança nas instâncias de denúncia',
  'Percepção de que "não adiantaria" denunciar',
  'Desejo de preservar a imagem pessoal ou da família',
  'Receio de prejudicar a carreira de alguém',
  'Pressão familiar ou social para não denunciar',
  'Considerou tratar-se de um episódio sem gravidade',
  'Não identificou, na época, que era um ato de violência',
  'Prefiro não responder',
] as const;

const YES_NO_FILTER_OPTIONS = [
  { value: 'SIM', label: 'Sim' },
  { value: 'NAO', label: 'Não' },
];

const DOMESTIC_VIOLENCE_CARD_IDS = new Set([
  'page-header',
  'panel-ingestion',
  'panel-filters',
  'kpi-total',
  'kpi-lifetime',
  'kpi-last12',
  'kpi-sought-help',
  'kpi-sought-help-rate',
  'kpi-recurring',
  'kpi-violence-mentions',
  'kpi-avg-types',
  'insight-main',
  'chart-lifetime-donut',
  'chart-last12-donut',
  'chart-marital-status',
  'chart-education',
  'chart-naturality',
  'chart-fab-bond',
  'chart-age-range',
  'chart-rank',
  'chart-organization',
  'chart-violence-type',
  'chart-impact-area',
  'chart-channel',
  'chart-no-report-reason',
  'chart-situation-scope',
  'chart-frequency',
  'chart-affective-bond',
  'chart-author-relation',
  'chart-author-military-link',
  'chart-occurrence-place',
  'chart-witnesses',
  'chart-sought-help',
  'chart-impact-intensity',
  'chart-violence-by-organization',
  'chart-response-trend',
  'list-responses',
  'list-imports',
]);

@Injectable()
export class BiDomesticViolenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: BiNormalizationService,
  ) {}

  async importResponses(
    file: Express.Multer.File,
    user?: RbacUser,
    options: ImportDomesticViolenceOptions = {},
  ) {
    const extension = this.fileExtension(file.originalname);
    const format =
      extension === 'csv' ? BiImportFormat.CSV : BiImportFormat.XLSX;
    const replaceAll = options.replaceAll === true;

    const { sheetName, rows } = this.extractRows(file.buffer, format);
    if (rows.length === 0) {
      throwError('VALIDATION_ERROR', { reason: 'empty_file' });
    }

    const [headerRow, ...dataRows] = rows;
    const headerMap = this.resolveHeaderMap(headerRow);

    const parsed: ParsedDomesticViolenceRow[] = [];
    let invalidRows = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      const parsedRow = this.parseDataRow(row, headerMap, index + 2);
      if (parsedRow.skip) continue;
      if (!parsedRow.value) {
        invalidRows += 1;
        continue;
      }
      parsed.push(parsedRow.value);
    }

    if (replaceAll) {
      await this.prisma.$transaction([
        this.prisma.biDomesticViolenceResponse.deleteMany(),
        this.prisma.biDomesticViolenceImportBatch.deleteMany(),
      ]);
    }

    const batch = await this.prisma.biDomesticViolenceImportBatch.create({
      data: {
        fileName: file.originalname,
        format,
        sheetName,
        totalRows: parsed.length,
        insertedRows: 0,
        duplicateRows: 0,
        invalidRows,
        importedById: user?.id ?? null,
      },
    });

    let insertedRows = 0;

    if (parsed.length > 0) {
      const created = await this.prisma.biDomesticViolenceResponse.createMany({
        data: parsed.map((item) => ({
          batchId: batch.id,
          submittedAt: item.submittedAt,
          age: item.age,
          organization: item.organization,
          maritalStatus: item.maritalStatus,
          education: item.education,
          naturality: item.naturality,
          fabBond: item.fabBond,
          rank: item.rank,
          situationScope: item.situationScope,
          sufferedLifetimeRaw: item.sufferedLifetimeRaw,
          sufferedLifetime: item.sufferedLifetime,
          sufferedLast12MonthsRaw: item.sufferedLast12MonthsRaw,
          sufferedLast12Months: item.sufferedLast12Months,
          frequency: item.frequency,
          affectiveBond: item.affectiveBond,
          violenceTypes: item.violenceTypes,
          authorRelation: item.authorRelation,
          authorMilitaryLink: item.authorMilitaryLink,
          occurrencePlace: item.occurrencePlace,
          witnessesRaw: item.witnessesRaw,
          witnesses: item.witnesses,
          impactIntensity: item.impactIntensity,
          impactAreas: item.impactAreas,
          soughtHelpRaw: item.soughtHelpRaw,
          soughtHelp: item.soughtHelp,
          complaintChannels: item.complaintChannels,
          noComplaintReasons: item.noComplaintReasons,
          rawPayload: item.rawPayload,
          sourceRow: item.sourceRow,
          sourceHash: item.sourceHash,
        })),
        skipDuplicates: true,
      });

      insertedRows = created.count;
    }

    const duplicateRows = parsed.length - insertedRows;

    const updatedBatch = await this.prisma.biDomesticViolenceImportBatch.update(
      {
        where: { id: batch.id },
        data: {
          insertedRows,
          duplicateRows,
        },
        include: {
          importedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    );

    await this.normalization.rebuild({
      sourceType: BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE,
    });

    return {
      batch: updatedBatch,
      preview: parsed.slice(0, 5).map((item) => ({
        submittedAt: item.submittedAt,
        age: item.age,
        organization: item.organization,
        rank: item.rank,
        naturality: item.naturality,
        situationScope: item.situationScope,
        sufferedLifetimeRaw: item.sufferedLifetimeRaw,
        sufferedLast12MonthsRaw: item.sufferedLast12MonthsRaw,
        affectiveBond: item.affectiveBond,
        violenceTypes: item.violenceTypes,
        authorRelation: item.authorRelation,
        impactIntensity: item.impactIntensity,
        soughtHelpRaw: item.soughtHelpRaw,
      })),
      importMode: replaceAll ? 'REPLACE' : 'APPEND',
    };
  }

  async listImports(filters: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.biDomesticViolenceImportBatch.findMany({
        include: {
          importedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ importedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.biDomesticViolenceImportBatch.count(),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async listResponses(
    filters: DomesticViolenceFilters & {
      page?: string;
      pageSize?: string;
    },
  ) {
    const where = this.buildWhere(filters);

    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.biDomesticViolenceResponse.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.biDomesticViolenceResponse.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async deleteResponses(
    payload: DomesticViolenceFilters & {
      ids?: string[];
      allFiltered?: boolean;
    },
  ) {
    const ids = (payload.ids ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    const allFiltered = Boolean(payload.allFiltered);

    if (!allFiltered && uniqueIds.length === 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'delete_requires_ids_or_filtered',
      });
    }

    if (allFiltered) {
      const where = this.buildWhere(payload);
      const deleted = await this.prisma.biDomesticViolenceResponse.deleteMany({
        where,
      });
      return {
        mode: 'FILTERED',
        deletedCount: deleted.count,
      };
    }

    const deleted = await this.prisma.biDomesticViolenceResponse.deleteMany({
      where: {
        id: { in: uniqueIds },
      },
    });

    return {
      mode: 'IDS',
      deletedCount: deleted.count,
    };
  }

  async listCardSettings() {
    const cardSettingModel = (this.prisma as any).biDomesticViolenceCardSetting;
    const items = await cardSettingModel.findMany({
      orderBy: { cardId: 'asc' },
      select: {
        cardId: true,
        title: true,
        description: true,
        updatedAt: true,
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      items,
    };
  }

  async updateCardSetting(
    cardIdRaw: string,
    payload: DomesticViolenceCardSettingInput,
    user?: RbacUser,
  ) {
    const cardId = String(cardIdRaw ?? '').trim();
    if (!DOMESTIC_VIOLENCE_CARD_IDS.has(cardId)) {
      throwError('VALIDATION_ERROR', {
        field: 'cardId',
        reason: 'invalid_card_id',
      });
    }

    const title = String(payload.title ?? '').trim();
    if (!title) {
      throwError('VALIDATION_ERROR', {
        field: 'title',
        reason: 'required',
      });
    }

    const descriptionRaw = payload.description;
    const description =
      descriptionRaw === undefined || descriptionRaw === null
        ? null
        : String(descriptionRaw).trim() || null;

    const cardSettingModel = (this.prisma as any).biDomesticViolenceCardSetting;

    const updated = await cardSettingModel.upsert({
      where: { cardId },
      create: {
        cardId,
        title,
        description,
        updatedById: user?.id ?? null,
      },
      update: {
        title,
        description,
        updatedById: user?.id ?? null,
      },
      select: {
        cardId: true,
        title: true,
        description: true,
        updatedAt: true,
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return updated;
  }

  async dashboard(filters: DomesticViolenceFilters) {
    const where = this.buildWhere(filters);
    const cardSettingModel = (this.prisma as any).biDomesticViolenceCardSetting;

    const [rows, allRowsForFilters, totalRowsInDb, latestImport, cardSettings] =
      await this.prisma.$transaction([
        this.prisma.biDomesticViolenceResponse.findMany({
          where,
          select: {
            id: true,
            submittedAt: true,
            age: true,
            organization: true,
            maritalStatus: true,
            education: true,
            naturality: true,
            fabBond: true,
            rank: true,
            situationScope: true,
            sufferedLifetime: true,
            sufferedLast12Months: true,
            frequency: true,
            affectiveBond: true,
            violenceTypes: true,
            authorRelation: true,
            authorMilitaryLink: true,
            occurrencePlace: true,
            witnesses: true,
            impactIntensity: true,
            impactAreas: true,
            soughtHelp: true,
            complaintChannels: true,
            noComplaintReasons: true,
          },
        }),
        this.prisma.biDomesticViolenceResponse.findMany({
          select: {
            organization: true,
            rank: true,
            maritalStatus: true,
            education: true,
            naturality: true,
            fabBond: true,
            situationScope: true,
            sufferedLifetime: true,
            sufferedLast12Months: true,
            frequency: true,
            affectiveBond: true,
            violenceTypes: true,
            authorRelation: true,
            impactIntensity: true,
            impactAreas: true,
            soughtHelp: true,
            complaintChannels: true,
            noComplaintReasons: true,
            authorMilitaryLink: true,
            occurrencePlace: true,
            witnesses: true,
          },
        }),
        this.prisma.biDomesticViolenceResponse.count(),
        this.prisma.biDomesticViolenceImportBatch.findFirst({
          orderBy: { importedAt: 'desc' },
          include: {
            importedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        cardSettingModel.findMany({
          orderBy: { cardId: 'asc' },
          select: {
            cardId: true,
            title: true,
            description: true,
            updatedAt: true,
            updatedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);

    const total = rows.length;
    const lifetimeYesCount = rows.filter(
      (row) => row.sufferedLifetime === true,
    ).length;
    const lifetimeNoCount = rows.filter(
      (row) => row.sufferedLifetime === false,
    ).length;
    const lifetimeUnknownCount = total - lifetimeYesCount - lifetimeNoCount;

    const last12MonthsYesCount = rows.filter(
      (row) => row.sufferedLast12Months === true,
    ).length;
    const last12MonthsNoCount = rows.filter(
      (row) => row.sufferedLast12Months === false,
    ).length;
    const last12MonthsUnknownCount =
      total - last12MonthsYesCount - last12MonthsNoCount;

    const soughtHelpYesCount = rows.filter(
      (row) => row.soughtHelp === true,
    ).length;

    const totalViolenceMentions = rows.reduce(
      (acc, row) => acc + row.violenceTypes.length,
      0,
    );

    const recurringCount = rows.filter((row) =>
      this.compact(row.frequency ?? '').includes('RECORRENTE'),
    ).length;

    const avgTypesPerVictim =
      lifetimeYesCount > 0
        ? Number((totalViolenceMentions / lifetimeYesCount).toFixed(2))
        : 0;

    const violenceTypeDistribution = this.buildArrayDistribution(
      rows,
      (row) => row.violenceTypes,
      'type',
    );
    const impactAreaDistribution = this.buildArrayDistribution(
      rows,
      (row) => row.impactAreas,
      'area',
    );
    const complaintChannelDistribution = this.buildArrayDistribution(
      rows,
      (row) => row.complaintChannels,
      'channel',
    );
    const noComplaintReasonDistribution = this.buildArrayDistribution(
      rows,
      (row) => row.noComplaintReasons,
      'reason',
    );

    const organizationDistribution = this.buildDistribution(
      rows,
      (row) => row.organization ?? 'Não informado',
      'organization',
    );
    const rankDistribution = this.buildDistribution(
      rows,
      (row) => row.rank ?? 'Não informado',
      'rank',
    );
    const maritalStatusDistribution = this.buildDistribution(
      rows,
      (row) => row.maritalStatus ?? 'Não informado',
      'maritalStatus',
    );
    const educationDistribution = this.buildDistribution(
      rows,
      (row) => row.education ?? 'Não informado',
      'education',
    );
    const naturalityDistribution = this.buildDistribution(
      rows,
      (row) => row.naturality ?? 'Não informado',
      'naturality',
    );
    const fabBondDistribution = this.buildDistribution(
      rows,
      (row) => row.fabBond ?? 'Não informado',
      'fabBond',
    );
    const ageRangeDistribution = this.buildDistribution(
      rows,
      (row) => this.ageRange(row.age),
      'range',
    );
    const situationScopeDistribution = this.buildDistribution(
      rows,
      (row) => row.situationScope ?? 'Não informado',
      'situationScope',
    );
    const frequencyDistribution = this.buildDistribution(
      rows,
      (row) => row.frequency ?? 'Não informado',
      'frequency',
    );
    const affectiveBondDistribution = this.buildDistribution(
      rows,
      (row) => row.affectiveBond ?? 'Não informado',
      'affectiveBond',
    );
    const authorRelationDistribution = this.buildDistribution(
      rows,
      (row) => row.authorRelation ?? 'Não informado',
      'authorRelation',
    );
    const authorMilitaryLinkDistribution = this.buildDistribution(
      rows,
      (row) => row.authorMilitaryLink ?? 'Não informado',
      'authorMilitaryLink',
    );
    const occurrencePlaceDistribution = this.buildDistribution(
      rows,
      (row) => row.occurrencePlace ?? 'Não informado',
      'occurrencePlace',
    );
    const witnessesDistribution = this.buildDistribution(
      rows,
      (row) => this.booleanLabel(row.witnesses),
      'witnessesLabel',
    );
    const soughtHelpDistribution = this.buildDistribution(
      rows,
      (row) => this.booleanLabel(row.soughtHelp),
      'soughtHelpLabel',
    );
    const impactIntensityDistribution = this.buildDistribution(
      rows,
      (row) => row.impactIntensity ?? 'Não informado',
      'level',
    );

    const violenceByOrganization = this.buildViolenceByOrganization(rows);
    const responseTrend = this.buildResponseTrend(rows);

    const organizationRisk = this.buildOrganizationRisk(rows);
    const topViolenceType = violenceTypeDistribution[0] ?? null;
    const highestOrganizationRisk = organizationRisk[0] ?? null;
    const mostImpactedArea = impactAreaDistribution[0] ?? null;
    const mainNoReportReason = noComplaintReasonDistribution[0] ?? null;

    const preferredChannel =
      complaintChannelDistribution.find((item) => {
        const normalized = this.compact(String(item.channel ?? ''));
        return normalized !== 'NAOPROCUREI' && normalized !== 'NAODENUNCIEI';
      }) ??
      complaintChannelDistribution[0] ??
      null;

    return {
      kpis: {
        totalResponses: total,
        totalRowsInDb,
        lifetimeYesCount,
        lifetimeNoCount,
        lifetimeUnknownCount,
        last12MonthsYesCount,
        last12MonthsNoCount,
        last12MonthsUnknownCount,
        soughtHelpYesCount,
        soughtHelpRatePercent:
          lifetimeYesCount > 0
            ? Number(((soughtHelpYesCount / lifetimeYesCount) * 100).toFixed(2))
            : 0,
        recurringCount,
        recurringRatePercent:
          lifetimeYesCount > 0
            ? Number(((recurringCount / lifetimeYesCount) * 100).toFixed(2))
            : 0,
        totalViolenceMentions,
        avgTypesPerVictim,
      },
      filters: this.buildAvailableFilters(allRowsForFilters),
      charts: {
        lifetimeDonut: [
          {
            label: 'Não',
            count: lifetimeNoCount,
            percent:
              total > 0
                ? Number(((lifetimeNoCount / total) * 100).toFixed(2))
                : 0,
          },
          {
            label: 'Sim',
            count: lifetimeYesCount,
            percent:
              total > 0
                ? Number(((lifetimeYesCount / total) * 100).toFixed(2))
                : 0,
          },
          {
            label: 'Não informado',
            count: lifetimeUnknownCount,
            percent:
              total > 0
                ? Number(((lifetimeUnknownCount / total) * 100).toFixed(2))
                : 0,
          },
        ],
        last12MonthsDonut: [
          {
            label: 'Não',
            count: last12MonthsNoCount,
            percent:
              total > 0
                ? Number(((last12MonthsNoCount / total) * 100).toFixed(2))
                : 0,
          },
          {
            label: 'Sim',
            count: last12MonthsYesCount,
            percent:
              total > 0
                ? Number(((last12MonthsYesCount / total) * 100).toFixed(2))
                : 0,
          },
          {
            label: 'Não informado',
            count: last12MonthsUnknownCount,
            percent:
              total > 0
                ? Number(((last12MonthsUnknownCount / total) * 100).toFixed(2))
                : 0,
          },
        ],
        violenceTypeDistribution,
        organizationDistribution,
        rankDistribution,
        maritalStatusDistribution,
        educationDistribution,
        naturalityDistribution,
        fabBondDistribution,
        ageRangeDistribution,
        situationScopeDistribution,
        frequencyDistribution,
        affectiveBondDistribution,
        authorRelationDistribution,
        authorMilitaryLinkDistribution,
        occurrencePlaceDistribution,
        witnessesDistribution,
        soughtHelpDistribution,
        impactIntensityDistribution,
        impactAreaDistribution,
        complaintChannelDistribution,
        noComplaintReasonDistribution,
        violenceByOrganization,
        responseTrend,
      },
      insights: {
        topViolenceType: topViolenceType
          ? {
              type: String(topViolenceType.type),
              mentions: Number(topViolenceType.count),
              sharePercent: Number(topViolenceType.percent),
            }
          : null,
        highestOrganizationRisk: highestOrganizationRisk
          ? {
              organization: highestOrganizationRisk.organization,
              lifetimeRatePercent: highestOrganizationRisk.lifetimeRatePercent,
              total: highestOrganizationRisk.total,
            }
          : null,
        mostImpactedArea: mostImpactedArea
          ? {
              area: String(mostImpactedArea.area),
              mentions: Number(mostImpactedArea.count),
              sharePercent: Number(mostImpactedArea.percent),
            }
          : null,
        mainNoReportReason: mainNoReportReason
          ? {
              reason: String(mainNoReportReason.reason),
              mentions: Number(mainNoReportReason.count),
              sharePercent: Number(mainNoReportReason.percent),
            }
          : null,
        preferredChannel: preferredChannel
          ? {
              channel: String(preferredChannel.channel),
              mentions: Number(preferredChannel.count),
              sharePercent: Number(preferredChannel.percent),
            }
          : null,
      },
      cardSettings,
      latestImport,
    };
  }

  private buildAvailableFilters(
    rows: Array<{
      organization: string | null;
      rank: string | null;
      maritalStatus: string | null;
      education: string | null;
      naturality: string | null;
      fabBond: string | null;
      situationScope: string | null;
      sufferedLifetime: boolean | null;
      sufferedLast12Months: boolean | null;
      frequency: string | null;
      affectiveBond: string | null;
      violenceTypes: string[];
      authorRelation: string | null;
      impactIntensity: string | null;
      impactAreas: string[];
      soughtHelp: boolean | null;
      complaintChannels: string[];
      noComplaintReasons: string[];
      authorMilitaryLink: string | null;
      occurrencePlace: string | null;
      witnesses: boolean | null;
    }>,
  ) {
    const organization = new Set<string>();
    const rank = new Set<string>();
    const maritalStatus = new Set<string>();
    const education = new Set<string>();
    const naturality = new Set<string>();
    const fabBond = new Set<string>();
    const situationScope = new Set<string>();
    const frequency = new Set<string>();
    const affectiveBond = new Set<string>();
    const violenceTypes = new Set<string>();
    const authorRelation = new Set<string>();
    const impactIntensity = new Set<string>();
    const impactAreas = new Set<string>();
    const complaintChannels = new Set<string>();
    const noComplaintReasons = new Set<string>();
    const authorMilitaryLink = new Set<string>();
    const occurrencePlace = new Set<string>();

    for (const row of rows) {
      if (row.organization?.trim()) organization.add(row.organization.trim());
      if (row.rank?.trim()) rank.add(row.rank.trim());
      if (row.maritalStatus?.trim())
        maritalStatus.add(row.maritalStatus.trim());
      if (row.education?.trim()) education.add(row.education.trim());
      if (row.naturality?.trim()) naturality.add(row.naturality.trim());
      if (row.fabBond?.trim()) fabBond.add(row.fabBond.trim());
      if (row.situationScope?.trim()) {
        situationScope.add(row.situationScope.trim());
      }
      if (row.frequency?.trim()) frequency.add(row.frequency.trim());
      if (row.affectiveBond?.trim()) {
        affectiveBond.add(row.affectiveBond.trim());
      }
      if (row.authorRelation?.trim()) {
        authorRelation.add(row.authorRelation.trim());
      }
      if (row.impactIntensity?.trim()) {
        impactIntensity.add(row.impactIntensity.trim());
      }
      if (row.authorMilitaryLink?.trim()) {
        authorMilitaryLink.add(row.authorMilitaryLink.trim());
      }
      if (row.occurrencePlace?.trim()) {
        occurrencePlace.add(row.occurrencePlace.trim());
      }

      for (const type of row.violenceTypes) {
        if (type.trim()) violenceTypes.add(type.trim());
      }
      for (const area of row.impactAreas) {
        if (area.trim()) impactAreas.add(area.trim());
      }
      for (const channel of row.complaintChannels) {
        if (channel.trim()) complaintChannels.add(channel.trim());
      }
      for (const reason of row.noComplaintReasons) {
        if (reason.trim()) noComplaintReasons.add(reason.trim());
      }
    }

    return {
      organization: [...organization].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      rank: [...rank].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      maritalStatus: [...maritalStatus].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      education: [...education].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      naturality: [...naturality].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      fabBond: [...fabBond].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      situationScope: [...situationScope].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      frequency: [...frequency].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      affectiveBond: [...affectiveBond].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      violenceTypes: [...violenceTypes].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      authorRelation: [...authorRelation].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      impactIntensity: [...impactIntensity].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      impactAreas: [...impactAreas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      complaintChannels: [...complaintChannels].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      noComplaintReasons: [...noComplaintReasons].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      authorMilitaryLink: [...authorMilitaryLink].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      occurrencePlace: [...occurrencePlace].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      sufferedLifetime: YES_NO_FILTER_OPTIONS,
      sufferedLast12Months: YES_NO_FILTER_OPTIONS,
      soughtHelp: YES_NO_FILTER_OPTIONS,
      witnesses: YES_NO_FILTER_OPTIONS,
    };
  }

  private buildDistribution<T>(
    rows: T[],
    keySelector: (row: T) => string,
    keyName: string,
  ) {
    const map = new Map<string, number>();

    for (const row of rows) {
      const key = keySelector(row);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const total = rows.length;

    return [...map.entries()]
      .map(([label, count]) => ({
        [keyName]: label,
        label,
        count,
        percent: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private buildArrayDistribution<T>(
    rows: T[],
    keySelector: (row: T) => string[],
    keyName: string,
  ) {
    const map = new Map<string, number>();

    for (const row of rows) {
      for (const item of keySelector(row)) {
        const key = item.trim();
        if (!key) continue;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }

    const totalMentions = [...map.values()].reduce(
      (sum, value) => sum + value,
      0,
    );

    return [...map.entries()]
      .map(([label, count]) => ({
        [keyName]: label,
        label,
        count,
        percent:
          totalMentions > 0
            ? Number(((count / totalMentions) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private buildViolenceByOrganization(
    rows: Array<{
      organization: string | null;
      violenceTypes: string[];
    }>,
  ) {
    const byType = new Map<string, number>();
    const byOrganization = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const organization = row.organization?.trim() || 'Não informado';
      const counters = byOrganization.get(organization) ?? {};
      for (const type of row.violenceTypes) {
        const currentType = type.trim();
        if (!currentType) continue;
        counters[currentType] = (counters[currentType] ?? 0) + 1;
        byType.set(currentType, (byType.get(currentType) ?? 0) + 1);
      }
      byOrganization.set(organization, counters);
    }

    const types = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);

    const items = [...byOrganization.entries()]
      .map(([organization, counters]) => {
        const total = types.reduce(
          (sum, type) => sum + (counters[type] ?? 0),
          0,
        );
        const row: Record<string, string | number> = {
          organization,
          total,
        };

        for (const type of types) {
          const count = counters[type] ?? 0;
          row[`${type}__count`] = count;
          row[`${type}__percent`] =
            total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
        }

        return row;
      })
      .filter((item) => Number(item.total) > 0)
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, 12);

    return {
      types,
      items,
    };
  }

  private buildOrganizationRisk(
    rows: Array<{
      organization: string | null;
      sufferedLifetime: boolean | null;
    }>,
  ) {
    const map = new Map<
      string,
      {
        total: number;
        lifetimeYes: number;
      }
    >();

    for (const row of rows) {
      const organization = row.organization?.trim() || 'Não informado';
      const current = map.get(organization) ?? { total: 0, lifetimeYes: 0 };
      current.total += 1;
      if (row.sufferedLifetime === true) current.lifetimeYes += 1;
      map.set(organization, current);
    }

    return [...map.entries()]
      .map(([organization, value]) => ({
        organization,
        total: value.total,
        lifetimeYes: value.lifetimeYes,
        lifetimeRatePercent:
          value.total > 0
            ? Number(((value.lifetimeYes / value.total) * 100).toFixed(2))
            : 0,
      }))
      .filter((item) => item.total >= 5)
      .sort((a, b) => b.lifetimeRatePercent - a.lifetimeRatePercent);
  }

  private buildResponseTrend(
    rows: Array<{
      submittedAt: Date | null;
      sufferedLifetime: boolean | null;
    }>,
  ) {
    const map = new Map<
      string,
      {
        total: number;
        positiveCount: number;
      }
    >();

    for (const row of rows) {
      const day = row.submittedAt
        ? `${row.submittedAt.getFullYear()}-${String(
            row.submittedAt.getMonth() + 1,
          ).padStart(2, '0')}-${String(row.submittedAt.getDate()).padStart(
            2,
            '0',
          )}`
        : 'SEM_DATA';

      const current = map.get(day) ?? {
        total: 0,
        positiveCount: 0,
      };
      current.total += 1;
      if (row.sufferedLifetime === true) {
        current.positiveCount += 1;
      }
      map.set(day, current);
    }

    return [...map.entries()]
      .map(([day, value]) => ({
        day,
        dayLabel:
          day === 'SEM_DATA'
            ? 'Sem data'
            : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`,
        total: value.total,
        positiveCount: value.positiveCount,
        positiveRatePercent:
          value.total > 0
            ? Number(((value.positiveCount / value.total) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => {
        if (a.day === 'SEM_DATA') return 1;
        if (b.day === 'SEM_DATA') return -1;
        return a.day.localeCompare(b.day, 'pt-BR');
      });
  }

  private buildWhere(
    filters: DomesticViolenceFilters,
  ): Prisma.BiDomesticViolenceResponseWhereInput {
    const mode = this.parseCombineMode(filters.combineMode);
    const conditions: Prisma.BiDomesticViolenceResponseWhereInput[] = [];

    const from = this.parseDate(filters.from);
    const to = this.parseDate(filters.to);

    if (from || to) {
      const dateFilter: Prisma.DateTimeNullableFilter = {};
      if (from) dateFilter.gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      conditions.push({ submittedAt: dateFilter });
    }

    if (filters.organization?.trim()) {
      conditions.push({ organization: filters.organization.trim() });
    }
    if (filters.rank?.trim()) {
      conditions.push({ rank: filters.rank.trim() });
    }
    if (filters.maritalStatus?.trim()) {
      conditions.push({ maritalStatus: filters.maritalStatus.trim() });
    }
    if (filters.education?.trim()) {
      conditions.push({ education: filters.education.trim() });
    }
    if (filters.naturality?.trim()) {
      conditions.push({ naturality: filters.naturality.trim() });
    }
    if (filters.fabBond?.trim()) {
      conditions.push({ fabBond: filters.fabBond.trim() });
    }
    if (filters.situationScope?.trim()) {
      conditions.push({ situationScope: filters.situationScope.trim() });
    }
    if (filters.frequency?.trim()) {
      conditions.push({ frequency: filters.frequency.trim() });
    }
    if (filters.affectiveBond?.trim()) {
      conditions.push({ affectiveBond: filters.affectiveBond.trim() });
    }
    if (filters.authorRelation?.trim()) {
      conditions.push({ authorRelation: filters.authorRelation.trim() });
    }
    if (filters.impactIntensity?.trim()) {
      conditions.push({ impactIntensity: filters.impactIntensity.trim() });
    }
    if (filters.authorMilitaryLink?.trim()) {
      conditions.push({
        authorMilitaryLink: filters.authorMilitaryLink.trim(),
      });
    }
    if (filters.occurrencePlace?.trim()) {
      conditions.push({ occurrencePlace: filters.occurrencePlace.trim() });
    }

    if (filters.violenceType?.trim()) {
      conditions.push({
        violenceTypes: {
          has: filters.violenceType.trim(),
        },
      });
    }
    if (filters.impactArea?.trim()) {
      conditions.push({
        impactAreas: {
          has: filters.impactArea.trim(),
        },
      });
    }
    if (filters.complaintChannel?.trim()) {
      conditions.push({
        complaintChannels: {
          has: filters.complaintChannel.trim(),
        },
      });
    }
    if (filters.noComplaintReason?.trim()) {
      conditions.push({
        noComplaintReasons: {
          has: filters.noComplaintReason.trim(),
        },
      });
    }

    if (filters.sufferedLifetime?.trim()) {
      const parsed = this.parseFilterBoolean(filters.sufferedLifetime);
      if (parsed !== null) {
        conditions.push({ sufferedLifetime: parsed });
      }
    }

    if (filters.sufferedLast12Months?.trim()) {
      const parsed = this.parseFilterBoolean(filters.sufferedLast12Months);
      if (parsed !== null) {
        conditions.push({ sufferedLast12Months: parsed });
      }
    }

    if (filters.soughtHelp?.trim()) {
      const parsed = this.parseFilterBoolean(filters.soughtHelp);
      if (parsed !== null) {
        conditions.push({ soughtHelp: parsed });
      }
    }

    if (filters.witnesses?.trim()) {
      const parsed = this.parseFilterBoolean(filters.witnesses);
      if (parsed !== null) {
        conditions.push({ witnesses: parsed });
      }
    }

    if (filters.responseId?.trim()) {
      conditions.push({ id: filters.responseId.trim() });
    }

    if (filters.q?.trim()) {
      const query = filters.q.trim();
      conditions.push({
        OR: [
          { organization: { contains: query, mode: 'insensitive' } },
          { rank: { contains: query, mode: 'insensitive' } },
          { maritalStatus: { contains: query, mode: 'insensitive' } },
          { education: { contains: query, mode: 'insensitive' } },
          { naturality: { contains: query, mode: 'insensitive' } },
          { fabBond: { contains: query, mode: 'insensitive' } },
          { situationScope: { contains: query, mode: 'insensitive' } },
          { frequency: { contains: query, mode: 'insensitive' } },
          { affectiveBond: { contains: query, mode: 'insensitive' } },
          { authorRelation: { contains: query, mode: 'insensitive' } },
          { impactIntensity: { contains: query, mode: 'insensitive' } },
          { authorMilitaryLink: { contains: query, mode: 'insensitive' } },
          { occurrencePlace: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];

    if (mode === 'OR') {
      return { OR: conditions };
    }

    return { AND: conditions };
  }

  private parseCombineMode(value?: string): 'AND' | 'OR' {
    const normalized = this.compact(value ?? 'AND');
    return normalized === 'OR' ? 'OR' : 'AND';
  }

  private parseFilterBoolean(value: string): boolean | null {
    const normalized = this.compact(value);
    if (['SIM', 'S', 'TRUE', 'YES'].includes(normalized)) return true;
    if (['NAO', 'N', 'FALSE', 'NO'].includes(normalized)) return false;
    return null;
  }

  private booleanLabel(value: boolean | null) {
    if (value === true) return 'Sim';
    if (value === false) return 'Não';
    return 'Não informado';
  }

  private parseDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private extractRows(buffer: Buffer, format: BiImportFormat) {
    const workbook = this.readWorkbook(buffer, format);
    const sheetNames = workbook.SheetNames ?? [];

    if (sheetNames.length === 0) {
      throwError('VALIDATION_ERROR', { reason: 'empty_workbook' });
    }

    const selectedName = this.findPreferredSheetName(sheetNames, [
      'Respostas ao formulário',
      'BANCO_DADOS',
      'Sheet1',
    ]);

    const sheet = workbook.Sheets[selectedName];
    if (!sheet) {
      throwError('VALIDATION_ERROR', { reason: 'missing_sheet' });
    }

    const rows = this.sheetToMatrix(sheet);
    return {
      sheetName: format === BiImportFormat.CSV ? 'CSV' : selectedName,
      rows,
    };
  }

  private readWorkbook(buffer: Buffer, format: BiImportFormat): XLSX.WorkBook {
    try {
      if (format === BiImportFormat.CSV) {
        const utf8 = buffer.toString('utf8');
        return XLSX.read(utf8, {
          type: 'string',
          cellDates: false,
          raw: false,
          codepage: 65001,
        });
      }

      return XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false,
        raw: false,
      });
    } catch {
      throwError('VALIDATION_ERROR', { reason: 'invalid_spreadsheet' });
    }
  }

  private findPreferredSheetName(
    sheetNames: string[],
    preferredNames: string[],
  ) {
    const normalizedPreferred = preferredNames.map((name) =>
      this.normalizeForMatch(name),
    );

    const selected = sheetNames.find((name) => {
      const current = this.normalizeForMatch(name);
      return normalizedPreferred.some((preferred) =>
        current.includes(preferred),
      );
    });

    return selected ?? sheetNames[0];
  }

  private sheetToMatrix(sheet: XLSX.WorkSheet) {
    const matrix = XLSX.utils.sheet_to_json<
      Array<string | number | boolean | Date | null>
    >(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });

    return matrix.map((row) => row.map((cell) => this.cleanCell(cell) ?? ''));
  }

  private resolveHeaderMap(headerRow: string[]) {
    const normalizedHeaders = headerRow.map((value) =>
      this.normalizeForMatch(value),
    );

    const findIndex = (predicates: string[]) => {
      const needles = predicates
        .map((item) => this.normalizeForMatch(item))
        .filter(Boolean);

      return normalizedHeaders.findIndex((header) =>
        needles.some((needle) => header.includes(needle)),
      );
    };

    const map = {
      submittedAt: findIndex(['Carimbo de data/hora', 'Timestamp']),
      age: findIndex(['Idade']),
      organization: findIndex(['Organização Militar']),
      maritalStatus: findIndex(['Estado civil']),
      education: findIndex(['Escolaridade']),
      naturality: findIndex(['Naturalidade']),
      fabBond: findIndex(['Vínculo institucional com a FAB']),
      rank: findIndex(['Caso seja militar, indique o posto ou graduação']),
      sufferedLifetime: findIndex([
        'Você sofreu algum tipo de violência doméstica no decorrer de sua vida',
      ]),
      sufferedLast12Months: findIndex([
        'Nos últimos 12 meses, você sofreu algum tipo de violência doméstica',
      ]),
      situationScope: findIndex([
        'As próximas perguntas tratam da violência sofrida',
        'qual situação você deseja relatar',
      ]),
      frequency: findIndex(['Frequência da ocorrência']),
      affectiveBond: findIndex(['Tipo de vínculo afetivo com o autor']),
      violenceTypes: findIndex([
        'Se sofreu violência, qual(is) tipo(s)',
        'qual(is) tipo(s)',
      ]),
      authorRelation: findIndex([
        'Qual é o tipo de vínculo com o autor do fato',
      ]),
      authorMilitaryLink: findIndex([
        'O autor da violência possui vínculo com instituição militar',
      ]),
      occurrencePlace: findIndex(['Onde ocorreu o fato']),
      witnesses: findIndex(['Houve testemunhas']),
      impactIntensity: findIndex([
        'Em que intensidade você percebe o impacto da violência',
      ]),
      impactAreas: findIndex(['Em quais áreas você percebe maior impacto']),
      soughtHelp: findIndex(['Você procurou algum canal de denúncia']),
      complaintChannels: findIndex(['Se sim, qual']),
      noComplaintReasons: findIndex([
        'Se não procurou, quais foram os principais motivos',
      ]),
    };

    if (
      map.organization < 0 ||
      map.sufferedLifetime < 0 ||
      map.sufferedLast12Months < 0 ||
      map.violenceTypes < 0
    ) {
      throwError('VALIDATION_ERROR', {
        reason: 'missing_required_columns',
        required: [
          'Organização Militar',
          'Você sofreu algum tipo de violência doméstica no decorrer de sua vida?',
          'Nos últimos 12 meses, você sofreu algum tipo de violência doméstica?',
          'Se sofreu violência, qual(is) tipo(s)?',
        ],
      });
    }

    return map;
  }

  private parseDataRow(
    row: string[],
    map: {
      submittedAt: number;
      age: number;
      organization: number;
      maritalStatus: number;
      education: number;
      naturality: number;
      fabBond: number;
      rank: number;
      sufferedLifetime: number;
      sufferedLast12Months: number;
      situationScope: number;
      frequency: number;
      affectiveBond: number;
      violenceTypes: number;
      authorRelation: number;
      authorMilitaryLink: number;
      occurrencePlace: number;
      witnesses: number;
      impactIntensity: number;
      impactAreas: number;
      soughtHelp: number;
      complaintChannels: number;
      noComplaintReasons: number;
    },
    sourceRow: number,
  ):
    | { skip: true; value?: undefined }
    | { skip: false; value: ParsedDomesticViolenceRow | null } {
    const submittedAtRaw = this.getCell(row, map.submittedAt);
    const ageRaw = this.getCell(row, map.age);
    const organizationRaw = this.getCell(row, map.organization);
    const maritalStatusRaw = this.getCell(row, map.maritalStatus);
    const educationRaw = this.getCell(row, map.education);
    const naturalityRaw = this.getCell(row, map.naturality);
    const fabBondRaw = this.getCell(row, map.fabBond);
    const rankRaw = this.getCell(row, map.rank);
    const sufferedLifetimeRaw = this.getCell(row, map.sufferedLifetime);
    const sufferedLast12MonthsRaw = this.getCell(row, map.sufferedLast12Months);
    const situationScopeRaw = this.getCell(row, map.situationScope);
    const frequencyRaw = this.getCell(row, map.frequency);
    const affectiveBondRaw = this.getCell(row, map.affectiveBond);
    const violenceTypesRaw = this.getCell(row, map.violenceTypes);
    const authorRelationRaw = this.getCell(row, map.authorRelation);
    const authorMilitaryLinkRaw = this.getCell(row, map.authorMilitaryLink);
    const occurrencePlaceRaw = this.getCell(row, map.occurrencePlace);
    const witnessesRaw = this.getCell(row, map.witnesses);
    const impactIntensityRaw = this.getCell(row, map.impactIntensity);
    const impactAreasRaw = this.getCell(row, map.impactAreas);
    const soughtHelpRaw = this.getCell(row, map.soughtHelp);
    const complaintChannelsRaw = this.getCell(row, map.complaintChannels);
    const noComplaintReasonsRaw = this.getCell(row, map.noComplaintReasons);

    const hasAnyValue = [
      submittedAtRaw,
      ageRaw,
      organizationRaw,
      maritalStatusRaw,
      educationRaw,
      naturalityRaw,
      fabBondRaw,
      rankRaw,
      sufferedLifetimeRaw,
      sufferedLast12MonthsRaw,
      situationScopeRaw,
      frequencyRaw,
      affectiveBondRaw,
      violenceTypesRaw,
      authorRelationRaw,
      authorMilitaryLinkRaw,
      occurrencePlaceRaw,
      witnessesRaw,
      impactIntensityRaw,
      impactAreasRaw,
      soughtHelpRaw,
      complaintChannelsRaw,
      noComplaintReasonsRaw,
    ].some((value) => Boolean(value && value.trim()));

    if (!hasAnyValue) {
      return { skip: true };
    }

    const submittedAt = this.parseSubmittedAt(submittedAtRaw);
    const age = this.parseAge(ageRaw);
    const organization = this.normalizeOrganization(organizationRaw);
    const maritalStatus = this.cleanCategory(maritalStatusRaw);
    const education = this.cleanCategory(educationRaw);
    const naturality = this.cleanCategory(naturalityRaw);
    const fabBond = this.cleanCategory(fabBondRaw);
    const rank = this.normalizeRank(rankRaw);
    const sufferedLifetime = this.parseBooleanAnswer(sufferedLifetimeRaw);
    const sufferedLast12Months = this.parseBooleanAnswer(
      sufferedLast12MonthsRaw,
    );
    const situationScope = this.cleanCategory(situationScopeRaw);
    const frequency = this.cleanCategory(frequencyRaw);
    const affectiveBond = this.cleanCategory(affectiveBondRaw);
    const violenceTypes = this.parseKnownMultiSelect(
      violenceTypesRaw,
      DOMESTIC_VIOLENCE_TYPE_OPTIONS,
      [
        { match: 'PSICOLOGICA', label: 'Psicológica' },
        { match: 'MORAL', label: 'Moral' },
        { match: 'FISICA', label: 'Física' },
        { match: 'SEXUAL', label: 'Sexual' },
        { match: 'PATRIMONIAL', label: 'Patrimonial' },
      ],
    );
    const authorRelation = this.cleanCategory(authorRelationRaw);
    const authorMilitaryLink = this.cleanCategory(authorMilitaryLinkRaw);
    const occurrencePlace = this.cleanCategory(occurrencePlaceRaw);
    const witnesses = this.parseBooleanAnswer(witnessesRaw);
    const impactIntensity = this.cleanCategory(impactIntensityRaw);
    const impactAreas = this.parseKnownMultiSelect(
      impactAreasRaw,
      IMPACT_AREA_OPTIONS,
      [
        { match: 'SAUDEMENTAL', label: 'Saúde mental' },
        { match: 'SAUDEFISICA', label: 'Saúde física' },
        { match: 'VIDAPESSOAL', label: 'Vida pessoal' },
        { match: 'VIDASOCIAL', label: 'Vida social' },
        { match: 'VIDAPROFISSIONAL', label: 'Vida profissional' },
      ],
    );
    const soughtHelp = this.parseBooleanAnswer(soughtHelpRaw);
    const complaintChannels = this.parseKnownMultiSelect(
      complaintChannelsRaw,
      COMPLAINT_CHANNEL_OPTIONS,
      [
        { match: 'FOIADELEGACIA', label: 'Foi a Delegacia' },
        { match: 'LIGOUPARAPOLICIA190', label: 'Ligou para polícia (190)' },
        { match: 'APOIOINSTITUCIONAL', label: 'Apoio institucional' },
        { match: '180', label: 'Disque 180' },
        { match: 'NAOPROCUREI', label: 'Não procurei' },
        { match: 'NAODENUNCIEI', label: 'Não denunciei' },
        { match: 'NENHUM', label: 'Não procurei' },
      ],
    );
    const noComplaintReasons = this.parseKnownMultiSelect(
      noComplaintReasonsRaw,
      NO_REPORT_REASON_OPTIONS,
      [
        { match: 'MEDODERETALIACAO', label: 'Medo de retaliação' },
        {
          match: 'VERGONHAOUCONSTRANGIMENTO',
          label: 'Vergonha ou constrangimento',
        },
        {
          match: 'FALTADECONFIANCANASINSTANCIASDEDENUNCIA',
          label: 'Falta de confiança nas instâncias de denúncia',
        },
        {
          match: 'PERCEPCAODEQUENAOADIANTARIADENUNCIAR',
          label: 'Percepção de que "não adiantaria" denunciar',
        },
        {
          match: 'DESEJODEPRESERVARAIMAGEMPESSOALOUDAFAMILIA',
          label: 'Desejo de preservar a imagem pessoal ou da família',
        },
        {
          match: 'RECEIODEPREJUDICARACARREIRADEALGUEM',
          label: 'Receio de prejudicar a carreira de alguém',
        },
        {
          match: 'PRESSAOFAMILIAROUSOCIALPARANAODENUNCIAR',
          label: 'Pressão familiar ou social para não denunciar',
        },
        {
          match: 'CONSIDEROUTRATARSEDEUMEPISODIOSEMGRAVIDADE',
          label: 'Considerou tratar-se de um episódio sem gravidade',
        },
        {
          match: 'NAOIDENTIFICOUNAEPOCAQUEERAUMATODEVIOLENCIA',
          label: 'Não identificou, na época, que era um ato de violência',
        },
        { match: 'PREFIRONAORESPONDER', label: 'Prefiro não responder' },
      ],
    );

    const payload = {
      submittedAtRaw,
      ageRaw,
      organizationRaw,
      maritalStatusRaw,
      educationRaw,
      naturalityRaw,
      fabBondRaw,
      rankRaw,
      sufferedLifetimeRaw,
      sufferedLast12MonthsRaw,
      situationScopeRaw,
      frequencyRaw,
      affectiveBondRaw,
      violenceTypesRaw,
      authorRelationRaw,
      authorMilitaryLinkRaw,
      occurrencePlaceRaw,
      witnessesRaw,
      impactIntensityRaw,
      impactAreasRaw,
      soughtHelpRaw,
      complaintChannelsRaw,
      noComplaintReasonsRaw,
    };

    const sourceHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          sourceRow,
          submittedAt: submittedAt?.toISOString() ?? null,
          age,
          organization,
          rank,
          sufferedLifetime,
          sufferedLast12Months,
          violenceTypes: [...violenceTypes].sort(),
          impactAreas: [...impactAreas].sort(),
          soughtHelp,
          complaintChannels: [...complaintChannels].sort(),
          noComplaintReasons: [...noComplaintReasons].sort(),
        }),
      )
      .digest('hex');

    return {
      skip: false,
      value: {
        submittedAt,
        age,
        organization,
        maritalStatus,
        education,
        naturality,
        fabBond,
        rank,
        situationScope,
        sufferedLifetimeRaw,
        sufferedLifetime,
        sufferedLast12MonthsRaw,
        sufferedLast12Months,
        frequency,
        affectiveBond,
        violenceTypes,
        authorRelation,
        authorMilitaryLink,
        occurrencePlace,
        witnessesRaw,
        witnesses,
        impactIntensity,
        impactAreas,
        soughtHelpRaw,
        soughtHelp,
        complaintChannels,
        noComplaintReasons,
        rawPayload: payload,
        sourceRow,
        sourceHash,
      },
    };
  }

  private parseSubmittedAt(raw: string | null) {
    if (!raw) return null;

    const normalized = raw.replace(',', '.').trim();
    const numeric = Number(normalized);

    if (Number.isFinite(numeric) && numeric > 25000 && numeric < 70000) {
      const excelEpochUtc = Date.UTC(1899, 11, 30);
      return new Date(excelEpochUtc + numeric * 24 * 60 * 60 * 1000);
    }

    const match = raw.match(
      /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );

    if (match) {
      const p1 = Number(match[1]);
      const p2 = Number(match[2]);
      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
      const hour = Number(match[4] ?? 0);
      const minute = Number(match[5] ?? 0);
      const second = Number(match[6] ?? 0);

      let day = p1;
      let month = p2;

      if (raw.includes('-') && !raw.includes('/')) {
        month = p1;
        day = p2;
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12 && p1 <= 12) {
        month = p1;
        day = p2;
      }

      const parsed = new Date(year, month - 1, day, hour, minute, second);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;

    return null;
  }

  private parseAge(raw: string | null) {
    if (!raw) return null;
    const numeric = Number.parseInt(raw.replace(/[^\d-]/g, ''), 10);
    if (!Number.isFinite(numeric)) return null;
    if (numeric <= 0 || numeric > 120) return null;
    return numeric;
  }

  private parseBooleanAnswer(raw: string | null): boolean | null {
    if (!raw) return null;

    const compact = this.compact(raw);

    if (['SIM', 'S', 'TRUE', 'YES'].includes(compact)) return true;
    if (['NAO', 'N', 'FALSE', 'NO'].includes(compact)) return false;

    if (compact.startsWith('SIM')) return true;
    if (compact.startsWith('NAO')) return false;

    if (
      compact.includes('NAOSEAPLICA') ||
      compact.includes('NAOSOFRI') ||
      compact.includes('NAOPROCUREI') ||
      compact.includes('NAODENUNCIEI')
    ) {
      return false;
    }

    return null;
  }

  private normalizeOrganization(raw: string | null) {
    const value = this.cleanCategory(raw);
    if (!value) return null;

    const compact = this.compact(value);

    if (compact === 'GAPMN') return 'GAP-MN';
    if (compact === 'DTCEAEG') return 'DTCEA-EG';

    return value
      .toUpperCase()
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeRank(raw: string | null) {
    const value = this.cleanCategory(raw);
    if (!value) return null;

    const compact = this.compact(value);

    if (compact.includes('DISCENTE')) return 'Discente';
    if (compact === 'CIVIL') return 'Civil';
    if (/^\dSGT$/.test(compact)) return `${compact[0]}Sgt`;
    if (/^\dTEN$/.test(compact)) return `${compact[0]}Ten`;
    if (compact === 'SO') return 'SO';
    if (compact === 'CABO') return 'Cabo';
    if (compact === 'CAP') return 'Cap';
    if (compact === 'MAJ') return 'Maj';
    if (compact === 'CEL') return 'Cel';

    return this.toTitleCaseWithAccents(value);
  }

  private cleanCategory(raw: string | null) {
    if (!raw) return null;

    const value = String(raw).replace(/\s+/g, ' ').trim();

    if (!value) return null;
    if (this.isNotApplicable(value)) return null;

    return value;
  }

  private parseKnownMultiSelect(
    raw: string | null,
    options: readonly string[],
    aliases: Array<{ match: string; label: string }> = [],
  ) {
    if (!raw) return [];
    if (this.isNotApplicable(raw)) return [];

    const normalizedRaw = this.normalizeForMatch(raw);
    const selected = new Set<string>();

    const sortedOptions = [...options].sort(
      (a, b) => this.compact(b).length - this.compact(a).length,
    );

    for (const option of sortedOptions) {
      const normalizedOption = this.normalizeForMatch(option);
      if (!normalizedOption) continue;
      if (normalizedRaw.includes(normalizedOption)) {
        selected.add(option);
      }
    }

    for (const alias of aliases) {
      const normalizedMatch = this.normalizeForMatch(alias.match);
      if (!normalizedMatch) continue;
      if (normalizedRaw.includes(normalizedMatch)) {
        selected.add(alias.label);
      }
    }

    if (selected.size === 0) {
      for (const token of this.fallbackSplitMulti(raw)) {
        if (this.isNotApplicable(token)) continue;
        selected.add(this.toTitleCaseWithAccents(token));
      }
    }

    const ordered = [...selected].filter(Boolean);

    ordered.sort((a, b) => {
      const ai = options.indexOf(a);
      const bi = options.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b, 'pt-BR');
    });

    return ordered;
  }

  private fallbackSplitMulti(raw: string) {
    return raw
      .split(/[;|\n]+/)
      .flatMap((part) => part.split(/,\s+(?=[A-ZÀ-Ú])/u))
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private ageRange(age: number | null) {
    if (!Number.isFinite(age ?? NaN)) return 'Não informado';
    const value = Number(age);

    if (value < 20) return 'Menor de 20';
    if (value <= 24) return '20-24';
    if (value <= 29) return '25-29';
    if (value <= 34) return '30-34';
    if (value <= 39) return '35-39';
    return '40+';
  }

  private fileExtension(fileName: string) {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(ext)) {
      throwError('BI_FILE_TYPE_INVALID');
    }
    return ext;
  }

  private normalizeForMatch(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private compact(value: string) {
    return this.normalizeForMatch(value).replace(/\s+/g, '');
  }

  private isNotApplicable(value: string) {
    const compact = this.compact(value);

    if (!compact) return true;
    if (compact === 'NA') return true;
    if (compact === 'NASEAPLICA') return true;
    if (compact.includes('NAOSEAPLICA')) return true;
    if (compact.includes('NAOSOFRI')) return true;
    if (compact.includes('NAOSOFRIVIOLENCIA')) return true;

    return false;
  }

  private toTitleCaseWithAccents(value: string) {
    return value
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((chunk) => `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`)
      .join(' ')
      .trim();
  }

  private cleanCell(value: string | number | boolean | Date | null) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 'SIM' : 'NAO';
    return String(value).trim() || null;
  }

  private getCell(row: string[], index: number) {
    if (index < 0 || index >= row.length) return null;
    const value = row[index] ?? '';
    return String(value).trim() || null;
  }
}
