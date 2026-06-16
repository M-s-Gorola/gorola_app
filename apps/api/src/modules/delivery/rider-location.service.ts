import { ValidationError } from "@gorola/shared";
import type { Server } from "socket.io";

import type { RiderRepository } from "./rider.repository.js";

export class RiderLocationService {
  public constructor(
    private readonly riderRepository: RiderRepository,
    private readonly ioGetter: () => Server
  ) {}

  public async updateLocation(
    riderId: string,
    input: { lat: number; lng: number; orderId: string }
  ) {
    if (input.lat < -90 || input.lat > 90) {
      throw new ValidationError("Invalid coordinates", {
        lat: ["Latitude must be between -90 and 90"]
      });
    }

    if (input.lng < -180 || input.lng > 180) {
      throw new ValidationError("Invalid coordinates", {
        lng: ["Longitude must be between -180 and 180"]
      });
    }

    const location = await this.riderRepository.updateLocation(riderId, {
      lat: input.lat,
      lng: input.lng
    });

    const io = this.ioGetter();
    const room = `order:${input.orderId}`;
    io.to(room).emit("rider_location_update", {
      lat: Number(location.lat),
      lng: Number(location.lng),
      updatedAt: location.updatedAt.toISOString()
    });

    return location;
  }

  public async getLastKnownLocationForOrder(
    orderId: string
  ): Promise<{ lat: string; lng: string; updatedAt: string } | null> {
    const loc = await this.riderRepository.getLocationByOrderId(orderId);
    if (!loc) return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      updatedAt: loc.updatedAt.toISOString()
    };
  }
}
