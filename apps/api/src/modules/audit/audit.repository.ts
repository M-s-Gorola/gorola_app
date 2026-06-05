import type { ActorRole, AuditLog, Prisma, PrismaClient } from "@prisma/client";

export type CreateAuditLogInput = {
  actorId: string;
  actorRole: ActorRole;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ip: string;
  userAgent: string;
};

export class AuditRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async create(input: CreateAuditLogInput): Promise<AuditLog> {
    return this.db.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.oldValue !== undefined ? { oldValue: input.oldValue } : {}),
        ...(input.newValue !== undefined ? { newValue: input.newValue } : {}),
        ip: input.ip,
        userAgent: input.userAgent
      }
    });
  }

  public async findMany(filters: {
    actorRole?: ActorRole | undefined;
    action?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    from?: string | Date | undefined;
    to?: string | Date | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
  }): Promise<{ items: AuditLog[]; nextCursor: string | null }> {
    const limit = filters.limit ?? 50;
    const { actorRole, action, entityType, entityId, from, to, cursor } = filters;

    const where: Prisma.AuditLogWhereInput = {
      ...(actorRole ? { actorRole } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {})
        }
      } : {})
    };

    const logs = await this.db.auditLog.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return {
      items,
      nextCursor
    };
  }
}