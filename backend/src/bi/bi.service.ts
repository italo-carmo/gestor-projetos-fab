import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BiImportFormat, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parsePagination } from '../common/pagination';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';

type SurveyFilters = {
  from?: string;
  to?: string;
  om?: string;
  posto?: string;
  postoGraduacao?: string;
  autodeclara?: string;
  suffered?: string;
  violenceType?: string;
  q?: string;
  combineMode?: string;
};

type ParsedSurveyRow = {
  submittedAt: Date | null;
  sufferedViolenceRaw: string | null;
  sufferedViolence: boolean | null;
  violenceTypes: string[];
  postoGraduacao: string | null;
  om: string | null;
  posto: string | null;
  autodeclara: string | null;
  extraColumn: string | null;
  rawPayload: Prisma.InputJsonValue;
  sourceRow: number;
  sourceHash: string;
};

const KNOWN_VIOLENCE_TYPES = [
  'Violencia Patrimonial',
  'Violencia Fisica',
  'Violencia Sexual',
  'Violencia Moral',
  'Violencia Psicologica',
] as const;

const VIOLENCE_TYPE_ALIASES: Array<{
  match: string;
  label: (typeof KNOWN_VIOLENCE_TYPES)[number];
}> = [
  { match: 'patrimonial', label: 'Violencia Patrimonial' },
  { match: 'fisica', label: 'Violencia Fisica' },
  { match: 'sexual', label: 'Violencia Sexual' },
  { match: 'moral', label: 'Violencia Moral' },
  { match: 'psicologica', label: 'Violencia Psicologica' },
];

const OM_PRIORITY: Record<string, number> = {
  COMGEP: 1,
  CIAAR: 2,
  AFA: 3,
  EEAR: 4,
};

@Injectable()
export class BiService {
  constructor(private readonly prisma: PrismaService) {}

