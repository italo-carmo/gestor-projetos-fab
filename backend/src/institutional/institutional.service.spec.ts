import { ActivityScope } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPublicCpcaContacts,
  InstitutionalService,
} from './institutional.service';

describe('buildPublicCpcaContacts', () => {
  const contactItems = (email?: string, intraerUrl?: string) => [
    {
      itemKey: 'EMAIL_DIRETO_RELATOS',
      isCompleted: Boolean(email),
      details: email ?? null,
    },
    {
      itemKey: 'LINK_INTRAER_CPCA',
      isCompleted: Boolean(intraerUrl),
      details: intraerUrl ?? null,
    },
  ];

  it('inherits the manager CPCA contacts for an OM covered by another commission', () => {
    const result = buildPublicCpcaContacts([
      {
        id: '1gda',
        code: '1 GDA',
        name: 'Primeiro Grupo de Defesa Aérea',
        uf: 'RN',
        hasCpca: false,
        cpcaChecklistItems: [],
        cpcaCoverageAsManaged: [
          {
            managerOm: {
              id: 'baan',
              code: 'BAAN',
              name: 'Base Aérea de Natal',
              uf: 'RN',
              cpcaChecklistItems: contactItems(
                'cpca.baan@fab.mil.br',
                'https://intraer.fab.mil.br/cpca-baan',
              ),
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        coverageType: 'MANAGED_BY_OTHER',
        email: 'cpca.baan@fab.mil.br',
        intraerUrl: 'https://intraer.fab.mil.br/cpca-baan',
      }),
    );
    expect(result[0]?.servedOm.code).toBe('1 GDA');
    expect(result[0]?.responsibleCpca.code).toBe('BAAN');
  });

  it('publishes only completed contact items with valid values', () => {
    const result = buildPublicCpcaContacts([
      {
        id: 'om-1',
        code: 'OM1',
        name: 'Organização 1',
        uf: 'DF',
        hasCpca: true,
        cpcaChecklistItems: [
          {
            itemKey: 'EMAIL_DIRETO_RELATOS',
            isCompleted: false,
            details: 'nao-publicar@fab.mil.br',
          },
          {
            itemKey: 'LINK_INTRAER_CPCA',
            isCompleted: true,
            details: 'endereço inválido',
          },
        ],
        cpcaCoverageAsManaged: [],
      },
    ]);

    expect(result).toEqual([]);
  });
});

describe('InstitutionalService public content', () => {
  it('publishes member photos, LDAP war names and institutional content', async () => {
    const updatedAt = new Date('2026-07-30T12:00:00.000Z');
    const member = {
      id: 'flavia',
      name: '2S FLAVIA COMGEP',
      email: 'flavia@fab.mil.br',
      ldapUid: 'flavia',
      om: { code: 'DIRENS' },
      commissionFunction: 'Membro',
      commissionSeniority: 1,
      updatedAt,
    };
    const locality = {
      id: 'belem',
      code: 'BE',
      name: 'Belém',
      uf: 'PA',
    };
    const mission = {
      id: 'mission-1',
      title: 'Missão CIPAVD Belém',
      description: 'Ação institucional',
      scope: ActivityScope.CIPAVD,
      startDate: new Date('2026-08-10T12:00:00.000Z'),
      endDate: new Date('2026-08-12T12:00:00.000Z'),
      updatedAt,
      locality,
    };
    const prisma = {
      role: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'commission-role', name: 'Coordenação CIPAVD' },
          ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([member]),
        findFirst: jest.fn().mockResolvedValue({
          id: member.id,
          name: member.name,
          email: member.email,
          ldapUid: member.ldapUid,
          om: member.om,
        }),
      },
      mission: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([mission])
          .mockResolvedValueOnce([
            { ...mission, scheduleItems: [{ location: 'Auditório' }] },
          ]),
      },
      socialCommunicationArticle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'article-1',
            sourceUrl: 'https://www.fab.mil.br/noticia',
            title: 'Notícia institucional',
            coverImageUrl: null,
            summary: 'Conteúdo para o público externo.',
            contentText: null,
            audience: 'EXTERNAL',
            publishedAt: updatedAt,
            createdAt: updatedAt,
            updatedAt,
          },
        ]),
      },
      om: { findMany: jest.fn().mockResolvedValue([]) },
      libraryPhoto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'photo-1',
            title: 'Registro em Belém',
            scope: ActivityScope.CIPAVD,
            mimeType: 'image/jpeg',
            sortOrder: 0,
            createdAt: updatedAt,
            updatedAt,
            locality,
          },
        ]),
      },
      libraryDocument: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const auth = {
      getSigpesPhotoByOrder: jest.fn().mockResolvedValue({
        base64: Buffer.from('member-photo').toString('base64'),
        mimeType: 'image/jpeg',
      }),
    };
    const fabLdap = {
      lookupByUid: jest.fn().mockResolvedValue({
        uid: 'flavia',
        dn: 'uid=flavia,ou=people,dc=fab,dc=mil,dc=br',
        name: '2S FLAVIA',
        email: member.email,
        fabom: 'COMGEP',
        numeroOrdem: '1234567',
      }),
    };
    const service = new InstitutionalService(
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
      fabLdap as unknown as FabLdapService,
    );

    const result = await service.getPageData();

    expect(result.members[0]).toEqual(
      expect.objectContaining({
        name: '2S FLAVIA',
        photoUrl: '/institutional/members/flavia/photo',
      }),
    );
    expect(result.members[0]).not.toHaveProperty('email');
    expect(result.members[0]).not.toHaveProperty('ldapUid');
    expect(result.members[0]).not.toHaveProperty('numeroOrdem');
    expect(result.actions[0]).not.toHaveProperty('activities');
    expect(result.agenda[0]).toEqual(
      expect.objectContaining({ title: 'Missão CIPAVD Belém' }),
    );
    expect(result.agenda[0]).not.toHaveProperty('activity');
    expect(result.news[0]).toEqual(
      expect.objectContaining({
        title: 'Notícia institucional',
        audience: 'EXTERNAL',
      }),
    );
    expect(result.library.groups[0].title).toBe('Belém');

    const photo = await service.getMemberPhoto('flavia');
    expect(photo.contentType).toBe('image/jpeg');
    expect(photo.buffer.toString()).toBe('member-photo');
    expect(fabLdap.lookupByUid).toHaveBeenCalledTimes(1);
  });
});
