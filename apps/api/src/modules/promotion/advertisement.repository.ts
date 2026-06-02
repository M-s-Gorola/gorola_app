import { NotFoundError } from "@gorola/shared";
import type { Advertisement, PrismaClient } from "@prisma/client";

export type CreateAdvertisementInput = {
  storeId: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  startsAt: Date;
  endsAt: Date;
};

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class AdvertisementRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findActive(now: Date = new Date()): Promise<Advertisement[]> {
    return this.db.advertisement.findMany({
      where: {
        isActive: true,
        isApproved: true,
        startsAt: { lte: now },
        endsAt: { gte: now }
      },
      orderBy: { startsAt: "desc" }
    });
  }

  public async create(input: CreateAdvertisementInput): Promise<Advertisement> {
    try {
      return await this.db.advertisement.create({
        data: {
          storeId: input.storeId,
          title: input.title,
          imageUrl: input.imageUrl,
          linkUrl: input.linkUrl ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          isActive: true,
          isApproved: false
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError("Store not found", { storeId: input.storeId }, error);
      }
      throw error;
    }
  }

  public async approve(id: string): Promise<Advertisement> {
    try {
      return await this.db.advertisement.update({
        where: { id },
        data: { isApproved: true, isActive: true }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Advertisement not found", { id }, error);
      }
      throw error;
    }
  }

  public async deactivate(id: string): Promise<Advertisement> {
    try {
      return await this.db.advertisement.update({
        where: { id },
        data: { isActive: false }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Advertisement not found", { id }, error);
      }
      throw error;
    }
  }
}