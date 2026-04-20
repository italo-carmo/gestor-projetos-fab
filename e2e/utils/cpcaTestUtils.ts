import type { Page, Route } from '@playwright/test';

type Permission = {
  resource: string;
  action: string;
  scope?: 'LOCAL' | 'NATIONAL';
};

type MockOm = {
  id: string;
  code: string;
  name: string;
  uf?: string | null;
  hasCpca?: boolean;
};

type MockUser = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  omId?: string;
  permissions: Permission[];
};

type MockHistoryItem = {
  id: string;
  action: string;
  actionLabel: string;
  summary: string;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
};

type MockCoverageRequest = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  requestedByUser: {
    id: string;
    name: string;
    email?: string | null;
  };
  requestedManagedLocalities: MockOm[];
};

type MockSelfRegistrationRequest = {
  id: string;
  type: 'SELF_REGISTRATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  locality: MockOm;
  applicant: {
    id: string;
    name: string;
    email?: string | null;
  };
  requestedAsSubstitution: boolean;
  bulletinNumber: string;
};

type MockNominationRequest = {
  id: string;
  type: 'PRESIDENT_NOMINATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  locality: MockOm;
  requestedByUser: {
    id: string;
    name: string;
    email?: string | null;
  };
  nominee: {
    id?: string;
    name?: string | null;
    displayName?: string | null;
    email?: string | null;
    ldapUid?: string | null;
  };
  requestedAsSubstitution?: boolean;
  bulletinNumber?: string | null;
};

type MockCase = {
  id: string;
  caseNumber: string;
  omId: string;
  locality: {
    id: string;
    code: string;
    name: string;
  };
  complaintType: 'MORAL' | 'SEXUAL';
  detailedViolenceType: string;
  status: string;
  procedureType: string;
  reportedAt: string;
};

type MockCurrentPresident = {
  user: {
    id: string;
    name: string;
    email: string;
    ldapUid?: string | null;
  };
  designationBulletin?: string | null;
  isSubstitution: boolean;
  assignedAt: string;
  assignmentSource?: string | null;
  assignmentSourceLabel?: string | null;
  assignedByUser?: { id: string; name: string; email: string } | null;
};

type CpcaE2eActorKey = 'ti' | 'approvedPresident' | 'member';

export type CpcaE2eActor = {
  key: CpcaE2eActorKey;
  accessToken: string;
  roleId: string;
  id: string;
  email: string;
  name: string;
};

type CpcaE2eState = {
  currentPresident: MockCurrentPresident;
  selfRegistrationRequest: MockSelfRegistrationRequest;
  pendingPresidentNominationRequest: MockNominationRequest | null;
  pendingCoverageRequest: MockCoverageRequest | null;
  managedLocalities: MockOm[];
  members: Array<{
    id: string;
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      ldapUid?: string | null;
    };
    addedByUser?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  history: MockHistoryItem[];
  cases: MockCase[];
};

export type CpcaE2eScenario = {
  namespace: string;
  ti: CpcaE2eActor;
  roleCpcaId: string;
  managerOm: MockOm;
  managedOm: MockOm;
  outsiderOm: MockOm;
  approvedPresident: CpcaE2eActor;
  member: CpcaE2eActor;
  selfRegistrationApplicantName: string;
  caseOwnNumber: string;
  caseManagedNumber: string;
  caseOutsiderNumber: string;
  state: CpcaE2eState;
};

export type CpcaMockSession = {
  loginAs: (actor: CpcaE2eActor) => Promise<void>;
};

function isoNow(seedMinutes = 0) {
  const date = new Date(Date.UTC(2026, 3, 20, 12, 0 + seedMinutes, 0));
  return date.toISOString();
}

function nextHistoryId(prefix: string, index: number) {
  return `${prefix}-hist-${index + 1}`;
}

