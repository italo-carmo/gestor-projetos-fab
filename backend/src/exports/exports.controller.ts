import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from '../tasks/tasks.service';
import { ChecklistsService } from '../checklists/checklists.service';

@Controller('exports')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ExportsController {
  constructor(
    private readonly tasks: TasksService,
    private readonly checklists: ChecklistsService,
  ) {}

  @Get('tasks.csv')
  @RequirePermission('task_instances', 'export')
  async exportTasks(
    @Query('localityId') localityId: string | undefined,
    @Query('phaseId') phaseId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('assigneeId') assigneeId: string | undefined,
    @Query('assigneeIds') assigneeIds: string | undefined,
    @Query('dueFrom') dueFrom: string | undefined,
    @Query('dueTo') dueTo: string | undefined,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const items = await this.tasks.listTaskInstancesForExport(
      { localityId, phaseId, status, assigneeId, assigneeIds, dueFrom, dueTo },
      user,
    );

    const headers = [
      'taskId',
      'title',
      'phase',
      'locality',
      'status',
      'priority',
      'dueDate',
      'assigneeTipo',
      'assigneeId',
      'assigneeNome',
      'progressPercent',
      'isLate',
      'meetingId',
    ];

    const rows = items.map((item: any) => [
      item.id,
      item.taskTemplate?.title ?? '',
      item.taskTemplate?.phase?.name ?? '',
      item.locality?.name ?? item.localityId ?? '',
      item.status,
      item.priority,
      item.dueDate ? new Date(item.dueDate).toISOString() : '',
      item.assignee?.type ?? item.assigneeType ?? '',
      item.assignedToId ?? item.assignedEloId ?? '',
      item.assignee?.name ?? item.externalAssigneeName ?? '',
      String(item.progressPercent ?? 0),
      item.isLate ? 'true' : 'false',
      item.meetingId ?? '',
    ]);

    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
    res.send(csv);
  }

  @Get('checklists.csv')
  @RequirePermission('checklists', 'export')
  async exportChecklists(
    @Query('phaseId') phaseId: string | undefined,
    @Query('specialtyId') specialtyId: string | undefined,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const data = await this.checklists.list({ phaseId, specialtyId }, user);
    const localities = data.localities ?? [];

    const headers = ['checklist', 'item', ...localities.map((l: any) => l.name)];
    const rows: string[][] = [];
    for (const checklist of data.items ?? []) {
      for (const item of checklist.items ?? []) {
        rows.push([
          checklist.title,
          item.title,
          ...localities.map((loc: any) => item.statuses?.[loc.id] ?? ''),
        ]);
      }
    }

    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="checklists.csv"');
    res.send(csv);
  }
}

function toCsv(headers: string[], rows: string[][]) {
  const escape = (value: string) => {
    const sanitized = value ?? '';
    if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n')) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map((cell) => escape(String(cell ?? ''))).join(','));
  }
  return lines.join('\n');
}
