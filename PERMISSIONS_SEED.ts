/**
 * PERMISSIONS_SEED.ts
 * Seed de permissões + roles iniciais sugeridas.
 *
 * Uso (exemplo):
 *  - importe em prisma/seed.ts e chame `seedRbac(prisma)`
 *
 * Observação:
 *  - Role TI pode ser tratada como "superuser" via shortcut no guard (resource/action wildcard),
 *    sem precisar persistir todas as permissões.
 */
import type { PrismaClient } from "@prisma/client";

type SeedPermission = {
  resource: string;
  action: string;
  scope: "NATIONAL" | "LOCALITY" | "SPECIALTY" | "LOCALITY_SPECIALTY" | "OWN";
  description?: string;
};

type SeedRolePermission = SeedPermission & { constraintsJson?: any };

export const PERMISSIONS: SeedPermission[] = [
  {
    "resource": "users",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on users (NATIONAL)"
  },
  {
    "resource": "users",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on users (LOCALITY)"
  },
  {
    "resource": "users",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on users (SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on users (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "view",
    "scope": "OWN",
    "description": "view on users (OWN)"
  },
  {
    "resource": "users",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on users (NATIONAL)"
  },
  {
    "resource": "users",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on users (LOCALITY)"
  },
  {
    "resource": "users",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on users (SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on users (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "create",
    "scope": "OWN",
    "description": "create on users (OWN)"
  },
  {
    "resource": "users",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on users (NATIONAL)"
  },
  {
    "resource": "users",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on users (LOCALITY)"
  },
  {
    "resource": "users",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on users (SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on users (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "update",
    "scope": "OWN",
    "description": "update on users (OWN)"
  },
  {
    "resource": "users",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on users (NATIONAL)"
  },
  {
    "resource": "users",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on users (LOCALITY)"
  },
  {
    "resource": "users",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on users (SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on users (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on users (OWN)"
  },
  {
    "resource": "users",
    "action": "export",
    "scope": "NATIONAL",
    "description": "export on users (NATIONAL)"
  },
  {
    "resource": "users",
    "action": "export",
    "scope": "LOCALITY",
    "description": "export on users (LOCALITY)"
  },
  {
    "resource": "users",
    "action": "export",
    "scope": "SPECIALTY",
    "description": "export on users (SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "export",
    "scope": "LOCALITY_SPECIALTY",
    "description": "export on users (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "users",
    "action": "export",
    "scope": "OWN",
    "description": "export on users (OWN)"
  },
  {
    "resource": "roles",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on roles (NATIONAL)"
  },
  {
    "resource": "roles",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on roles (LOCALITY)"
  },
  {
    "resource": "roles",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on roles (SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on roles (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "view",
    "scope": "OWN",
    "description": "view on roles (OWN)"
  },
  {
    "resource": "roles",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on roles (NATIONAL)"
  },
  {
    "resource": "roles",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on roles (LOCALITY)"
  },
  {
    "resource": "roles",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on roles (SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on roles (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "create",
    "scope": "OWN",
    "description": "create on roles (OWN)"
  },
  {
    "resource": "roles",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on roles (NATIONAL)"
  },
  {
    "resource": "roles",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on roles (LOCALITY)"
  },
  {
    "resource": "roles",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on roles (SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on roles (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "update",
    "scope": "OWN",
    "description": "update on roles (OWN)"
  },
  {
    "resource": "roles",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on roles (NATIONAL)"
  },
  {
    "resource": "roles",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on roles (LOCALITY)"
  },
  {
    "resource": "roles",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on roles (SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on roles (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "roles",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on roles (OWN)"
  },
  {
    "resource": "permissions",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on permissions (NATIONAL)"
  },
  {
    "resource": "permissions",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on permissions (LOCALITY)"
  },
  {
    "resource": "permissions",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on permissions (SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on permissions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "view",
    "scope": "OWN",
    "description": "view on permissions (OWN)"
  },
  {
    "resource": "permissions",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on permissions (NATIONAL)"
  },
  {
    "resource": "permissions",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on permissions (LOCALITY)"
  },
  {
    "resource": "permissions",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on permissions (SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on permissions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "create",
    "scope": "OWN",
    "description": "create on permissions (OWN)"
  },
  {
    "resource": "permissions",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on permissions (NATIONAL)"
  },
  {
    "resource": "permissions",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on permissions (LOCALITY)"
  },
  {
    "resource": "permissions",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on permissions (SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on permissions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "update",
    "scope": "OWN",
    "description": "update on permissions (OWN)"
  },
  {
    "resource": "permissions",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on permissions (NATIONAL)"
  },
  {
    "resource": "permissions",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on permissions (LOCALITY)"
  },
  {
    "resource": "permissions",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on permissions (SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on permissions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "permissions",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on permissions (OWN)"
  },
  {
    "resource": "specialties",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on specialties (NATIONAL)"
  },
  {
    "resource": "specialties",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on specialties (LOCALITY)"
  },
  {
    "resource": "specialties",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on specialties (SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on specialties (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "view",
    "scope": "OWN",
    "description": "view on specialties (OWN)"
  },
  {
    "resource": "specialties",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on specialties (NATIONAL)"
  },
  {
    "resource": "specialties",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on specialties (LOCALITY)"
  },
  {
    "resource": "specialties",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on specialties (SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on specialties (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "create",
    "scope": "OWN",
    "description": "create on specialties (OWN)"
  },
  {
    "resource": "specialties",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on specialties (NATIONAL)"
  },
  {
    "resource": "specialties",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on specialties (LOCALITY)"
  },
  {
    "resource": "specialties",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on specialties (SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on specialties (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "update",
    "scope": "OWN",
    "description": "update on specialties (OWN)"
  },
  {
    "resource": "specialties",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on specialties (NATIONAL)"
  },
  {
    "resource": "specialties",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on specialties (LOCALITY)"
  },
  {
    "resource": "specialties",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on specialties (SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on specialties (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "specialties",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on specialties (OWN)"
  },
  {
    "resource": "localities",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on localities (NATIONAL)"
  },
  {
    "resource": "localities",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on localities (LOCALITY)"
  },
  {
    "resource": "localities",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on localities (SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on localities (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "view",
    "scope": "OWN",
    "description": "view on localities (OWN)"
  },
  {
    "resource": "localities",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on localities (NATIONAL)"
  },
  {
    "resource": "localities",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on localities (LOCALITY)"
  },
  {
    "resource": "localities",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on localities (SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on localities (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "create",
    "scope": "OWN",
    "description": "create on localities (OWN)"
  },
  {
    "resource": "localities",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on localities (NATIONAL)"
  },
  {
    "resource": "localities",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on localities (LOCALITY)"
  },
  {
    "resource": "localities",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on localities (SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on localities (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "update",
    "scope": "OWN",
    "description": "update on localities (OWN)"
  },
  {
    "resource": "localities",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on localities (NATIONAL)"
  },
  {
    "resource": "localities",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on localities (LOCALITY)"
  },
  {
    "resource": "localities",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on localities (SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on localities (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on localities (OWN)"
  },
  {
    "resource": "localities",
    "action": "export",
    "scope": "NATIONAL",
    "description": "export on localities (NATIONAL)"
  },
  {
    "resource": "localities",
    "action": "export",
    "scope": "LOCALITY",
    "description": "export on localities (LOCALITY)"
  },
  {
    "resource": "localities",
    "action": "export",
    "scope": "SPECIALTY",
    "description": "export on localities (SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "export",
    "scope": "LOCALITY_SPECIALTY",
    "description": "export on localities (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "localities",
    "action": "export",
    "scope": "OWN",
    "description": "export on localities (OWN)"
  },
  {
    "resource": "meetings",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on meetings (NATIONAL)"
  },
  {
    "resource": "meetings",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on meetings (LOCALITY)"
  },
  {
    "resource": "meetings",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on meetings (SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on meetings (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "view",
    "scope": "OWN",
    "description": "view on meetings (OWN)"
  },
  {
    "resource": "meetings",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on meetings (NATIONAL)"
  },
  {
    "resource": "meetings",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on meetings (LOCALITY)"
  },
  {
    "resource": "meetings",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on meetings (SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on meetings (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "create",
    "scope": "OWN",
    "description": "create on meetings (OWN)"
  },
  {
    "resource": "meetings",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on meetings (NATIONAL)"
  },
  {
    "resource": "meetings",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on meetings (LOCALITY)"
  },
  {
    "resource": "meetings",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on meetings (SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on meetings (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "update",
    "scope": "OWN",
    "description": "update on meetings (OWN)"
  },
  {
    "resource": "meetings",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on meetings (NATIONAL)"
  },
  {
    "resource": "meetings",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on meetings (LOCALITY)"
  },
  {
    "resource": "meetings",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on meetings (SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on meetings (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on meetings (OWN)"
  },
  {
    "resource": "meetings",
    "action": "export",
    "scope": "NATIONAL",
    "description": "export on meetings (NATIONAL)"
  },
  {
    "resource": "meetings",
    "action": "export",
    "scope": "LOCALITY",
    "description": "export on meetings (LOCALITY)"
  },
  {
    "resource": "meetings",
    "action": "export",
    "scope": "SPECIALTY",
    "description": "export on meetings (SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "export",
    "scope": "LOCALITY_SPECIALTY",
    "description": "export on meetings (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "meetings",
    "action": "export",
    "scope": "OWN",
    "description": "export on meetings (OWN)"
  },
  {
    "resource": "decisions",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on decisions (NATIONAL)"
  },
  {
    "resource": "decisions",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on decisions (LOCALITY)"
  },
  {
    "resource": "decisions",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on decisions (SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on decisions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "view",
    "scope": "OWN",
    "description": "view on decisions (OWN)"
  },
  {
    "resource": "decisions",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on decisions (NATIONAL)"
  },
  {
    "resource": "decisions",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on decisions (LOCALITY)"
  },
  {
    "resource": "decisions",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on decisions (SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on decisions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "create",
    "scope": "OWN",
    "description": "create on decisions (OWN)"
  },
  {
    "resource": "decisions",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on decisions (NATIONAL)"
  },
  {
    "resource": "decisions",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on decisions (LOCALITY)"
  },
  {
    "resource": "decisions",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on decisions (SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on decisions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "update",
    "scope": "OWN",
    "description": "update on decisions (OWN)"
  },
  {
    "resource": "decisions",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on decisions (NATIONAL)"
  },
  {
    "resource": "decisions",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on decisions (LOCALITY)"
  },
  {
    "resource": "decisions",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on decisions (SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on decisions (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "decisions",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on decisions (OWN)"
  },
  {
    "resource": "task_templates",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on task_templates (NATIONAL)"
  },
  {
    "resource": "task_templates",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on task_templates (LOCALITY)"
  },
  {
    "resource": "task_templates",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on task_templates (SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on task_templates (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "view",
    "scope": "OWN",
    "description": "view on task_templates (OWN)"
  },
  {
    "resource": "task_templates",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on task_templates (NATIONAL)"
  },
  {
    "resource": "task_templates",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on task_templates (LOCALITY)"
  },
  {
    "resource": "task_templates",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on task_templates (SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on task_templates (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "create",
    "scope": "OWN",
    "description": "create on task_templates (OWN)"
  },
  {
    "resource": "task_templates",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on task_templates (NATIONAL)"
  },
  {
    "resource": "task_templates",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on task_templates (LOCALITY)"
  },
  {
    "resource": "task_templates",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on task_templates (SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on task_templates (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "update",
    "scope": "OWN",
    "description": "update on task_templates (OWN)"
  },
  {
    "resource": "task_templates",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on task_templates (NATIONAL)"
  },
  {
    "resource": "task_templates",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on task_templates (LOCALITY)"
  },
  {
    "resource": "task_templates",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on task_templates (SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on task_templates (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_templates",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on task_templates (OWN)"
  },
  {
    "resource": "task_instances",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on task_instances (NATIONAL)"
  },
  {
    "resource": "task_instances",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on task_instances (LOCALITY)"
  },
  {
    "resource": "task_instances",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on task_instances (SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on task_instances (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "view",
    "scope": "OWN",
    "description": "view on task_instances (OWN)"
  },
  {
    "resource": "task_instances",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on task_instances (NATIONAL)"
  },
  {
    "resource": "task_instances",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on task_instances (LOCALITY)"
  },
  {
    "resource": "task_instances",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on task_instances (SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on task_instances (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "create",
    "scope": "OWN",
    "description": "create on task_instances (OWN)"
  },
  {
    "resource": "task_instances",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on task_instances (NATIONAL)"
  },
  {
    "resource": "task_instances",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on task_instances (LOCALITY)"
  },
  {
    "resource": "task_instances",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on task_instances (SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on task_instances (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "update",
    "scope": "OWN",
    "description": "update on task_instances (OWN)"
  },
  {
    "resource": "task_instances",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on task_instances (NATIONAL)"
  },
  {
    "resource": "task_instances",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on task_instances (LOCALITY)"
  },
  {
    "resource": "task_instances",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on task_instances (SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on task_instances (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on task_instances (OWN)"
  },
  {
    "resource": "task_instances",
    "action": "assign",
    "scope": "NATIONAL",
    "description": "assign on task_instances (NATIONAL)"
  },
  {
    "resource": "task_instances",
    "action": "assign",
    "scope": "LOCALITY",
    "description": "assign on task_instances (LOCALITY)"
  },
  {
    "resource": "task_instances",
    "action": "assign",
    "scope": "SPECIALTY",
    "description": "assign on task_instances (SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "assign",
    "scope": "LOCALITY_SPECIALTY",
    "description": "assign on task_instances (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "assign",
    "scope": "OWN",
    "description": "assign on task_instances (OWN)"
  },
  {
    "resource": "task_instances",
    "action": "export",
    "scope": "NATIONAL",
    "description": "export on task_instances (NATIONAL)"
  },
  {
    "resource": "task_instances",
    "action": "export",
    "scope": "LOCALITY",
    "description": "export on task_instances (LOCALITY)"
  },
  {
    "resource": "task_instances",
    "action": "export",
    "scope": "SPECIALTY",
    "description": "export on task_instances (SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "export",
    "scope": "LOCALITY_SPECIALTY",
    "description": "export on task_instances (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "task_instances",
    "action": "export",
    "scope": "OWN",
    "description": "export on task_instances (OWN)"
  },
  {
    "resource": "reports",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "view",
    "scope": "OWN",
    "description": "view on reports (OWN)"
  },
  {
    "resource": "reports",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "create",
    "scope": "OWN",
    "description": "create on reports (OWN)"
  },
  {
    "resource": "reports",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "update",
    "scope": "OWN",
    "description": "update on reports (OWN)"
  },
  {
    "resource": "reports",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on reports (OWN)"
  },
  {
    "resource": "reports",
    "action": "approve",
    "scope": "NATIONAL",
    "description": "approve on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "approve",
    "scope": "LOCALITY",
    "description": "approve on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "approve",
    "scope": "SPECIALTY",
    "description": "approve on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "approve",
    "scope": "LOCALITY_SPECIALTY",
    "description": "approve on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "approve",
    "scope": "OWN",
    "description": "approve on reports (OWN)"
  },
  {
    "resource": "reports",
    "action": "upload",
    "scope": "NATIONAL",
    "description": "upload on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "upload",
    "scope": "LOCALITY",
    "description": "upload on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "upload",
    "scope": "SPECIALTY",
    "description": "upload on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "upload",
    "scope": "LOCALITY_SPECIALTY",
    "description": "upload on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "upload",
    "scope": "OWN",
    "description": "upload on reports (OWN)"
  },
  {
    "resource": "reports",
    "action": "download",
    "scope": "NATIONAL",
    "description": "download on reports (NATIONAL)"
  },
  {
    "resource": "reports",
    "action": "download",
    "scope": "LOCALITY",
    "description": "download on reports (LOCALITY)"
  },
  {
    "resource": "reports",
    "action": "download",
    "scope": "SPECIALTY",
    "description": "download on reports (SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "download",
    "scope": "LOCALITY_SPECIALTY",
    "description": "download on reports (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "reports",
    "action": "download",
    "scope": "OWN",
    "description": "download on reports (OWN)"
  },
  {
    "resource": "checklists",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on checklists (NATIONAL)"
  },
  {
    "resource": "checklists",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on checklists (LOCALITY)"
  },
  {
    "resource": "checklists",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on checklists (SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on checklists (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "view",
    "scope": "OWN",
    "description": "view on checklists (OWN)"
  },
  {
    "resource": "checklists",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on checklists (NATIONAL)"
  },
  {
    "resource": "checklists",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on checklists (LOCALITY)"
  },
  {
    "resource": "checklists",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on checklists (SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on checklists (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "create",
    "scope": "OWN",
    "description": "create on checklists (OWN)"
  },
  {
    "resource": "checklists",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on checklists (NATIONAL)"
  },
  {
    "resource": "checklists",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on checklists (LOCALITY)"
  },
  {
    "resource": "checklists",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on checklists (SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on checklists (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "update",
    "scope": "OWN",
    "description": "update on checklists (OWN)"
  },
  {
    "resource": "checklists",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on checklists (NATIONAL)"
  },
  {
    "resource": "checklists",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on checklists (LOCALITY)"
  },
  {
    "resource": "checklists",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on checklists (SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on checklists (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklists",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on checklists (OWN)"
  },
  {
    "resource": "checklist_items",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on checklist_items (NATIONAL)"
  },
  {
    "resource": "checklist_items",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on checklist_items (LOCALITY)"
  },
  {
    "resource": "checklist_items",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on checklist_items (SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on checklist_items (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "view",
    "scope": "OWN",
    "description": "view on checklist_items (OWN)"
  },
  {
    "resource": "checklist_items",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on checklist_items (NATIONAL)"
  },
  {
    "resource": "checklist_items",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on checklist_items (LOCALITY)"
  },
  {
    "resource": "checklist_items",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on checklist_items (SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on checklist_items (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "create",
    "scope": "OWN",
    "description": "create on checklist_items (OWN)"
  },
  {
    "resource": "checklist_items",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on checklist_items (NATIONAL)"
  },
  {
    "resource": "checklist_items",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on checklist_items (LOCALITY)"
  },
  {
    "resource": "checklist_items",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on checklist_items (SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on checklist_items (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "update",
    "scope": "OWN",
    "description": "update on checklist_items (OWN)"
  },
  {
    "resource": "checklist_items",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on checklist_items (NATIONAL)"
  },
  {
    "resource": "checklist_items",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on checklist_items (LOCALITY)"
  },
  {
    "resource": "checklist_items",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on checklist_items (SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on checklist_items (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_items",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on checklist_items (OWN)"
  },
  {
    "resource": "checklist_status",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on checklist_status (NATIONAL)"
  },
  {
    "resource": "checklist_status",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on checklist_status (LOCALITY)"
  },
  {
    "resource": "checklist_status",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on checklist_status (SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on checklist_status (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "view",
    "scope": "OWN",
    "description": "view on checklist_status (OWN)"
  },
  {
    "resource": "checklist_status",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on checklist_status (NATIONAL)"
  },
  {
    "resource": "checklist_status",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on checklist_status (LOCALITY)"
  },
  {
    "resource": "checklist_status",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on checklist_status (SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on checklist_status (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "create",
    "scope": "OWN",
    "description": "create on checklist_status (OWN)"
  },
  {
    "resource": "checklist_status",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on checklist_status (NATIONAL)"
  },
  {
    "resource": "checklist_status",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on checklist_status (LOCALITY)"
  },
  {
    "resource": "checklist_status",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on checklist_status (SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on checklist_status (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "update",
    "scope": "OWN",
    "description": "update on checklist_status (OWN)"
  },
  {
    "resource": "checklist_status",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on checklist_status (NATIONAL)"
  },
  {
    "resource": "checklist_status",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on checklist_status (LOCALITY)"
  },
  {
    "resource": "checklist_status",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on checklist_status (SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on checklist_status (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "checklist_status",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on checklist_status (OWN)"
  },
  {
    "resource": "notices",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on notices (NATIONAL)"
  },
  {
    "resource": "notices",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on notices (LOCALITY)"
  },
  {
    "resource": "notices",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on notices (SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on notices (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "view",
    "scope": "OWN",
    "description": "view on notices (OWN)"
  },
  {
    "resource": "notices",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on notices (NATIONAL)"
  },
  {
    "resource": "notices",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on notices (LOCALITY)"
  },
  {
    "resource": "notices",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on notices (SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on notices (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "create",
    "scope": "OWN",
    "description": "create on notices (OWN)"
  },
  {
    "resource": "notices",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on notices (NATIONAL)"
  },
  {
    "resource": "notices",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on notices (LOCALITY)"
  },
  {
    "resource": "notices",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on notices (SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on notices (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "update",
    "scope": "OWN",
    "description": "update on notices (OWN)"
  },
  {
    "resource": "notices",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on notices (NATIONAL)"
  },
  {
    "resource": "notices",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on notices (LOCALITY)"
  },
  {
    "resource": "notices",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on notices (SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on notices (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "notices",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on notices (OWN)"
  },
  {
    "resource": "kpis",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on kpis (NATIONAL)"
  },
  {
    "resource": "kpis",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on kpis (LOCALITY)"
  },
  {
    "resource": "kpis",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on kpis (SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on kpis (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "view",
    "scope": "OWN",
    "description": "view on kpis (OWN)"
  },
  {
    "resource": "kpis",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on kpis (NATIONAL)"
  },
  {
    "resource": "kpis",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on kpis (LOCALITY)"
  },
  {
    "resource": "kpis",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on kpis (SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on kpis (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "create",
    "scope": "OWN",
    "description": "create on kpis (OWN)"
  },
  {
    "resource": "kpis",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on kpis (NATIONAL)"
  },
  {
    "resource": "kpis",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on kpis (LOCALITY)"
  },
  {
    "resource": "kpis",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on kpis (SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on kpis (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "update",
    "scope": "OWN",
    "description": "update on kpis (OWN)"
  },
  {
    "resource": "kpis",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on kpis (NATIONAL)"
  },
  {
    "resource": "kpis",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on kpis (LOCALITY)"
  },
  {
    "resource": "kpis",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on kpis (SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on kpis (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on kpis (OWN)"
  },
  {
    "resource": "kpis",
    "action": "approve",
    "scope": "NATIONAL",
    "description": "approve on kpis (NATIONAL)"
  },
  {
    "resource": "kpis",
    "action": "approve",
    "scope": "LOCALITY",
    "description": "approve on kpis (LOCALITY)"
  },
  {
    "resource": "kpis",
    "action": "approve",
    "scope": "SPECIALTY",
    "description": "approve on kpis (SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "approve",
    "scope": "LOCALITY_SPECIALTY",
    "description": "approve on kpis (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "approve",
    "scope": "OWN",
    "description": "approve on kpis (OWN)"
  },
  {
    "resource": "kpis",
    "action": "export",
    "scope": "NATIONAL",
    "description": "export on kpis (NATIONAL)"
  },
  {
    "resource": "kpis",
    "action": "export",
    "scope": "LOCALITY",
    "description": "export on kpis (LOCALITY)"
  },
  {
    "resource": "kpis",
    "action": "export",
    "scope": "SPECIALTY",
    "description": "export on kpis (SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "export",
    "scope": "LOCALITY_SPECIALTY",
    "description": "export on kpis (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpis",
    "action": "export",
    "scope": "OWN",
    "description": "export on kpis (OWN)"
  },
  {
    "resource": "kpi_values",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on kpi_values (NATIONAL)"
  },
  {
    "resource": "kpi_values",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on kpi_values (LOCALITY)"
  },
  {
    "resource": "kpi_values",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on kpi_values (SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on kpi_values (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "view",
    "scope": "OWN",
    "description": "view on kpi_values (OWN)"
  },
  {
    "resource": "kpi_values",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on kpi_values (NATIONAL)"
  },
  {
    "resource": "kpi_values",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on kpi_values (LOCALITY)"
  },
  {
    "resource": "kpi_values",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on kpi_values (SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on kpi_values (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "create",
    "scope": "OWN",
    "description": "create on kpi_values (OWN)"
  },
  {
    "resource": "kpi_values",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on kpi_values (NATIONAL)"
  },
  {
    "resource": "kpi_values",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on kpi_values (LOCALITY)"
  },
  {
    "resource": "kpi_values",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on kpi_values (SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on kpi_values (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "update",
    "scope": "OWN",
    "description": "update on kpi_values (OWN)"
  },
  {
    "resource": "kpi_values",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on kpi_values (NATIONAL)"
  },
  {
    "resource": "kpi_values",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on kpi_values (LOCALITY)"
  },
  {
    "resource": "kpi_values",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on kpi_values (SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on kpi_values (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "kpi_values",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on kpi_values (OWN)"
  },
  {
    "resource": "elos",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on elos (NATIONAL)"
  },
  {
    "resource": "elos",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on elos (LOCALITY)"
  },
  {
    "resource": "elos",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on elos (SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on elos (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "view",
    "scope": "OWN",
    "description": "view on elos (OWN)"
  },
  {
    "resource": "elos",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on elos (NATIONAL)"
  },
  {
    "resource": "elos",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on elos (LOCALITY)"
  },
  {
    "resource": "elos",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on elos (SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on elos (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "create",
    "scope": "OWN",
    "description": "create on elos (OWN)"
  },
  {
    "resource": "elos",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on elos (NATIONAL)"
  },
  {
    "resource": "elos",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on elos (LOCALITY)"
  },
  {
    "resource": "elos",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on elos (SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on elos (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "update",
    "scope": "OWN",
    "description": "update on elos (OWN)"
  },
  {
    "resource": "elos",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on elos (NATIONAL)"
  },
  {
    "resource": "elos",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on elos (LOCALITY)"
  },
  {
    "resource": "elos",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on elos (SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on elos (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "elos",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on elos (OWN)"
  },
  {
    "resource": "org_chart",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on org_chart (NATIONAL)"
  },
  {
    "resource": "org_chart",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on org_chart (LOCALITY)"
  },
  {
    "resource": "org_chart",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on org_chart (SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on org_chart (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "view",
    "scope": "OWN",
    "description": "view on org_chart (OWN)"
  },
  {
    "resource": "org_chart",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on org_chart (NATIONAL)"
  },
  {
    "resource": "org_chart",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on org_chart (LOCALITY)"
  },
  {
    "resource": "org_chart",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on org_chart (SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on org_chart (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "create",
    "scope": "OWN",
    "description": "create on org_chart (OWN)"
  },
  {
    "resource": "org_chart",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on org_chart (NATIONAL)"
  },
  {
    "resource": "org_chart",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on org_chart (LOCALITY)"
  },
  {
    "resource": "org_chart",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on org_chart (SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on org_chart (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "update",
    "scope": "OWN",
    "description": "update on org_chart (OWN)"
  },
  {
    "resource": "org_chart",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on org_chart (NATIONAL)"
  },
  {
    "resource": "org_chart",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on org_chart (LOCALITY)"
  },
  {
    "resource": "org_chart",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on org_chart (SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on org_chart (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "org_chart",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on org_chart (OWN)"
  },
  {
    "resource": "audit_logs",
    "action": "view",
    "scope": "NATIONAL",
    "description": "view on audit_logs (NATIONAL)"
  },
  {
    "resource": "audit_logs",
    "action": "view",
    "scope": "LOCALITY",
    "description": "view on audit_logs (LOCALITY)"
  },
  {
    "resource": "audit_logs",
    "action": "view",
    "scope": "SPECIALTY",
    "description": "view on audit_logs (SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "view",
    "scope": "LOCALITY_SPECIALTY",
    "description": "view on audit_logs (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "view",
    "scope": "OWN",
    "description": "view on audit_logs (OWN)"
  },
  {
    "resource": "audit_logs",
    "action": "create",
    "scope": "NATIONAL",
    "description": "create on audit_logs (NATIONAL)"
  },
  {
    "resource": "audit_logs",
    "action": "create",
    "scope": "LOCALITY",
    "description": "create on audit_logs (LOCALITY)"
  },
  {
    "resource": "audit_logs",
    "action": "create",
    "scope": "SPECIALTY",
    "description": "create on audit_logs (SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "create",
    "scope": "LOCALITY_SPECIALTY",
    "description": "create on audit_logs (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "create",
    "scope": "OWN",
    "description": "create on audit_logs (OWN)"
  },
  {
    "resource": "audit_logs",
    "action": "update",
    "scope": "NATIONAL",
    "description": "update on audit_logs (NATIONAL)"
  },
  {
    "resource": "audit_logs",
    "action": "update",
    "scope": "LOCALITY",
    "description": "update on audit_logs (LOCALITY)"
  },
  {
    "resource": "audit_logs",
    "action": "update",
    "scope": "SPECIALTY",
    "description": "update on audit_logs (SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "update",
    "scope": "LOCALITY_SPECIALTY",
    "description": "update on audit_logs (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "update",
    "scope": "OWN",
    "description": "update on audit_logs (OWN)"
  },
  {
    "resource": "audit_logs",
    "action": "delete",
    "scope": "NATIONAL",
    "description": "delete on audit_logs (NATIONAL)"
  },
  {
    "resource": "audit_logs",
    "action": "delete",
    "scope": "LOCALITY",
    "description": "delete on audit_logs (LOCALITY)"
  },
  {
    "resource": "audit_logs",
    "action": "delete",
    "scope": "SPECIALTY",
    "description": "delete on audit_logs (SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "delete",
    "scope": "LOCALITY_SPECIALTY",
    "description": "delete on audit_logs (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "delete",
    "scope": "OWN",
    "description": "delete on audit_logs (OWN)"
  },
  {
    "resource": "audit_logs",
    "action": "export",
    "scope": "NATIONAL",
    "description": "export on audit_logs (NATIONAL)"
  },
  {
    "resource": "audit_logs",
    "action": "export",
    "scope": "LOCALITY",
    "description": "export on audit_logs (LOCALITY)"
  },
  {
    "resource": "audit_logs",
    "action": "export",
    "scope": "SPECIALTY",
    "description": "export on audit_logs (SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "export",
    "scope": "LOCALITY_SPECIALTY",
    "description": "export on audit_logs (LOCALITY_SPECIALTY)"
  },
  {
    "resource": "audit_logs",
    "action": "export",
    "scope": "OWN",
    "description": "export on audit_logs (OWN)"
  }
] as any;

export const ROLE_SUGGESTIONS: Record<string, SeedRolePermission[]> = {
  "TI": [
    {
      "resource": "*",
      "action": "*",
      "scope": "NATIONAL"
    }
  ],
  "Coordenação CIPAVD": [
    {
      "resource": "localities",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "specialties",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "meetings",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "meetings",
      "action": "create",
      "scope": "NATIONAL"
    },
    {
      "resource": "meetings",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_templates",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_templates",
      "action": "create",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_templates",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_instances",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_instances",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_instances",
      "action": "assign",
      "scope": "NATIONAL"
    },
    {
      "resource": "reports",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "reports",
      "action": "download",
      "scope": "NATIONAL"
    },
    {
      "resource": "notices",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "notices",
      "action": "create",
      "scope": "NATIONAL"
    },
    {
      "resource": "notices",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "checklists",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "checklists",
      "action": "create",
      "scope": "NATIONAL"
    },
    {
      "resource": "checklists",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "kpis",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "kpis",
      "action": "create",
      "scope": "NATIONAL"
    },
    {
      "resource": "kpis",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "kpis",
      "action": "export",
      "scope": "NATIONAL"
    },
    {
      "resource": "elos",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "elos",
      "action": "update",
      "scope": "NATIONAL"
    },
    {
      "resource": "org_chart",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "org_chart",
      "action": "update",
      "scope": "NATIONAL"
    }
  ],
  "GSD Localidade": [
    {
      "resource": "task_instances",
      "action": "view",
      "scope": "LOCALITY"
    },
    {
      "resource": "task_instances",
      "action": "update",
      "scope": "LOCALITY"
    },
    {
      "resource": "task_instances",
      "action": "assign",
      "scope": "LOCALITY"
    },
    {
      "resource": "reports",
      "action": "upload",
      "scope": "LOCALITY"
    },
    {
      "resource": "reports",
      "action": "download",
      "scope": "LOCALITY"
    },
    {
      "resource": "reports",
      "action": "view",
      "scope": "LOCALITY"
    },
    {
      "resource": "meetings",
      "action": "view",
      "scope": "LOCALITY"
    },
    {
      "resource": "notices",
      "action": "view",
      "scope": "LOCALITY"
    },
    {
      "resource": "notices",
      "action": "create",
      "scope": "LOCALITY"
    },
    {
      "resource": "notices",
      "action": "update",
      "scope": "LOCALITY"
    },
    {
      "resource": "elos",
      "action": "view",
      "scope": "LOCALITY"
    },
    {
      "resource": "elos",
      "action": "update",
      "scope": "LOCALITY"
    },
    {
      "resource": "checklists",
      "action": "view",
      "scope": "LOCALITY"
    },
    {
      "resource": "checklists",
      "action": "update",
      "scope": "LOCALITY"
    }
  ],
  "Admin Especialidade Local": [
    {
      "resource": "task_instances",
      "action": "view",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "task_instances",
      "action": "update",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "reports",
      "action": "upload",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "reports",
      "action": "download",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "reports",
      "action": "view",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "notices",
      "action": "view",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "notices",
      "action": "create",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "notices",
      "action": "update",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "checklists",
      "action": "view",
      "scope": "LOCALITY_SPECIALTY"
    },
    {
      "resource": "checklists",
      "action": "update",
      "scope": "LOCALITY_SPECIALTY"
    }
  ],
  "Comandante COMGEP": [
    {
      "resource": "kpis",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "kpis",
      "action": "export",
      "scope": "NATIONAL"
    },
    {
      "resource": "task_instances",
      "action": "view",
      "scope": "NATIONAL"
    },
    {
      "resource": "meetings",
      "action": "view",
      "scope": "NATIONAL"
    }
  ]
} as any;

export async function seedRbac(prisma: PrismaClient) {
  // 1) Permissions (catalog)
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action_scope: { resource: p.resource, action: p.action, scope: p.scope as any } },
      update: { description: p.description ?? null },
      create: { resource: p.resource, action: p.action, scope: p.scope as any, description: p.description ?? null },
    });
  }

  // 2) Roles (system roles)
  const systemRoles = [
    { name: "TI", description: "Administração geral do sistema", isSystemRole: true },
    { name: "Coordenação CIPAVD", description: "Coordenação nacional do programa", isSystemRole: true },
    { name: "Admin Especialidade Local", description: "Administra especialidade dentro da localidade", isSystemRole: true },
    { name: "GSD Localidade", description: "Gestão local do programa", isSystemRole: true },
    { name: "Comandante COMGEP", description: "Visão executiva/gerencial (sem PII)", isSystemRole: true },
  ];

  for (const r of systemRoles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, isSystemRole: r.isSystemRole },
      create: r as any,
    });
  }

  // 3) Vincular permissões sugeridas (exceto TI, que pode ser wildcard no guard)
  for (const [roleName, perms] of Object.entries(ROLE_SUGGESTIONS)) {
    if (roleName === "TI") continue;

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const p of perms) {
      const perm = await prisma.permission.findUnique({
        where: { resource_action_scope: { resource: p.resource, action: p.action, scope: p.scope as any } },
      });
      if (!perm) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: { constraintsJson: (p as any).constraintsJson ?? null },
        create: {
          roleId: role.id,
          permissionId: perm.id,
          constraintsJson: (p as any).constraintsJson ?? null,
        },
      });
    }
  }
}