function json(route: Route, status: number, data: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

function buildActor(
  key: CpcaE2eActorKey,
  user: MockUser,
): CpcaE2eActor {
  return {
    key,
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    accessToken: `e2e-${key}-token`,
  };
}

function buildMe(actor: MockUser) {
  return {
    id: actor.id,
    email: actor.email,
    name: actor.name,
    omId: actor.omId ?? null,
    activeRoleId: actor.roleId,
    activeRole: {
      id: actor.roleId,
      name: actor.roleName,
    },
    roles: [
      {
        id: actor.roleId,
        name: actor.roleName,
        role: {
          id: actor.roleId,
          name: actor.roleName,
        },
      },
    ],
    permissions: actor.permissions,
    executive_hide_pii: false,
  };
}

function createMockUsers(namespace: string, managerOmId: string) {
  const ti: MockUser = {
    id: `${namespace}-user-ti`,
    email: 'ti@smif.local',
    name: 'Usuário TI E2E',
    roleId: `${namespace}-role-ti`,
    roleName: 'TI',
    permissions: [
      { resource: 'cpca_cases', action: 'view', scope: 'NATIONAL' },
      { resource: 'cpca_dashboard', action: 'view', scope: 'NATIONAL' },
      { resource: 'dashboard', action: 'view', scope: 'NATIONAL' },
      { resource: 'bi', action: 'view', scope: 'NATIONAL' },
      { resource: 'localities', action: 'view', scope: 'NATIONAL' },
    ],
  };

  const president: MockUser = {
    id: `${namespace}-user-president`,
    email: `${namespace.toLowerCase()}.presidente@e2e.cpca.local`,
    name: `Presidente Solicitante ${namespace}`,
    roleId: `${namespace}-role-cpca-president`,
    roleName: 'CPCA',
    omId: managerOmId,
    permissions: [{ resource: 'cpca_cases', action: 'view', scope: 'LOCAL' }],
  };

  const member: MockUser = {
    id: `${namespace}-user-member`,
    email: `${namespace.toLowerCase()}.membro@e2e.cpca.local`,
    name: `Membro CPCA ${namespace}`,
    roleId: `${namespace}-role-cpca-member`,
    roleName: 'CPCA',
    omId: managerOmId,
    permissions: [{ resource: 'cpca_cases', action: 'view', scope: 'LOCAL' }],
  };

  const currentPresident: MockUser = {
    id: `${namespace}-user-current-president`,
    email: `${namespace.toLowerCase()}.presidente.atual@e2e.cpca.local`,
    name: `Presidente Atual ${namespace}`,
    roleId: `${namespace}-role-cpca-current`,
    roleName: 'CPCA',
    omId: managerOmId,
    permissions: [{ resource: 'cpca_cases', action: 'view', scope: 'LOCAL' }],
  };

  return { ti, president, member, currentPresident };
}

function buildApprovalRequests(scenario: CpcaE2eScenario) {
  const items: Array<Record<string, unknown>> = [];
  if (scenario.state.selfRegistrationRequest.status === 'PENDING') {
    items.push(scenario.state.selfRegistrationRequest);
  }
  if (scenario.state.pendingPresidentNominationRequest?.status === 'PENDING') {
    items.push(scenario.state.pendingPresidentNominationRequest);
  }
  if (scenario.state.pendingCoverageRequest?.status === 'PENDING') {
    items.push({
      id: scenario.state.pendingCoverageRequest.id,
      type: 'COVERAGE',
      status: 'PENDING',
      createdAt: scenario.state.pendingCoverageRequest.createdAt,
      locality: scenario.managerOm,
      requestedByUser: scenario.state.pendingCoverageRequest.requestedByUser,
      requestedManagedLocalities:
        scenario.state.pendingCoverageRequest.requestedManagedLocalities,
    });
  }
  return items;
}

function pendingCount(scenario: CpcaE2eScenario) {
  return buildApprovalRequests(scenario).length;
}

function buildCommissionOverview(
  scenario: CpcaE2eScenario,
  actor: MockUser,
  localityId?: string | null,
) {
  const isApprover = actor.roleName === 'TI' || actor.roleName === 'COMGEP';
  const isCurrentPresident =
    actor.id === scenario.state.currentPresident.user.id;
  const canManageMembers = isApprover || isCurrentPresident;
  const canManageCoverage = isApprover || isCurrentPresident;
  const canNominatePresident = isCurrentPresident;
  const canAssignPresident = isApprover;
  const locality =
    localityId && localityId === scenario.managerOm.id
      ? scenario.managerOm
      : scenario.managerOm;

  return {
    locality,
    currentPresident: scenario.state.currentPresident,
    members: scenario.state.members,
    managedLocalities: scenario.state.managedLocalities,
    availableManagedLocalities: [scenario.managedOm, scenario.outsiderOm].map(
      (item) => ({
        ...item,
        hasCpca: Boolean(item.hasCpca),
      }),
    ),
    pendingCoverageRequest:
      canManageCoverage || canAssignPresident
        ? scenario.state.pendingCoverageRequest
        : scenario.state.pendingCoverageRequest,
    pendingPresidentNominationRequest:
      scenario.state.pendingPresidentNominationRequest,
    history: scenario.state.history,
    canManageMembers,
    canAssignPresident,
    canNominatePresident,
    canManageCoverage,
    managesCoverageByApproval: !isApprover,
  };
}

function buildCasesResponse(
  scenario: CpcaE2eScenario,
  actor: MockUser,
  query: URLSearchParams,
) {
  const q = String(query.get('q') ?? '').trim().toLowerCase();
  const visibleOmIds =
    actor.roleName === 'TI' || actor.roleName === 'COMGEP'
      ? [scenario.managerOm.id, scenario.managedOm.id, scenario.outsiderOm.id]
      : [scenario.managerOm.id, ...scenario.state.managedLocalities.map((item) => item.id)];

  const items = scenario.state.cases
    .filter((item) => visibleOmIds.includes(item.omId))
    .filter((item) =>
      q ? item.caseNumber.toLowerCase().includes(q) : true,
    );

  return {
    items,
    total: items.length,
    page: 1,
    pageSize: query.get('pageSize') === 'all' ? items.length : 20,
  };
}

async function handleApiRequest(
  route: Route,
  scenario: CpcaE2eScenario,
  getActor: () => MockUser,
) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname.replace(/^\/api/, '') || '/';
  const actor = getActor();

  if (request.method() === 'GET' && pathname === '/auth/me') {
    return json(route, 200, buildMe(actor));
  }

  if (request.method() === 'GET' && pathname === '/auth/me/fab-profile') {
    return json(route, 200, { numeroOrdem: null });
  }

  if (request.method() === 'GET' && pathname.startsWith('/auth/fotoes/')) {
    return json(route, 200, {
      numeroOrdem: '',
      mimeType: null,
      fileName: null,
      base64: null,
      dataUrl: null,
    });
  }

  if (request.method() === 'GET' && pathname === '/menu-updates') {
    const menuKeys = String(url.searchParams.get('menuKeys') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return json(route, 200, {
      items: menuKeys.map((menuKey) => ({
        menuKey,
        unreadCount:
          menuKey === 'cpca_president_approvals' &&
          (actor.roleName === 'TI' || actor.roleName === 'COMGEP')
            ? pendingCount(scenario)
            : 0,
        hasUnread:
          menuKey === 'cpca_president_approvals' &&
          (actor.roleName === 'TI' || actor.roleName === 'COMGEP') &&
          pendingCount(scenario) > 0,
        lastEventAt: pendingCount(scenario) > 0 ? isoNow(8) : null,
        seenAt: null,
      })),
    });
  }

  if (request.method() === 'POST' && pathname.startsWith('/menu-updates/')) {
    const menuKey = pathname.split('/')[2] ?? '';
    return json(route, 200, {
      ok: true,
      menuKey,
      seenAt: isoNow(30),
    });
  }

  if (request.method() === 'GET' && pathname === '/localities') {
    return json(route, 200, { items: [] });
  }

  if (request.method() === 'GET' && pathname === '/users') {
    return json(route, 200, {
      items: [
        {
          id: scenario.approvedPresident.id,
          name: scenario.approvedPresident.name,
          email: scenario.approvedPresident.email,
          omId: scenario.managerOm.id,
          roles: [
            {
              role: {
                id: scenario.roleCpcaId,
                name: 'CPCA',
              },
            },
          ],
        },
        {
          id: scenario.member.id,
          name: scenario.member.name,
          email: scenario.member.email,
          omId: scenario.managerOm.id,
          roles: [
            {
              role: {
                id: scenario.roleCpcaId,
                name: 'CPCA',
              },
            },
          ],
        },
      ],
    });
  }

  if (request.method() === 'GET' && pathname === '/oms') {
    return json(route, 200, {
      items: [
        {
          ...scenario.managerOm,
          notes: null,
          cpcaManagedByLocality: null,
          cpcaManagedLocalityIds: scenario.state.managedLocalities.map(
            (item) => item.id,
          ),
          cpcaManagedLocalities: scenario.state.managedLocalities,
        },
        {
          ...scenario.managedOm,
          notes: null,
          cpcaManagedByLocality:
            scenario.state.managedLocalities.some(
              (item) => item.id === scenario.managedOm.id,
            )
              ? {
                  id: scenario.managerOm.id,
                  code: scenario.managerOm.code,
                  name: scenario.managerOm.name,
                }
              : null,
          cpcaManagedLocalityIds: [],
          cpcaManagedLocalities: [],
        },
        {
          ...scenario.outsiderOm,
          notes: null,
          cpcaManagedByLocality: null,
          cpcaManagedLocalityIds: [],
          cpcaManagedLocalities: [],
        },
      ],
    });
  }

  if (request.method() === 'GET' && pathname === '/oms/catalog') {
    return json(route, 200, {
      items: [
        { ...scenario.managerOm, hasCpca: true },
        { ...scenario.managedOm, hasCpca: false },
        { ...scenario.outsiderOm, hasCpca: false },
      ],
    });
  }

  if (
    request.method() === 'GET' &&
    pathname === '/cpca-commission/approval-requests/pending-count'
  ) {
    return json(route, 200, { pendingCount: pendingCount(scenario) });
  }

  if (
    request.method() === 'POST' &&
    pathname === '/cpca-commission/presidents/lookup'
  ) {
    return json(route, 200, {
      identifier: scenario.member.email,
      profile: {
        uid: `${scenario.namespace.toLowerCase()}-member`,
        name: scenario.member.name,
        email: scenario.member.email,
        fabom: scenario.managerOm.code,
      },
      existingUser: {
        id: scenario.member.id,
        name: scenario.member.name,
        email: scenario.member.email,
        ldapUid: `${scenario.namespace.toLowerCase()}-member`,
        localityId: scenario.managerOm.id,
      },
    });
  }

  if (
    request.method() === 'GET' &&
    pathname === '/cpca-commission/approval-requests'
  ) {
    const status = String(url.searchParams.get('status') ?? 'PENDING').trim();
    const items = buildApprovalRequests(scenario).filter(
      (item) => String(item.status) === status,
    );
    return json(route, 200, { items, pendingCount: pendingCount(scenario) });
  }

  if (
    request.method() === 'POST' &&
    pathname === '/cpca-commission/president-nominations'
  ) {
    const body = request.postDataJSON() as {
      identifier: string;
      bulletinNumber?: string;
      isSubstitution?: boolean;
    };
    scenario.state.pendingPresidentNominationRequest = {
      id: `${scenario.namespace}-nomination-request`,
      type: 'PRESIDENT_NOMINATION',
      status: 'PENDING',
      createdAt: isoNow(40),
      locality: scenario.managerOm,
      requestedByUser: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
      },
      nominee: {
        id: scenario.member.id,
        name: scenario.member.name,
        displayName: scenario.member.name,
        email: scenario.member.email,
        ldapUid: `${scenario.namespace.toLowerCase()}-member`,
      },
      requestedAsSubstitution: body.isSubstitution ?? true,
      bulletinNumber: body.bulletinNumber ?? `${scenario.namespace}/SUC`,
    };
    scenario.state.history.unshift({
      id: nextHistoryId(scenario.namespace, scenario.state.history.length),
      action: 'cpca_president_nomination_requested',
      actionLabel: 'Solicitação de sucessão criada',
      summary: 'Próximo presidente indicado para homologação.',
      createdAt: isoNow(40),
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
      },
    });
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname ===
      `/cpca-commission/approval-requests/SELF_REGISTRATION/${scenario.state.selfRegistrationRequest.id}/approve`
  ) {
    const body = request.postDataJSON() as {
      proceedWithExistingPresident?: boolean;
    };
    if (!body?.proceedWithExistingPresident) {
      return json(route, 409, {
        message: 'Esta OM já possui presidente registrado.',
        details: {
          reason: 'CPCA_LOCALITY_ALREADY_HAS_PRESIDENT',
          currentPresident: scenario.state.currentPresident.user.name,
          localityName: scenario.managerOm.name,
        },
      });
    }

    scenario.state.selfRegistrationRequest.status = 'APPROVED';
    scenario.state.currentPresident = {
      user: {
        id: scenario.approvedPresident.id,
        name: scenario.approvedPresident.name,
        email: scenario.approvedPresident.email,
      },
      designationBulletin: scenario.state.selfRegistrationRequest.bulletinNumber,
      isSubstitution: true,
      assignedAt: isoNow(10),
      assignmentSource: 'SELF_REGISTRATION_APPROVAL',
      assignmentSourceLabel: 'Homologado por autoinscrição',
      assignedByUser: {
        id: scenario.ti.id,
        name: scenario.ti.name,
        email: scenario.ti.email,
      },
    };
    scenario.state.history.unshift({
      id: nextHistoryId(scenario.namespace, scenario.state.history.length),
      action: 'cpca_president_assignment',
      actionLabel: 'Presidente definido',
      summary: 'Homologado por autoinscrição',
      createdAt: isoNow(10),
      actor: {
        id: scenario.ti.id,
        name: scenario.ti.name,
        email: scenario.ti.email,
      },
    });
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname ===
      `/cpca-commission/approval-requests/PRESIDENT_NOMINATION/${scenario.state.pendingPresidentNominationRequest?.id ?? 'missing'}/approve`
  ) {
    if (!scenario.state.pendingPresidentNominationRequest) {
      return json(route, 404, { message: 'Solicitação não encontrada.' });
    }
    scenario.state.pendingPresidentNominationRequest.status = 'APPROVED';
    scenario.state.currentPresident = {
      user: {
        id: scenario.member.id,
        name: scenario.member.name,
        email: scenario.member.email,
      },
      designationBulletin:
        scenario.state.pendingPresidentNominationRequest.bulletinNumber ??
        `${scenario.namespace}/SUC`,
      isSubstitution: Boolean(
        scenario.state.pendingPresidentNominationRequest.requestedAsSubstitution,
      ),
      assignedAt: isoNow(41),
      assignmentSource: 'NOMINATION_APPROVAL',
      assignmentSourceLabel: 'Homologado por sucessão',
      assignedByUser: {
        id: scenario.ti.id,
        name: scenario.ti.name,
        email: scenario.ti.email,
      },
    };
    scenario.state.history.unshift({
      id: nextHistoryId(scenario.namespace, scenario.state.history.length),
      action: 'cpca_president_nomination_approved',
      actionLabel: 'Solicitação de sucessão homologada',
      summary: 'Novo presidente homologado para a comissão.',
      createdAt: isoNow(41),
      actor: {
        id: scenario.ti.id,
        name: scenario.ti.name,
        email: scenario.ti.email,
      },
    });
    scenario.state.pendingPresidentNominationRequest = null;
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname ===
      `/cpca-commission/approval-requests/COVERAGE/${scenario.state.pendingCoverageRequest?.id ?? 'missing'}/approve`
  ) {
    if (!scenario.state.pendingCoverageRequest) {
      return json(route, 404, { message: 'Solicitação não encontrada.' });
    }
    scenario.state.pendingCoverageRequest.status = 'APPROVED';
    scenario.state.managedLocalities = [
      ...scenario.state.pendingCoverageRequest.requestedManagedLocalities,
    ];
    scenario.state.history.unshift(
      {
        id: nextHistoryId(scenario.namespace, scenario.state.history.length),
        action: 'cpca_coverage_approved',
        actionLabel: 'Solicitação de cobertura homologada',
        summary: 'TI homologou a nova cobertura proposta para esta comissão.',
        createdAt: isoNow(21),
        actor: {
          id: scenario.ti.id,
          name: scenario.ti.name,
          email: scenario.ti.email,
        },
      },
      {
        id: nextHistoryId(scenario.namespace, scenario.state.history.length + 1),
        action: 'cpca_coverage_updated',
        actionLabel: 'Cobertura atualizada para 1 OM(s).',
        summary: `A comissão passou a cobrir ${scenario.managedOm.code}.`,
        createdAt: isoNow(22),
        actor: {
          id: scenario.ti.id,
          name: scenario.ti.name,
          email: scenario.ti.email,
        },
      },
    );
    scenario.state.pendingCoverageRequest = null;
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname ===
      `/cpca-commission/approval-requests/COVERAGE/${scenario.state.pendingCoverageRequest?.id ?? 'missing'}/reject`
  ) {
    if (!scenario.state.pendingCoverageRequest) {
      return json(route, 404, { message: 'Solicitação não encontrada.' });
    }
    scenario.state.pendingCoverageRequest.status = 'REJECTED';
    scenario.state.history.unshift({
      id: nextHistoryId(scenario.namespace, scenario.state.history.length),
      action: 'cpca_coverage_rejected',
      actionLabel: 'Solicitação de cobertura rejeitada',
      summary: 'TI rejeitou a nova cobertura proposta para esta comissão.',
      createdAt: isoNow(51),
      actor: {
        id: scenario.ti.id,
        name: scenario.ti.name,
        email: scenario.ti.email,
      },
    });
    scenario.state.pendingCoverageRequest = null;
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname ===
      `/cpca-commission/approval-requests/PRESIDENT_NOMINATION/${scenario.state.pendingPresidentNominationRequest?.id ?? 'missing'}/reject`
  ) {
    if (!scenario.state.pendingPresidentNominationRequest) {
      return json(route, 404, { message: 'Solicitação não encontrada.' });
    }
    scenario.state.pendingPresidentNominationRequest.status = 'REJECTED';
    scenario.state.history.unshift({
      id: nextHistoryId(scenario.namespace, scenario.state.history.length),
      action: 'cpca_president_nomination_rejected',
      actionLabel: 'Solicitação de sucessão rejeitada',
      summary: 'A indicação de novo presidente foi rejeitada.',
      createdAt: isoNow(52),
      actor: {
        id: scenario.ti.id,
        name: scenario.ti.name,
        email: scenario.ti.email,
      },
    });
    scenario.state.pendingPresidentNominationRequest = null;
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname ===
      `/cpca-commission/approval-requests/SELF_REGISTRATION/${scenario.state.selfRegistrationRequest.id}/reject`
  ) {
    scenario.state.selfRegistrationRequest.status = 'REJECTED';
    return json(route, 200, { ok: true });
  }

  if (
    request.method() === 'POST' &&
    pathname.startsWith('/cpca-commission/approval-requests/')
  ) {
    return json(route, 200, { ok: true });
  }

  if (request.method() === 'GET' && pathname === '/cpca-commission/overview') {
    return json(
      route,
      200,
      buildCommissionOverview(scenario, actor, url.searchParams.get('localityId')),
    );
  }

  if (request.method() === 'PUT' && pathname === '/cpca-commission/coverage') {
    const body = request.postDataJSON() as {
      localityId: string;
      managedLocalityIds: string[];
    };
    const requestedLocalities = body.managedLocalityIds
      .map((id) =>
        [scenario.managerOm, scenario.managedOm, scenario.outsiderOm].find(
          (item) => item.id === id,
        ),
      )
      .filter(Boolean) as MockOm[];

    scenario.state.pendingCoverageRequest = {
      id: `${scenario.namespace}-coverage-request`,
      status: 'PENDING',
      createdAt: isoNow(20),
      requestedByUser: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
      },
      requestedManagedLocalities: requestedLocalities,
    };
    scenario.state.history.unshift({
      id: nextHistoryId(scenario.namespace, scenario.state.history.length),
      action: 'cpca_coverage_requested',
      actionLabel: 'Solicitação de cobertura criada',
      summary: `Cobertura proposta para ${requestedLocalities.length} OM(s) adicional(is).`,
      createdAt: isoNow(20),
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
      },
    });
    return json(route, 200, { mode: 'REQUESTED' });
  }

  if (
    request.method() === 'GET' &&
    pathname === '/cpca-cases/locality-options'
  ) {
    return json(route, 200, {
      items: [scenario.managerOm, ...scenario.state.managedLocalities].map(
        (item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          uf: item.uf ?? null,
        }),
      ),
    });
  }

  if (request.method() === 'GET' && pathname === '/cpca-cases') {
    return json(route, 200, buildCasesResponse(scenario, actor, url.searchParams));
  }

  if (
    request.method() === 'GET' &&
    pathname.startsWith('/cpca-cases/')
  ) {
    const id = pathname.split('/').at(-1) ?? '';
    const found = scenario.state.cases.find((item) => item.id === id);
    if (!found) {
      return json(route, 404, { message: 'Caso não encontrado.' });
    }
    return json(route, 200, {
      ...found,
      localityId: found.omId,
      occurrenceForms: [],
      comments: [],
    });
  }

  return json(route, 200, {});
}

