import type { ReactElement } from "react";

import { DangerZoneSection } from "@/components/account/DangerZoneSection";
import { DataNomineeSection } from "@/components/account/DataNomineeSection";
import { DataPortabilitySection } from "@/components/account/DataPortabilitySection";
import { PrivacySettingsSection } from "@/components/account/PrivacySettingsSection";
import { TopographicBg } from "@/components/shared/TopographicBg";

export function PrivacySettingsPage(): ReactElement {
  return (
    <div className="relative min-h-[80vh] px-4 py-10 md:px-10">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl bg-gorola-pine/[0.03]">
        <TopographicBg opacity={0.08} />
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <header className="mb-6">
          <h1 className="font-playfair text-4xl text-gorola-charcoal">
            Privacy &amp; Data Rights
          </h1>
          <p className="mt-2 font-dm-sans text-gorola-slate">
            Manage your statutory consent preferences and exercise your data rights under India&apos;s DPDP Act 2023.
          </p>
        </header>

        <div className="space-y-6">
          <PrivacySettingsSection />
          <DataPortabilitySection />
          <DataNomineeSection />
          <DangerZoneSection />
        </div>
      </div>
    </div>
  );
}

