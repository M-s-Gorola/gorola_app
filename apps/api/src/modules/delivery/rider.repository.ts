import { NotImplementedError } from "@gorola/shared";
import type { DeliveryRider, PrismaClient, RiderLocation } from "@prisma/client";

export class RiderRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async create(input: {
    name: string;
    phone: string;
    email: string;
    passwordHash: string;
    storeId: string;
  }): Promise<DeliveryRider> {
    return this.db.deliveryRider.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        passwordHash: input.passwordHash,
        storeId: input.storeId,
        isActive: true,
        isDeleted: false
      }
    });
  }

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<DeliveryRider | null> {
    return this.db.deliveryRider.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  public async findByEmail(
    email: string,
    options?: { includeDeleted?: boolean }
  ): Promise<DeliveryRider | null> {
    return this.db.deliveryRider.findFirst({
      where: {
        email,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  public async getActiveByStore(storeId: string): Promise<DeliveryRider[]> {
    void this.db;
    void storeId;
    throw new NotImplementedError("Rider active orders feed is deferred to Phase 5.2");
  }

  public async updateLocation(
    riderId: string,
    input: { lat: string | number; lng: string | number }
  ): Promise<RiderLocation> {
    void this.db;
    void riderId;
    void input;
    throw new NotImplementedError("Rider location tracking is deferred to Phase 5.4");
  }
}