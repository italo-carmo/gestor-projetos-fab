import { CpcaService } from './cpca.service';

function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([field, condition]: [string, any]) => {
    if (field === 'AND')
      return condition.every((part: any) => matches(row, part));
    if (field === 'OR')
      return condition.some((part: any) => matches(row, part));
    if (condition === null) return row[field] == null;
    if (condition?.in) return condition.in.includes(row[field]);
    if (condition?.notIn)
      return row[field] != null && !condition.notIn.includes(row[field]);
    return row[field] === condition;
  });
}

describe('reportes: duas situações de acompanhamento', () => {
  const reportedAt = new Date('2026-01-01T12:00:00Z');
  const archivedAt = new Date('2026-01-21T12:00:00Z');
  const rows = [
    ...[
      'RECEIVED',
      'PROTECTION_MEASURES',
      'PRELIMINARY_ANALYSIS',
      'PROCEDURE_DEFINED',
      'INVESTIGATION',
      'CONCLUDED',
      'ARCHIVED',
    ].map((status) => ({
      id: status,
      caseNumber: status,
      status,
      workflowScope: 'CPCA',
      procedureType: 'IPM',
      procedureCurrentSituation: null,
      complaintType: 'MORAL',
      reportedAt,
      archivedAt: ['CONCLUDED', 'ARCHIVED'].includes(status)
        ? archivedAt
        : null,
      updatedAt: new Date('2026-02-01T12:00:00Z'),
      omId: 'om',
      om: { id: 'om', code: 'OM', name: 'OM' },
      comments: [],
    })),
    {
      id: 'judicial',
      caseNumber: 'judicial',
      status: 'INVESTIGATION',
      workflowScope: 'CPCA',
      procedureType: 'IPM',
      complaintType: 'MORAL',
      procedureCurrentSituation: 'ARQUIVADO_PELA_JUSTICA',
      reportedAt,
      updatedAt: archivedAt,
      omId: 'om',
      om: { id: 'om', code: 'OM', name: 'OM' },
      comments: [],
    },
  ];
  function setup(records: any[] = rows) {
    const prisma: any = {
      $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      cpcComplaintCase: {
        findMany: jest.fn(async ({ where }) =>
          records.filter((row) => matches(row, where)),
        ),
        count: jest.fn(
          async ({ where }) =>
            records.filter((row) => matches(row, where)).length,
        ),
      },
      cpcComplaintCipavdThread: { findMany: jest.fn().mockResolvedValue([]) },
      cpcComplaintStatusHistory: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CpcaService(prisma, {} as any);
    jest.spyOn(service as any, 'getScopeConstraints').mockReturnValue({});
    jest
      .spyOn(service as any, 'resolveCpcaScopedLocalityIds')
      .mockResolvedValue(null);
    return service;
  }

  it('conta perfis de todas as vítimas e mantém um único caso em aberto', async () => {
    const service = setup([
      {
        ...rows[0],
        victims: [
          { id: 'v1', victimRank: 'SOLDADO', victimAgeRange: '19_25' },
          { id: 'v2', victimRank: 'TENENTE', victimAgeRange: '31_35' },
        ],
      },
    ]);
    const data = await service.stats({});
    expect(data.summary).toMatchObject({
      totalCases: 1,
      totalVictims: 2,
      openCases: 1,
      concludedCases: 0,
    });
    expect(data.victimAgeRangeDistribution).toEqual([
      { ageRange: '19_25', count: 1 },
      { ageRange: '31_35', count: 1 },
    ]);
    expect(data.topVictimRanks).toEqual([
      { rank: 'SOLDADO', count: 1 },
      { rank: 'TENENTE', count: 1 },
    ]);
    expect(data.kpiDetails.openCases).toHaveLength(1);
  });

  it('inclui arquivados e resultados de arquivamento em concluídos e fecha a soma dos indicadores', async () => {
    const service = setup();
    const data = await service.stats({});
    expect(data.summary).toMatchObject({
      totalCases: 8,
      openCases: 5,
      concludedCases: 3,
      archivedCases: 0,
      closureRatePercent: 38,
      averageDaysToClosure: 20,
    });
    expect(data.statusDistribution).toEqual([
      { status: 'INVESTIGATION', count: 5 },
      { status: 'CONCLUDED', count: 3 },
    ]);
    expect(data.kpiDetails.openCases).toHaveLength(5);
    expect(data.kpiDetails.closureRate).toHaveLength(3);
    expect(
      data.kpiDetails.closureRate.find((row) => row.caseId === 'ARCHIVED'),
    ).toMatchObject({
      status: 'CONCLUDED',
      closedAt: archivedAt.toISOString(),
    });
  });

  it('filtros da lista correspondem aos totais dos indicadores', async () => {
    const service = setup();
    for (const [status, count] of [
      ['INVESTIGATION', 5],
      ['CONCLUDED', 3],
      ['ARCHIVED', 3],
    ] as const) {
      const data = await service.list({ status });
      expect(data.total).toBe(count);
      expect(data.items).toHaveLength(count);
      if (status !== 'INVESTIGATION')
        expect(data.items.every((row) => row.status === 'CONCLUDED')).toBe(
          true,
        );
    }
  });
});
