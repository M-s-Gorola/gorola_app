import { getRedisClient } from "../../lib/redis.js";
import type { FeatureFlagRepository } from "./feature-flag.repository.js";

export class FeatureFlagService {
  public constructor(private readonly repository: FeatureFlagRepository) {}

  /**
   * Returns the boolean value of a feature flag.
   * Defaults to false if the flag does not exist.
   */
  public async getFlagValue(key: string): Promise<boolean> {
    const isTest = process.env.NODE_ENV === "test";
    const redis = isTest ? null : getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(`feature_flag:${key}`);
        if (cached !== null) {
          return cached === "true";
        }
      } catch (err) {
        console.error("Redis get flag error", err);
      }
    }

    const flag = await this.repository.getByKey(key);
    const value = flag?.value ?? false;

    if (redis) {
      try {
        await redis.set(`feature_flag:${key}`, String(value), "EX", 60);
      } catch (err) {
        console.error("Redis set flag error", err);
      }
    }

    return value;
  }
}
