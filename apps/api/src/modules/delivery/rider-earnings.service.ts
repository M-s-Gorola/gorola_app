import type { PrismaClient, RiderEarning } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library.js";

import type { SystemSettingService } from "../admin/system-setting.service.js";
import { calculateRiderEarning } from "./rider-earning-calculator.js";
import type { RiderEarningsRepository } from "./rider-earnings.repository.js";

export class RiderEarningsService {
  public constructor(
    private readonly db: PrismaClient,
    private readonly repository: RiderEarningsRepository,
    private readonly systemSettingService: SystemSettingService
  ) {}

  public async getSummary(riderId: string) {
    const summary = await this.repository.getSummary(riderId);
    return {
      today: {
        count: summary.today.count,
        total: summary.today.total.toFixed(2)
      },
      thisWeek: {
        count: summary.thisWeek.count,
        total: summary.thisWeek.total.toFixed(2)
      },
      thisMonth: {
        count: summary.thisMonth.count,
        total: summary.thisMonth.total.toFixed(2)
      }
    };
  }

  public async getHistory(
    riderId: string,
    cursor?: string,
    limit?: number,
    startDate?: string,
    endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const { items, nextCursor, filterSummary } = await this.repository.getHistory(riderId, cursor, limit, start, end);
    return {
      items: items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        amount: item.amount.toFixed(2),
        earningType: item.earningType,
        distanceKm: item.distanceKm ? item.distanceKm.toFixed(3) : null,
        createdAt: item.createdAt
      })),
      nextCursor,
      filterSummary: {
        count: filterSummary.count,
        total: filterSummary.total.toFixed(2)
      }
    };
  }

  public async createEarningForDelivery(
    riderId: string,
    orderId: string,
    deliveryFee: Decimal,
    storeId: string
  ): Promise<RiderEarning> {
    const store = await this.db.store.findUnique({
      where: { id: storeId }
    });

    const rateString =
      store?.riderEarningRatePct !== null && store?.riderEarningRatePct !== undefined
        ? store.riderEarningRatePct.toString()
        : await this.systemSettingService.getSettingValue("RIDER_EARNING_RATE_PCT", "100");

    const earningRatePct = new Decimal(rateString);

    const output = calculateRiderEarning({
      deliveryFee,
      earningRatePct,
      model: "PER_ORDER"
    });

    return this.repository.createEarning({
      riderId,
      orderId,
      amount: output.amount,
      earningType: output.earningType,
      distanceKm: null
    });
  }
}
