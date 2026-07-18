import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

interface AuditInput {
  hotelId: string | null;
  userId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/** Write-only audit log service (Architecture §2, Constitution §2 rule #7). */
export async function audit({ hotelId, userId, action, metadata = {}, ipAddress = null }: AuditInput) {
  await prisma.auditLog.create({
    data: { hotelId, userId, action, metadata, ipAddress },
  });
}
