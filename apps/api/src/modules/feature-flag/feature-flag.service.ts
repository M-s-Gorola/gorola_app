import type { FeatureFlagRepository } from "./feature-flag.repository.js";

export class FeatureFlagService {
  public constructor(private readonly repository: FeatureFlagRepository) {}

  /**
   * Returns the boolean value of a feature flag.
   * Defaults to false if the flag does not exist.
   */
  public async getFlagValue(key: string): Promise<boolean> {
    const flag = await this.repository.getByKey(key);
    return flag?.value ?? false;
  }
}
