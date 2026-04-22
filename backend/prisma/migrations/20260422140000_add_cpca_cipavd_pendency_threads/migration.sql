DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CpcComplaintCipavdThreadType'
  ) THEN
    CREATE TYPE "CpcComplaintCipavdThreadType" AS ENUM ('NOTE', 'PENDENCY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CpcComplaintCipavdThreadStatus'
  ) THEN
    CREATE TYPE "CpcComplaintCipavdThreadStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CpcComplaintCipavdAuthorKind'
  ) THEN
    CREATE TYPE "CpcComplaintCipavdAuthorKind" AS ENUM ('MANAGEMENT', 'PRESIDENT', 'SYSTEM');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CpcComplaintCipavdMessageType'
  ) THEN
    CREATE TYPE "CpcComplaintCipavdMessageType" AS ENUM ('MESSAGE', 'RESOLUTION', 'REOPEN', 'FINALIZATION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CpcComplaintCipavdThread" (
  "id" TEXT NOT NULL,
  "complaintCaseId" TEXT NOT NULL,
  "type" "CpcComplaintCipavdThreadType" NOT NULL,
  "status" "CpcComplaintCipavdThreadStatus" NOT NULL,
  "createdById" TEXT NOT NULL,
  "resolvedById" TEXT,
  "closedById" TEXT,
  "reopenedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcComplaintCipavdThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcComplaintCipavdThread_complaintCaseId_fkey" FOREIGN KEY ("complaintCaseId") REFERENCES "CpcComplaintCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCipavdThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCipavdThread_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCipavdThread_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CpcComplaintCipavdMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "authorKind" "CpcComplaintCipavdAuthorKind" NOT NULL,
  "type" "CpcComplaintCipavdMessageType" NOT NULL DEFAULT 'MESSAGE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcComplaintCipavdMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcComplaintCipavdMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CpcComplaintCipavdThread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCipavdMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CpcComplaintCipavdThread_complaintCaseId_type_status_idx"
  ON "CpcComplaintCipavdThread"("complaintCaseId", "type", "status");

CREATE INDEX IF NOT EXISTS "CpcComplaintCipavdThread_complaintCaseId_lastMessageAt_idx"
  ON "CpcComplaintCipavdThread"("complaintCaseId", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "CpcComplaintCipavdMessage_threadId_createdAt_idx"
  ON "CpcComplaintCipavdMessage"("threadId", "createdAt");

WITH role_permission_targets(role_name, resource, action, scope) AS (
  VALUES
    ('CPCA', 'smif_complaints', 'view', 'LOCALITY'),
    ('CPCA', 'smif_complaints', 'update', 'LOCALITY')
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT concat('roleperm_', gen_random_uuid()::text), r.id, p.id
FROM role_permission_targets t
JOIN "Role" r
  ON r."name" = t.role_name
JOIN "Permission" p
  ON p."resource" = t.resource
 AND p."action" = t.action
 AND p."scope" = t.scope::"PermissionScope"
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" rp
  WHERE rp."roleId" = r.id
    AND rp."permissionId" = p.id
);
