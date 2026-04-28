import { describe, expect, it } from 'vitest';
import {
  buildMissionFieldActivityDrafts,
  buildMissionFieldActivityRequestItems,
  getMissionFieldActivityValidationMessage,
  normalizeMissionScope,
  scheduleStartToDateInput,
} from './missionFieldActivities';

describe('mission field activity helpers', () => {
  it('normalizes mission scope for the destination activity list', () => {
    expect(normalizeMissionScope('CIPAVD')).toBe('CIPAVD');
    expect(normalizeMissionScope('cipavd')).toBe('CIPAVD');
    expect(normalizeMissionScope('SMIF')).toBe('SMIF');
    expect(normalizeMissionScope(undefined)).toBe('SMIF');
  });

  it('builds one create draft per selected schedule item in schedule order', () => {
    const drafts = buildMissionFieldActivityDrafts(
      [
        {
          id: 'item-1',
          title: 'Palestra',
          startAt: '2026-04-28T12:30:00.000Z',
        },
        { id: 'item-2', title: 'Reuniao', startAt: '2026-04-29T12:30:00.000Z' },
      ],
      ['item-2', 'item-1'],
      { activityTypeId: 'type-1', specialtyIds: ['spec-1'] },
    );

    expect(drafts).toEqual([
      expect.objectContaining({
        scheduleItemId: 'item-1',
        action: 'CREATE',
        title: 'Palestra',
        activityTypeId: 'type-1',
        specialtyIds: ['spec-1'],
        reportRequired: true,
      }),
      expect.objectContaining({
        scheduleItemId: 'item-2',
        title: 'Reuniao',
      }),
    ]);
  });

  it('validates create and link drafts before sending', () => {
    expect(
      getMissionFieldActivityValidationMessage({
        scheduleItemId: 'item-1',
        action: 'CREATE',
        activityId: '',
        title: '',
        eventDate: '2026-04-28',
        activityTypeId: '',
        specialtyIds: [],
        responsibleUserId: '',
        reportRequired: true,
      }),
    ).toBe('Informe o título.');

    expect(
      getMissionFieldActivityValidationMessage({
        scheduleItemId: 'item-1',
        action: 'LINK',
        activityId: '',
        title: 'Base',
        eventDate: '2026-04-28',
        activityTypeId: '',
        specialtyIds: [],
        responsibleUserId: '',
        reportRequired: true,
      }),
    ).toBe('Selecione a atividade existente.');
  });

  it('serializes create and link drafts into the API contract', () => {
    expect(
      buildMissionFieldActivityRequestItems([
        {
          scheduleItemId: 'item-1',
          action: 'CREATE',
          activityId: '',
          title: 'Palestra',
          eventDate: '2026-04-28',
          activityTypeId: 'type-1',
          specialtyIds: ['spec-1'],
          responsibleUserId: 'user-1',
          reportRequired: true,
        },
        {
          scheduleItemId: 'item-2',
          action: 'LINK',
          activityId: 'activity-2',
          title: 'Ignorado',
          eventDate: '2026-04-29',
          activityTypeId: 'type-2',
          specialtyIds: ['spec-2'],
          responsibleUserId: 'user-2',
          reportRequired: false,
        },
      ]),
    ).toEqual([
      {
        scheduleItemId: 'item-1',
        action: 'CREATE',
        activityId: null,
        title: 'Palestra',
        activityTypeId: 'type-1',
        specialtyIds: ['spec-1'],
        responsibleUserIds: ['user-1'],
        eventDate: '2026-04-28',
        reportRequired: true,
      },
      {
        scheduleItemId: 'item-2',
        action: 'LINK',
        activityId: 'activity-2',
        title: undefined,
        activityTypeId: undefined,
        specialtyIds: undefined,
        responsibleUserIds: [],
        eventDate: undefined,
        reportRequired: undefined,
      },
    ]);
  });

  it('formats schedule start dates as date input values', () => {
    expect(scheduleStartToDateInput('')).toBe('');
    expect(scheduleStartToDateInput('invalid')).toBe('');
    expect(scheduleStartToDateInput('2026-04-28T03:00:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