  async importSurvey(file: Express.Multer.File, user?: RbacUser) {
    const extension = this.fileExtension(file.originalname);
    const format =
      extension === 'csv' ? BiImportFormat.CSV : BiImportFormat.XLSX;
    const { sheetName, rows } = this.extractRows(file.buffer, format);

    if (rows.length === 0) {
      throwError('VALIDATION_ERROR', { reason: 'empty_file' });
    }

    const [headerRow, ...dataRows] = rows;
    const headerMap = this.resolveHeaderMap(headerRow);

    const parsed: ParsedSurveyRow[] = [];
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

    const batch = await this.prisma.biSurveyImportBatch.create({
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
      const created = await this.prisma.biSurveyResponse.createMany({
        data: parsed.map((item) => ({
          batchId: batch.id,
          submittedAt: item.submittedAt,
          sufferedViolenceRaw: item.sufferedViolenceRaw,
          sufferedViolence: item.sufferedViolence,
          violenceTypes: item.violenceTypes,
          postoGraduacao: item.postoGraduacao,
          om: item.om,
          posto: item.posto,
          autodeclara: item.autodeclara,
          extraColumn: item.extraColumn,
          rawPayload: item.rawPayload,
          sourceRow: item.sourceRow,
          sourceHash: item.sourceHash,
        })),
        skipDuplicates: true,
      });
      insertedRows = created.count;
    }

    const duplicateRows = parsed.length - insertedRows;

    const updatedBatch = await this.prisma.biSurveyImportBatch.update({
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
    });

    return {
      batch: updatedBatch,
      preview: parsed.slice(0, 5).map((item) => ({
        submittedAt: item.submittedAt,
        sufferedViolenceRaw: item.sufferedViolenceRaw,
        violenceTypes: item.violenceTypes,
        postoGraduacao: item.postoGraduacao,
        om: item.om,
        posto: item.posto,
        autodeclara: item.autodeclara,
      })),
    };
  }

  async listImports(filters: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.biSurveyImportBatch.findMany({
        include: {
          importedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ importedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.biSurveyImportBatch.count(),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async listResponses(
    filters: SurveyFilters & {
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
      this.prisma.biSurveyResponse.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.biSurveyResponse.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async deleteResponses(
    payload: SurveyFilters & {
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
      const deleted = await this.prisma.biSurveyResponse.deleteMany({ where });
      return {
        mode: 'FILTERED',
        deletedCount: deleted.count,
      };
    }

    const deleted = await this.prisma.biSurveyResponse.deleteMany({
      where: {
        id: { in: uniqueIds },
      },
    });

    return {
      mode: 'IDS',
      deletedCount: deleted.count,
    };
  }

  async dashboard(filters: SurveyFilters) {
    const where = this.buildWhere(filters);

    const [rows, allRowsForFilters, totalRowsInDb, latestImport] =
      await this.prisma.$transaction([
        this.prisma.biSurveyResponse.findMany({
          where,
          select: {
            id: true,
            submittedAt: true,
            sufferedViolence: true,
            sufferedViolenceRaw: true,
            violenceTypes: true,
            om: true,
            posto: true,
            postoGraduacao: true,
            autodeclara: true,
          },
        }),
        this.prisma.biSurveyResponse.findMany({
          select: {
            sufferedViolence: true,
            violenceTypes: true,
            om: true,
            posto: true,
            postoGraduacao: true,
            autodeclara: true,
          },
        }),
        this.prisma.biSurveyResponse.count(),
        this.prisma.biSurveyImportBatch.findFirst({
          orderBy: { importedAt: 'desc' },
          include: {
            importedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);

    const total = rows.length;
    const yesCount = rows.filter((row) => row.sufferedViolence === true).length;
    const noCount = rows.filter((row) => row.sufferedViolence === false).length;
    const unknownCount = total - yesCount - noCount;

    const totalMentions = rows.reduce(
      (sum, row) => sum + row.violenceTypes.length,
      0,
    );
    const averageTypesPerVictim =
      yesCount > 0 ? Number((totalMentions / yesCount).toFixed(2)) : 0;

    const omViolence = this.buildOmViolenceChart(rows);
    const omDistribution = this.buildDistribution(
      rows,
      (row) => row.om ?? 'Nao informado',
      'om',
    );
    const postoDistribution = this.buildDistribution(
      rows,
      (row) => row.posto ?? 'Nao informado',
      'posto',
    );
    const postoGraduacaoDistribution = this.buildDistribution(
      rows,
      (row) => row.postoGraduacao ?? 'Nao informado',
      'postoGraduacao',
    );
    const autodeclaraDistribution = this.buildDistribution(
      rows,
      (row) => row.autodeclara ?? 'Nao informado',
      'autodeclara',
    );

    const violenceTypePercent = this.buildViolenceTypeChart(rows);
    const violenceTypeByOmPercent = this.buildViolenceTypeByOmChart(rows);

    const typeCounter = new Map<string, number>();
    for (const row of rows) {
      for (const type of row.violenceTypes) {
        typeCounter.set(type, (typeCounter.get(type) ?? 0) + 1);
      }
    }

    const mostCommonType =
      [...typeCounter.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const riskiestOm =
      [...omViolence]
        .filter((item) => item.total >= 5)
        .sort((a, b) => b.simPercent - a.simPercent)[0] ?? null;

    return {
      kpis: {
        totalResponses: total,
        totalRowsInDb,
        yesCount,
        noCount,
        unknownCount,
        violenceRatePercent:
          total > 0 ? Number(((yesCount / total) * 100).toFixed(2)) : 0,
        totalViolenceMentions: totalMentions,
        averageTypesPerVictim,
      },
      filters: this.buildAvailableFilters(allRowsForFilters),
      charts: {
        omViolencePercent: omViolence,
        omDistribution,
        postoDistribution,
        postoGraduacaoDistribution,
        autodeclaraDistribution,
        yesNoDonut: [
          {
            label: 'Nao',
            count: noCount,
            percent:
              total > 0 ? Number(((noCount / total) * 100).toFixed(2)) : 0,
          },
          {
            label: 'Sim',
            count: yesCount,
            percent:
              total > 0 ? Number(((yesCount / total) * 100).toFixed(2)) : 0,
          },
          {
            label: 'Nao informado',
            count: unknownCount,
            percent:
              total > 0 ? Number(((unknownCount / total) * 100).toFixed(2)) : 0,
          },
        ],
        violenceTypePercent,
        violenceTypeByOmPercent,
      },
      insights: {
        mostCommonType: mostCommonType
          ? {
              type: mostCommonType[0],
              mentions: mostCommonType[1],
            }
          : null,
        riskiestOm: riskiestOm
          ? {
              om: riskiestOm.om,
              simPercent: riskiestOm.simPercent,
              total: riskiestOm.total,
            }
          : null,
      },
      latestImport,
    };
  }

  private buildAvailableFilters(
    rows: Array<{
      sufferedViolence: boolean | null;
      violenceTypes: string[];
      om: string | null;
      posto: string | null;
      postoGraduacao: string | null;
      autodeclara: string | null;
    }>,
  ) {
    const om = new Set<string>();
    const posto = new Set<string>();
    const postoGraduacao = new Set<string>();
    const autodeclara = new Set<string>();
    const violenceTypes = new Set<string>();

    for (const row of rows) {
      if (row.om?.trim()) om.add(row.om.trim());
      if (row.posto?.trim()) posto.add(row.posto.trim());
      if (row.postoGraduacao?.trim())
        postoGraduacao.add(row.postoGraduacao.trim());
      if (row.autodeclara?.trim()) autodeclara.add(row.autodeclara.trim());
      for (const type of row.violenceTypes) {
        if (type.trim()) violenceTypes.add(type.trim());
      }
    }

    const omSorted = [...om].sort((a, b) => this.sortOm(a, b));

    return {
      om: omSorted,
      posto: [...posto].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      postoGraduacao: [...postoGraduacao].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      autodeclara: [...autodeclara].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      violenceTypes: [...violenceTypes].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      suffered: [
        { value: 'SIM', label: 'Sim' },
        { value: 'NAO', label: 'Nao' },
      ],
    };
  }

  private buildOmViolenceChart(
    rows: Array<{ om: string | null; sufferedViolence: boolean | null }>,
  ) {
    const map = new Map<
      string,
      {
        simCount: number;
        naoCount: number;
        unknownCount: number;
        total: number;
      }
    >();

    for (const row of rows) {
      const key = row.om?.trim() || 'Nao informado';
      const current = map.get(key) ?? {
        simCount: 0,
        naoCount: 0,
        unknownCount: 0,
        total: 0,
      };

      current.total += 1;
      if (row.sufferedViolence === true) current.simCount += 1;
      else if (row.sufferedViolence === false) current.naoCount += 1;
      else current.unknownCount += 1;

      map.set(key, current);
    }

    return [...map.entries()]
      .map(([om, value]) => ({
        om,
        ...value,
        simPercent:
          value.total > 0
            ? Number(((value.simCount / value.total) * 100).toFixed(2))
            : 0,
        naoPercent:
          value.total > 0
            ? Number(((value.naoCount / value.total) * 100).toFixed(2))
            : 0,
        unknownPercent:
          value.total > 0
            ? Number(((value.unknownCount / value.total) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => this.sortOm(a.om, b.om));
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

  private buildViolenceTypeChart(rows: Array<{ violenceTypes: string[] }>) {
    const map = new Map<string, number>();

    for (const row of rows) {
      for (const type of row.violenceTypes) {
        map.set(type, (map.get(type) ?? 0) + 1);
      }
    }

    const totalMentions = [...map.values()].reduce(
      (sum, current) => sum + current,
      0,
    );

    return [...map.entries()]
      .map(([type, count]) => ({
        type,
        count,
        percent:
          totalMentions > 0
            ? Number(((count / totalMentions) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private buildViolenceTypeByOmChart(
    rows: Array<{ om: string | null; violenceTypes: string[] }>,
  ) {
    const map = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const om = row.om?.trim() || 'Nao informado';
      const counters = map.get(om) ?? {};
      for (const type of row.violenceTypes) {
        counters[type] = (counters[type] ?? 0) + 1;
      }
      map.set(om, counters);
    }

    const seenTypes = new Set<string>();
    for (const counters of map.values()) {
      for (const type of Object.keys(counters)) {
        seenTypes.add(type);
      }
    }

    const allTypes = [...seenTypes].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const items = [...map.entries()]
      .map(([om, counters]) => {
        const total = allTypes.reduce(
          (sum, type) => sum + (counters[type] ?? 0),
          0,
        );
        const row: Record<string, number | string> = {
          om,
          total,
        };

        for (const type of allTypes) {
          const count = counters[type] ?? 0;
          row[`${type}__count`] = count;
          row[`${type}__percent`] =
            total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
        }

        return row;
      })
      .sort((a, b) => this.sortOm(String(a.om), String(b.om)));

    return {
      types: allTypes,
      items,
    };
  }

  private sortOm(a: string, b: string) {
    const na = OM_PRIORITY[a.toUpperCase()] ?? 999;
    const nb = OM_PRIORITY[b.toUpperCase()] ?? 999;
    if (na !== nb) return na - nb;
    return a.localeCompare(b, 'pt-BR');
  }

  private buildWhere(
    filters: SurveyFilters,
  ): Prisma.BiSurveyResponseWhereInput {
    const mode = this.parseCombineMode(filters.combineMode);
    const conditions: Prisma.BiSurveyResponseWhereInput[] = [];
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

    if (filters.om?.trim()) conditions.push({ om: filters.om.trim() });
    if (filters.posto?.trim()) conditions.push({ posto: filters.posto.trim() });
    if (filters.postoGraduacao?.trim()) {
      conditions.push({ postoGraduacao: filters.postoGraduacao.trim() });
    }
    if (filters.autodeclara?.trim()) {
      conditions.push({ autodeclara: filters.autodeclara.trim() });
    }

    if (filters.suffered?.trim()) {
      const normalized = this.normalize(filters.suffered);
      if (normalized === 'SIM' || normalized === 'TRUE') {
        conditions.push({ sufferedViolence: true });
      }
      if (
        normalized === 'NAO' ||
        normalized === 'NÃO' ||
        normalized === 'FALSE'
      ) {
        conditions.push({ sufferedViolence: false });
      }
    }

    if (filters.violenceType?.trim()) {
      conditions.push({
        violenceTypes: {
          has: filters.violenceType.trim(),
        },
      });
    }

    if (filters.q?.trim()) {
      const query = filters.q.trim();
      conditions.push({
        OR: [
          { om: { contains: query, mode: 'insensitive' } },
          { posto: { contains: query, mode: 'insensitive' } },
          { postoGraduacao: { contains: query, mode: 'insensitive' } },
          { autodeclara: { contains: query, mode: 'insensitive' } },
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
    const normalized = this.normalize(value ?? 'AND');
    if (normalized === 'OR') return 'OR';
    return 'AND';
  }

  private extractRows(buffer: Buffer, format: BiImportFormat) {
    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false,
        raw: false,
      });
    } catch {
      throwError('VALIDATION_ERROR', { reason: 'invalid_spreadsheet' });
    }

    const sheetNames = workbook.SheetNames ?? [];
    if (sheetNames.length === 0) {
      throwError('VALIDATION_ERROR', { reason: 'empty_workbook' });
    }

    const preferred = sheetNames.find(
      (name) => this.normalize(name) === this.normalize('BANCO DE DADOS'),
    );
    const selectedName = preferred ?? sheetNames[0];
    const sheet = workbook.Sheets[selectedName];

    if (!sheet) {
      throwError('VALIDATION_ERROR', { reason: 'missing_sheet' });
    }

    const matrix = XLSX.utils.sheet_to_json<
      Array<string | number | boolean | Date | null>
    >(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });

    const rows = matrix.map((row) =>
      row.map((cell) => this.cleanCell(cell) ?? ''),
    );

    return {
      sheetName: format === BiImportFormat.CSV ? 'CSV' : selectedName,
      rows,
    };
  }

  private resolveHeaderMap(headerRow: string[]) {
    const normalizedHeaders = headerRow.map((value) => this.normalize(value));

    const findIndex = (predicates: string[]) => {
      const needles = predicates
        .map((item) => this.normalize(item))
        .filter(Boolean);
      return normalizedHeaders.findIndex((header) =>
        needles.some((needle) => header.includes(needle)),
      );
    };

    const map = {
      submittedAt: findIndex([
        '1Carimbo de data/hora',
        'Carimbo de data/hora',
        'Timestamp',
      ]),
      sufferedViolence: findIndex([
        '2Voce ja sofreu violencia',
        'Ja sofreu violencia',
      ]),
      violenceTypes: findIndex([
        '3Qual tipo de violencia voce sofreu',
        'Tipo de violencia',
      ]),
      postoGraduacao: findIndex(['4POSTO / GRADUACAO', 'POSTO / GRADUACAO']),
      om: findIndex(['5OM']),
      posto: findIndex(['6POSTO']),
      autodeclara: findIndex(['7Como voce se autodeclara', 'Autodeclara']),
      extraColumn: findIndex(['coluna1']),
    };

    if (map.sufferedViolence < 0 || map.violenceTypes < 0 || map.om < 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'missing_required_columns',
        required: [
          '2Voce ja sofreu violencia?',
          '3Qual tipo de violencia voce sofreu?',
          '5OM',
        ],
      });
    }

    return {
      ...map,
      // fallback para layout original em caso de cabecalho parcialmente diferente
      submittedAt: map.submittedAt >= 0 ? map.submittedAt : 0,
      postoGraduacao: map.postoGraduacao >= 0 ? map.postoGraduacao : 3,
      posto: map.posto >= 0 ? map.posto : 5,
      autodeclara: map.autodeclara >= 0 ? map.autodeclara : 6,
      extraColumn: map.extraColumn >= 0 ? map.extraColumn : 7,
    };
  }

  private parseDataRow(
    row: string[],
    map: {
      submittedAt: number;
      sufferedViolence: number;
      violenceTypes: number;
      postoGraduacao: number;
      om: number;
      posto: number;
      autodeclara: number;
      extraColumn: number;
    },
    sourceRow: number,
  ):
    | { skip: true; value?: undefined }
    | { skip: false; value: ParsedSurveyRow | null } {
    const submittedAtRaw = this.getCell(row, map.submittedAt);
    const sufferedRaw = this.getCell(row, map.sufferedViolence);
    const violenceRaw = this.getCell(row, map.violenceTypes);
    const postoGraduacao = this.getCell(row, map.postoGraduacao);
    const om = this.getCell(row, map.om);
    const posto = this.getCell(row, map.posto);
    const autodeclara = this.getCell(row, map.autodeclara);
    const extraColumn = this.getCell(row, map.extraColumn);

    const hasAnyValue = [
      submittedAtRaw,
      sufferedRaw,
      violenceRaw,
      postoGraduacao,
      om,
      posto,
      autodeclara,
      extraColumn,
    ].some((value) => Boolean(value && value.trim()));

    if (!hasAnyValue) {
      return { skip: true };
    }

    const submittedAt = this.parseSubmittedAt(submittedAtRaw);
    const sufferedViolence = this.parseSufferedViolence(sufferedRaw);
    const violenceTypes = this.parseViolenceTypes(violenceRaw);

    const payload = {
      submittedAtRaw,
      sufferedRaw,
      violenceRaw,
      postoGraduacao,
      om,
      posto,
      autodeclara,
      extraColumn,
    };

    const sourceHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          submittedAt: submittedAt?.toISOString() ?? null,
          sufferedViolenceRaw: sufferedRaw,
          sufferedViolence,
          violenceTypes: [...violenceTypes].sort(),
          postoGraduacao,
          om,
          posto,
          autodeclara,
          extraColumn,
        }),
      )
      .digest('hex');

    return {
      skip: false,
      value: {
        submittedAt,
        sufferedViolenceRaw: sufferedRaw,
        sufferedViolence,
        violenceTypes,
        postoGraduacao,
        om,
        posto,
        autodeclara,
        extraColumn,
        rawPayload: payload,
        sourceRow,
        sourceHash,
      },
    };
  }

  private fileExtension(fileName: string) {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(ext)) {
      throwError('BI_FILE_TYPE_INVALID');
    }
    return ext;
  }

  private parseDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private parseSubmittedAt(raw: string | null) {
    if (!raw) return null;

    const normalized = raw.replace(',', '.').trim();
    const numeric = Number(normalized);

    if (Number.isFinite(numeric) && numeric > 25000 && numeric < 70000) {
      const excelEpochUtc = Date.UTC(1899, 11, 30);
      return new Date(excelEpochUtc + numeric * 24 * 60 * 60 * 1000);
    }

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;

    const brPattern = raw.match(
      /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );

    if (brPattern) {
      const day = Number(brPattern[1]);
      const month = Number(brPattern[2]) - 1;
      const year = Number(
        brPattern[3].length === 2 ? `20${brPattern[3]}` : brPattern[3],
      );
      const hour = Number(brPattern[4] ?? 0);
      const minute = Number(brPattern[5] ?? 0);
      const second = Number(brPattern[6] ?? 0);
      const parsed = new Date(year, month, day, hour, minute, second);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
  }

  private parseSufferedViolence(raw: string | null): boolean | null {
    if (!raw) return null;
    const normalized = this.normalize(raw);

    if (['SIM', 'S', 'TRUE', 'YES'].includes(normalized)) return true;
    if (['NAO', 'NÃO', 'N', 'FALSE', 'NO'].includes(normalized)) return false;
    return null;
  }

  private parseViolenceTypes(raw: string | null): string[] {
    if (!raw) return [];

    const tokens = raw
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) return [];

    const normalized = new Set<string>();

    for (const token of tokens) {
      const normalizedToken = this.normalize(token);
      const alias = VIOLENCE_TYPE_ALIASES.find((item) =>
        normalizedToken.includes(this.normalize(item.match)),
      );
      if (alias) {
        normalized.add(alias.label);
        continue;
      }
      normalized.add(this.toTitleCase(token));
    }

    const ordered = [...normalized];
    ordered.sort((a, b) => {
      const ia = KNOWN_VIOLENCE_TYPES.indexOf(
        a as (typeof KNOWN_VIOLENCE_TYPES)[number],
      );
      const ib = KNOWN_VIOLENCE_TYPES.indexOf(
        b as (typeof KNOWN_VIOLENCE_TYPES)[number],
      );
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b, 'pt-BR');
    });

    return ordered;
  }

  private toTitleCase(value: string) {
    return value
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((chunk) => `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`)
      .join(' ')
      .trim();
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toUpperCase();
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
