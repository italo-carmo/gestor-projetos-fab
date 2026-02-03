import { PermissionScope } from '@prisma/client';

export type PermissionRequirement = {
  resource: string;
  action: string;
  scope?: PermissionScope | string;
};

export type RbacUser = {
  id: string;
  email: string;
  localityId?: string | null;
  specialtyId?: string | null;
  executiveHidePii: boolean;
  roles: {
    id: string;
    name: string;
    wildcard: boolean;
    permissions: { resource: string; action: string; scope: PermissionScope }[];
    constraintsTemplateJson?: Record<string, unknown> | null;
    flagsJson?: Record<string, unknown> | null;
  }[];
};