export async function authenticatePage(page: Page, actor: CpcaE2eActor) {
  await page.goto('/login');
  await page.evaluate(({ accessToken, roleId }) => {
    localStorage.clear();
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('activeRoleId', roleId);
  }, actor);
}

export async function installCpcaApiMocks(
  page: Page,
  scenario: CpcaE2eScenario,
): Promise<CpcaMockSession> {
  const users = createMockUsers(scenario.namespace, scenario.managerOm.id);
  let currentActor = users.ti;

  if (process.env.CPCA_E2E_DEBUG === '1') {
    page.on('pageerror', (error) => {
      console.error('[cpca-e2e:pageerror]', error);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.error('[cpca-e2e:console]', message.text());
      }
    });
  }

  await page.route('**/api/**', async (route) => {
    const debugUrl = new URL(route.request().url());
    if (!debugUrl.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (process.env.CPCA_E2E_DEBUG === '1') {
      console.log(
        '[cpca-e2e:api]',
        route.request().method(),
        debugUrl.pathname,
        debugUrl.search,
      );
    }
    await handleApiRequest(route, scenario, () => currentActor);
  });

  return {
    loginAs: async (actor) => {
      if (actor.key === 'ti') currentActor = users.ti;
      if (actor.key === 'approvedPresident') currentActor = users.president;
      if (actor.key === 'member') currentActor = users.member;
      await authenticatePage(page, actor);
    },
  };
}

