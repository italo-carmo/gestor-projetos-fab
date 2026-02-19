import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { sanitizeForExecutive } from '../common/executive';
import { resolveAccessProfile } from '../rbac/role-access';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async query(q: string, user?: RbacUser) {
    const query = q?.trim();
    if (!query) {
      return { tasks: [], notices: [], meetings: [], localities: [], documents: [] };
    }

    const constraints = this.getScopeConstraints(user);

    const taskWhere: any = {
      taskTemplate: { title: { contains: query, mode: 'insensitive' } },
    };
    if (constraints.localityId) taskWhere.localityId = constraints.localityId;
    if (constraints.specialtyId) {
      taskWhere.taskTemplate = {
        ...taskWhere.taskTemplate,
        specialtyId: constraints.specialtyId,
      };
    }

    const noticeWhere: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (constraints.localityId) {
      noticeWhere.AND = [
        { OR: [{ localityId: null }, { localityId: constraints.localityId }] },
      ];
    }
    if (constraints.specialtyId) {
      noticeWhere.AND = [
        ...(noticeWhere.AND ?? []),
        { OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }] },
      ];
    }

    const meetingWhere: any = {
      OR: [
        { agenda: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (constraints.localityId) {
      meetingWhere.AND = [{ OR: [{ localityId: null }, { localityId: constraints.localityId }] }];
    }

    const localityWhere: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (constraints.localityId) localityWhere.id = constraints.localityId;

    const documentWhere: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { sourcePath: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (constraints.localityId) {
      documentWhere.AND = [{ OR: [{ localityId: null }, { localityId: constraints.localityId }] }];
    }

    const [tasks, notices, meetings, localities, documents] = await this.prisma.$transaction([
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
      this.prisma.documentAsset.findMany({
        where: documentWhere,
        include: { locality: { select: { id: true, name: true, code: true } } },
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
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        localityId: doc.localityId,
        localityName: doc.locality?.name ?? null,
        fileName: doc.fileName,
      })),
    };

    return user?.executiveHidePii ? sanitizeForExecutive(payload) : payload;
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return {};
    if (profile.localityAdmin) {
      return { localityId: profile.localityId ?? undefined, specialtyId: undefined };
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
