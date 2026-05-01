import { describe, expect, it } from 'vitest';
import {
  buildMissionFieldActivityDraft,
  buildMissionFieldActivityDrafts,
  buildMissionFieldActivityRequestItems,
  getMissionFieldActivityValidationMessage,
  getMissionScheduleItemLinkedActivities,
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
        id: 'draft-1',
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
        id: 'draft-2',
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
          id: 'draft-1',
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
          id: 'draft-2',
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

  it('creates additional drafts for the same schedule item', () => {
    const first = buildMissionFieldActivityDraft(
      { id: 'item-1', title: 'Reunião com as CPCAs', startAt: '2026-04-28T12:30:00.000Z' },
      { activityTypeId: 'type-1' },
      { id: 'item-1:create:1' },
    );
    const second = buildMissionFieldActivityDraft(
      { id: 'item-1', title: 'Reunião com as CPCAs', startAt: '2026-04-28T12:30:00.000Z' },
      { activityTypeId: 'type-2' },
      { id: 'item-1:create:2' },
    );

    expect(first.scheduleItemId).toBe('item-1');
    expect(second.scheduleItemId).toBe('item-1');
    expect(first.id).not.toBe(second.id);
    expect(first.title).toBe('Reunião com as CPCAs');
  });

  it('deduplicates legacy and multi-linked activities for a schedule item', () => {
    expect(
      getMissionScheduleItemLinkedActivities({
        activityId: 'activity-1',
        activity: { id: 'activity-1', title: 'Acompanhamento CPCA' },
        activityLinks: [
          { activity: { id: 'activity-1', title: 'Acompanhamento CPCA' } },
          { activity: { id: 'activity-2', title: 'Questionário CPCA' } },
        ],
      }).map((activity) => activity.title),
    ).toEqual(['Acompanhamento CPCA', 'Questionário CPCA']);
  });
});
