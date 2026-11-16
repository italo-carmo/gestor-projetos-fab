import { CpcaService } from './cpca.service';

describe('CPCA acompanhamento > 30 dias', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * 86400000);
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  async function stats(cases: any[], history: any[]) {
    const prisma: any = {
      cpcComplaintCase: { findMany: jest.fn().mockResolvedValue(cases) },
      cpcComplaintStatusHistory: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(history),
      },
    };
    const service = new CpcaService(prisma, {} as any);
    jest.spyOn(service as any, 'getScopeConstraints').mockReturnValue({});
    jest
      .spyOn(service as any, 'resolveCpcaScopedLocalityIds')
      .mockResolvedValue(null);
    return service.stats({});
  }
  const row = (id: string, status = 'INVESTIGATION') => ({
    id,
    status,
    caseNumber: id,
    reportedAt: ago(100),
    updatedAt: ago(1),
    complaintType: 'MORAL',
    procedureType: 'NOT_DEFINED',
    om: { id: 'om', code: 'OM', name: 'OM' },
  });
  const transition = (
    id: string,
    days: number,
    fromStatus: string | null = 'PRELIMINARY_ANALYSIS',
    toStatus = 'INVESTIGATION',
  ) => ({
    complaintCaseId: id,
    fromStatus,
    toStatus,
    changedAt: ago(days),
  });

  it('uses entry in acompanhamento, excluding triage, closed cases and missing dates', async () => {
    const result = await stats(
      [
        row('late'),
        row('recent'),
        row('boundary'),
        row('missing'),
        row('procedure', 'PROCEDURE_DEFINED'),
        row('triage', 'PRELIMINARY_ANALYSIS'),
        row('closed', 'CONCLUDED'),
      ],
      [
        transition('late', 31),
        transition('recent', 1),
        transition('boundary', 30),
      ],
    );
    expect(result.summary.followUpOver30Days).toBe(1);
    expect(result.summary.followUpWithoutStartDate).toBe(1);
    expect(result.kpiDetails.followUpOver30Days).toEqual([
      expect.objectContaining({
        caseId: 'late',
        followUpDays: 31,
        followUpStartedAt: ago(31).toISOString(),
      }),
    ]);
  });

  it('restarts the clock on reentry and ignores procedure-only changes', async () => {
    const result = await stats(
      [row('reentry'), row('edited')],
      [
        transition('reentry', 90),
        transition('edited', 60, null),
        transition('reentry', 40, 'INVESTIGATION', 'CONCLUDED'),
        transition('reentry', 2, 'CONCLUDED'),
        transition('edited', 1, 'INVESTIGATION'),
      ],
    );
    expect(result.summary.followUpOver30Days).toBe(1);
    expect(result.kpiDetails.followUpOver30Days[0]).toMatchObject({
      caseId: 'edited',
      followUpDays: 60,
    });
  });

  it('filters before limiting the detail list', async () => {
    const result = await stats(
      [
        ...Array.from({ length: 301 }, (_, i) =>
          row(`procedure-${i}`, 'PROCEDURE_DEFINED'),
        ),
        row('late'),
      ],
      [transition('late', 35)],
    );
    expect(result.summary.followUpOver30Days).toBe(1);
    expect(result.kpiDetails.followUpOver30Days).toHaveLength(1);
  });

  it('returns zero when the filtered base is empty', async () => {
    const result = await stats([], []);
    expect(result.summary.followUpOver30Days).toBe(0);
    expect(result.summary.followUpWithoutStartDate).toBe(0);
  });
});
