import {
  ArrowRight,
  CloudRain,
  HeartHandshake,
  MapPin,
  Mountain,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export function AboutPage(): ReactElement {
  return (
    <div className="mx-auto max-w-4xl space-y-10 py-6 px-4 sm:px-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gorola-pine via-emerald-800 to-gorola-charcoal p-8 sm:p-12 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
            <Mountain className="h-4 w-4 text-gorola-saffron" />
            <span>Built for the Queen of the Hills</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            About GoRola
          </h1>
          <p className="font-body text-base sm:text-lg text-gorola-fog/90 leading-relaxed">
            Mussoorie, delivered. We connect residents, travellers, and mountain communities with
            their favorite local stores, bakeries, cafes, and daily essentials across the steep hill terrain.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-gorola-saffron px-5 py-2.5 text-xs sm:text-sm font-bold text-gorola-charcoal shadow-md hover:bg-amber-400 transition-all"
            >
              <ShoppingBag className="h-4 w-4" />
              Explore Local Stores
            </Link>
            <Link
              to="/support"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/25 transition-all backdrop-blur-sm"
            >
              Contact Support
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-gorola-saffron/10 blur-3xl" />
      </section>

      {/* Story & Mission Section */}
      <section className="rounded-2xl border border-gorola-pine/10 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 text-gorola-pine font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="h-4 w-4 text-gorola-saffron" />
          <span>Our Story &amp; Purpose</span>
        </div>
        <h2 className="font-heading text-2xl font-bold text-gorola-charcoal">
          Tackling the Unique Altitude &amp; Gradient of Mussoorie
        </h2>
        <div className="space-y-3 text-sm text-gorola-slate leading-relaxed">
          <p>
            Standard plain-terrain delivery networks struggle on mountain inclines, narrow ridges,
            and sudden weather shifts. GoRola was engineered specifically for Mussoorie&apos;s
            distinct topography — delivering seamlessly from <strong>Mall Road to Landour</strong>,
            and reaching hillside homes tucked along scenic trails.
          </p>
          <p>
            Whether it&apos;s fresh sourdough from Landour Bakehouse, essential pharmacy medicines from
            Kulri Bazaar, or daily groceries delivered to Happy Valley during heavy fog, GoRola
            keeps mountain commerce moving safely, reliably, and quickly.
          </p>
        </div>
      </section>

      {/* 4 Core Pillars */}
      <section className="space-y-4">
        <div className="text-center sm:text-left space-y-1">
          <h2 className="font-heading text-2xl font-bold text-gorola-charcoal">
            What Sets GoRola Apart
          </h2>
          <p className="text-xs sm:text-sm text-gorola-slate">
            Built with deep mountain respect, rider safety, and local community values.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm space-y-3 hover:border-gorola-pine/30 transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gorola-pine/10 text-gorola-pine">
              <Mountain className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-lg font-bold text-gorola-charcoal">
              Hyperlocal Hill Logistics
            </h3>
            <p className="text-xs sm:text-sm text-gorola-slate leading-relaxed">
              Custom elevation-aware dispatch algorithms optimized for steep hill terrain, single-lane
              mountain passes, and foot-friendly walking trails.
            </p>
          </div>

          <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm space-y-3 hover:border-gorola-pine/30 transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <CloudRain className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-lg font-bold text-gorola-charcoal">
              Weather-Adaptive Dispatch
            </h3>
            <p className="text-xs sm:text-sm text-gorola-slate leading-relaxed">
              Real-time weather sensing adjusts ETAs and delivery zones automatically during dense
              monsoon showers, winter frost, and heavy fog to prioritize rider safety.
            </p>
          </div>

          <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm space-y-3 hover:border-gorola-pine/30 transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-lg font-bold text-gorola-charcoal">
              Empowering Local Merchants
            </h3>
            <p className="text-xs sm:text-sm text-gorola-slate leading-relaxed">
              We partner directly with long-standing heritage stores, organic growers, and family
              businesses across Mussoorie to digitize and preserve local trade.
            </p>
          </div>

          <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm space-y-3 hover:border-gorola-pine/30 transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-lg font-bold text-gorola-charcoal">
              Privacy-First Architecture
            </h3>
            <p className="text-xs sm:text-sm text-gorola-slate leading-relaxed">
              Compliant with India&apos;s DPDP Act 2023. Encrypted personal identifiers, zero-PII
              telemetry, and complete data principal control over your account.
            </p>
          </div>
        </div>
      </section>

      {/* Neighborhood Coverage */}
      <section className="rounded-2xl border border-gorola-pine/10 bg-gorola-cream/50 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 text-gorola-pine font-semibold text-xs uppercase tracking-wider">
          <MapPin className="h-4 w-4 text-gorola-pine" />
          <span>Mussoorie Coverage Zones</span>
        </div>
        <h3 className="font-heading text-xl font-bold text-gorola-charcoal">
          Delivering Across the Hill Station
        </h3>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            "Mall Road",
            "Kulri Bazaar",
            "Library Chowk",
            "Landour & Char Dukan",
            "Happy Valley",
            "Barlowganj",
            "Jharipani",
            "Hathipaon",
            "Bhatta Village",
            "Sister's Bazaar",
            "Camel's Back Road",
            "Cloud's End",
          ].map((zone) => (
            <span
              key={zone}
              className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gorola-charcoal shadow-sm border border-gorola-pine/10"
            >
              {zone}
            </span>
          ))}
        </div>
      </section>

      {/* Footer Navigation CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-white border border-gorola-pine/10 p-6 shadow-sm">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-heading text-base font-bold text-gorola-charcoal">
            Have questions or want to partner with us?
          </h4>
          <p className="text-xs text-gorola-slate">
            Our Mussoorie team is always ready to assist you.
          </p>
        </div>
        <Link
          to="/support"
          className="inline-flex items-center gap-2 rounded-full bg-gorola-pine px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
        >
          Visit Help &amp; Support
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
