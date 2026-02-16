import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { sanitizeForExecutive } from '../common/executive';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async query(q: string, user?: RbacUser) {
    const query = q?.trim();
    if (!query) {
      return { tasks: [], notices: [], meetings: [], localities: [] };
    }

    const taskWhere: any = {
      taskTemplate: { title: { contains: query, mode: 'insensitive' } },
    };
    if (user?.localityId) taskWhere.localityId = user.localityId;

    const noticeWhere: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (user?.localityId) {
      noticeWhere.AND = [
        { OR: [{ localityId: null }, { localityId: user.localityId }] },
      ];
    }
    if (user?.specialtyId) {
      noticeWhere.AND = [
        ...(noticeWhere.AND ?? []),
        { OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }] },
      ];
    }

    const meetingWhere: any = {
      OR: [
        { agenda: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (user?.localityId) {
      meetingWhere.AND = [{ OR: [{ localityId: null }, { localityId: user.localityId }] }];
    }

    const localityWhere: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (user?.localityId) localityWhere.id = user.localityId;

    const [tasks, notices, meetings, localities] = await this.prisma.$transaction([
      this.prisma.taskInstance.findMany({
        where: taskWhere,
        include: { taskTemplate: true, locality: true },
        take: 10,
      }),
      this.prisma.notice.findMany({
        where: noticeWhere,
        take: 10,
      }),
      this.prisma.meeting.findMany({
        where: meetingWhere,
        take: 10,
      }),
      this.prisma.locality.findMany({
        where: localityWhere,
        take: 10,
      }),
    ]);

    const payload = {
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.taskTemplate?.title ?? '',
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
    };

    return user?.executiveHidePii ? sanitizeForExecutive(payload) : payload;
  }
}