export async function cleanupCpcaE2eNamespace(_namespace: string) {}

export async function seedCpcaE2eScenario(
  namespace: string,
): Promise<CpcaE2eScenario> {
  const managerOm: MockOm = {
    id: `${namespace}-om-manager`,
    code: `${namespace}-MGR`,
    name: `OM Gerente ${namespace}`,
    uf: 'DF',
    hasCpca: true,
  };
  const managedOm: MockOm = {
    id: `${namespace}-om-managed`,
    code: `${namespace}-GDA`,
    name: `OM Gerida ${namespace}`,
    uf: 'GO',
    hasCpca: false,
  };
  const outsiderOm: MockOm = {
    id: `${namespace}-om-outsider`,
    code: `${namespace}-OUT`,
    name: `OM Externa ${namespace}`,
    uf: 'RJ',
    hasCpca: false,
  };

  const users = createMockUsers(namespace, managerOm.id);
  const caseOwnNumber = `${namespace}-CASO-OM`;
  const caseManagedNumber = `${namespace}-CASO-GERIDA`;
  const caseOutsiderNumber = `${namespace}-CASO-EXTERNA`;

  const scenario: CpcaE2eScenario = {
    namespace,
    ti: buildActor('ti', users.ti),
    roleCpcaId: users.member.roleId,
    managerOm,
    managedOm,
    outsiderOm,
    approvedPresident: buildActor('approvedPresident', users.president),
    member: buildActor('member', users.member),
    selfRegistrationApplicantName: users.president.name,
    caseOwnNumber,
    caseManagedNumber,
    caseOutsiderNumber,
    state: {
      currentPresident: {
        user: {
          id: users.currentPresident.id,
          name: users.currentPresident.name,
          email: users.currentPresident.email,
        },
        designationBulletin: `${namespace}/DIR`,
        isSubstitution: false,
        assignedAt: isoNow(1),
        assignmentSource: 'DIRECT_ASSIGNMENT',
        assignmentSourceLabel: 'Cadastro direto por TI',
        assignedByUser: {
          id: users.ti.id,
          name: users.ti.name,
          email: users.ti.email,
        },
      },
      selfRegistrationRequest: {
        id: `${namespace}-self-registration`,
        type: 'SELF_REGISTRATION',
        status: 'PENDING',
        createdAt: isoNow(5),
        locality: managerOm,
        applicant: {
          id: users.president.id,
          name: users.president.name,
          email: users.president.email,
        },
        requestedAsSubstitution: true,
        bulletinNumber: `${namespace}/AUTO`,
      },
      pendingPresidentNominationRequest: null,
      pendingCoverageRequest: null,
      managedLocalities: [],
      members: [
        {
          id: `${namespace}-member-record`,
          createdAt: isoNow(2),
          user: {
            id: users.member.id,
            name: users.member.name,
            email: users.member.email,
            ldapUid: `${namespace.toLowerCase()}-member`,
          },
          addedByUser: {
            id: users.currentPresident.id,
            name: users.currentPresident.name,
            email: users.currentPresident.email,
          },
        },
      ],
      history: [
        {
          id: nextHistoryId(namespace, 0),
          action: 'cpca_member_added',
          actionLabel: 'Membro adicionado',
          summary: 'Membro incluído na comissão da OM.',
          createdAt: isoNow(2),
          actor: {
            id: users.currentPresident.id,
            name: users.currentPresident.name,
            email: users.currentPresident.email,
          },
        },
      ],
      cases: [
        {
          id: `${namespace}-case-own`,
          caseNumber: caseOwnNumber,
          omId: managerOm.id,
          locality: {
            id: managerOm.id,
            code: managerOm.code,
            name: managerOm.name,
          },
          complaintType: 'MORAL',
          detailedViolenceType: 'ASSEDIO_MORAL',
          status: 'RECEIVED',
          procedureType: 'NOT_DEFINED',
          reportedAt: isoNow(11),
        },
        {
          id: `${namespace}-case-managed`,
          caseNumber: caseManagedNumber,
          omId: managedOm.id,
          locality: {
            id: managedOm.id,
            code: managedOm.code,
            name: managedOm.name,
          },
          complaintType: 'MORAL',
          detailedViolenceType: 'ASSEDIO_MORAL',
          status: 'RECEIVED',
          procedureType: 'NOT_DEFINED',
          reportedAt: isoNow(12),
        },
        {
          id: `${namespace}-case-outsider`,
          caseNumber: caseOutsiderNumber,
          omId: outsiderOm.id,
          locality: {
            id: outsiderOm.id,
            code: outsiderOm.code,
            name: outsiderOm.name,
          },
          complaintType: 'MORAL',
          detailedViolenceType: 'ASSEDIO_MORAL',
          status: 'RECEIVED',
          procedureType: 'NOT_DEFINED',
          reportedAt: isoNow(13),
        },
      ],
    },
  };

  return scenario;
}

export async function disposeCpcaTestUtils() {}
