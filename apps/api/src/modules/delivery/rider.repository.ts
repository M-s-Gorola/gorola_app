import { NotImplementedError } from "@gorola/shared";
import type { DeliveryRider, PrismaClient, RiderLocation } from "@prisma/client";
import { Prisma } from "@prisma/client";

export class RiderRepository {
  public constructor(private readonly db: PrismaClient) {}

  private mapRiderWithStoreId<
    T extends DeliveryRider & { stores?: { storeId: string; isPrimary: boolean }[] }
  >(rider: T | null): (T & { storeId: string }) | null {
    if (!rider) return null;
    const primaryStore = rider.stores?.find((s) => s.isPrimary) || rider.stores?.[0];
    const storeId = primaryStore?.storeId || "";
    return {
      ...rider,
      storeId
    };
  }

  public async create(input: {
    name: string;
    phone: string;
    email: string;
    passwordHash: string;
    storeId: string;
  }): Promise<DeliveryRider & { storeId: string }> {
    const rider = await this.db.deliveryRider.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        passwordHash: input.passwordHash,
        isActive: true,
        isDeleted: false,
        stores: {
          create: {
            storeId: input.storeId,
            isPrimary: true
          }
        }
      },
      include: {
        stores: true
      }
    });
    return this.mapRiderWithStoreId(rider)!;
  }

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<(DeliveryRider & { storeId: string }) | null> {
    const rider = await this.db.deliveryRider.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      },
      include: {
        stores: true
      }
    });
    return this.mapRiderWithStoreId(rider);
  }

  public async findByEmail(
    email: string,
    options?: { includeDeleted?: boolean }
  ): Promise<(DeliveryRider & { storeId: string }) | null> {
    const rider = await this.db.deliveryRider.findFirst({
      where: {
        email,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      },
      include: {
        stores: true
      }
    });
    return this.mapRiderWithStoreId(rider);
  }

  public async getPrimaryStoreId(riderId: string): Promise<string | null> {
    const primary = await this.db.riderStore.findFirst({
      where: { riderId, isPrimary: true }
    });
    if (primary) return primary.storeId;

    const first = await this.db.riderStore.findFirst({
      where: { riderId }
    });
    return first?.storeId || null;
  }

  public async getAllStoreIds(riderId: string): Promise<string[]> {
    const relations = await this.db.riderStore.findMany({
      where: { riderId },
      select: { storeId: true }
    });
    return relations.map((r) => r.storeId);
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
    const latDecimal = new Prisma.Decimal(input.lat);
    const lngDecimal = new Prisma.Decimal(input.lng);

    const existing = await this.db.riderLocation.findFirst({
      where: { riderId }
    });

    if (existing) {
      return this.db.riderLocation.update({
        where: { id: existing.id },
        data: {
          lat: latDecimal,
          lng: lngDecimal
        }
      });
    }

    return this.db.riderLocation.create({
      data: {
        riderId,
        lat: latDecimal,
        lng: lngDecimal
      }
    });
  }

  public async getRiderIdByOrderId(orderId: string): Promise<string | null> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: {
        riderId: true,
        orderType: true,
        bookingOrder: {
          select: { assignedTechnicianId: true }
        }
      }
    });
    if (!order) return null;

    if (order.orderType === "BOOKING") {
      return order.bookingOrder?.assignedTechnicianId || null;
    }
    return order.riderId;
  }

  public async getLocationByOrderId(
    orderId: string
  ): Promise<{ lat: string; lng: string; updatedAt: Date } | null> {
    const riderId = await this.getRiderIdByOrderId(orderId);
    if (!riderId) return null;

    const loc = await this.db.riderLocation.findFirst({
      where: { riderId }
    });
    if (!loc) return null;

    return {
      lat: loc.lat.toString(),
      lng: loc.lng.toString(),
      updatedAt: loc.updatedAt
    };
  }
}