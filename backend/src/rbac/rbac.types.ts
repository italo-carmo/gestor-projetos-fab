import { PermissionScope } from '@prisma/client';

export type RbacRole = {
  id: string;
  name: string;
  wildcard: boolean;
  permissions: { resource: string; action: string; scope: PermissionScope }[];
  constraintsTemplateJson?: Record<string, unknown> | null;
  flagsJson?: Record<string, unknown> | null;
};

export type PermissionRequirement = {
  resource: string;
  action: string;
  scope?: PermissionScope | string;
};

export type RbacUser = {
  id: string;
  name: string;
  email: string;
  localityId?: string | null;
  specialtyId?: string | null;
  eloRoleId?: string | null;
  executiveHidePii: boolean;
  permissions: { resource: string; action: string; scope: PermissionScope }[];
  moduleAccessOverrides: { resource: string; enabled: boolean }[];
  roles: RbacRole[];
  allRoles?: RbacRole[];
  activeRoleId?: string | null;
};
