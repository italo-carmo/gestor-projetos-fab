import { hasAnyRole, ROLE_TI } from "../app/roleAccess";

type RoleLike = {
  name?: string | null;
  role?: { name?: string | null } | null;
};

type UserLike = {
  id?: string | null;
  roles?: RoleLike[];
  activeRole?: { name?: string | null } | null;
};

export function canDeleteUserAccessInUi(
  user: UserLike | undefined,
  targetUserId: string | null | undefined,
  canUpdateUsers: boolean,
) {
  const actorId = String(user?.id ?? "").trim();
  const targetId = String(targetUserId ?? "").trim();
  return (
    canUpdateUsers &&
    Boolean(targetId) &&
    actorId !== targetId &&
    hasAnyRole(user as any, [ROLE_TI])
  );
}

export function normalizeEmailSettingDraft(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}
