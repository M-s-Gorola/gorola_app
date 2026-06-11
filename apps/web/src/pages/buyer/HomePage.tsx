import type { ReactElement } from "react";

import { AdvertisementBanner } from "@/components/buyer/AdvertisementBanner";
import { CategoryGrid } from "@/components/buyer/CategoryGrid";
import { HeroSection } from "@/components/buyer/HeroSection";

type HomePageProps = {
  apiBaseForDisplay?: string;
};

export function HomePage(_props: HomePageProps): ReactElement {
  void _props.apiBaseForDisplay;
  return (
    <div className="space-y-10">
      <HeroSection />
      <AdvertisementBanner />
      <section id="home-categories" className="rounded-2xl bg-white/70 px-6 py-10">
        <h2 className="font-playfair text-3xl text-gorola-charcoal">Categories</h2>
        <p className="mt-2 font-dm-sans text-sm text-gorola-slate">Shop by category.</p>
        <div className="mt-6">
          <CategoryGrid />
        </div>
      </section>
    </div>
  );
}
