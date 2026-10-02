import { ArrowLeft, FileText, Gavel, ShieldAlert } from "lucide-react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { TopographicBg } from "@/components/shared/TopographicBg";

export function TermsOfServicePage(): ReactElement {
  return (
    <div className="relative min-h-[85vh] px-4 py-10 md:px-10">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl bg-gorola-pine/[0.03]">
        <TopographicBg opacity={0.08} />
      </div>

      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gorola-pine hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gorola-pine/10 p-2.5 text-gorola-pine">
              <Gavel className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-playfair text-3xl font-bold text-gorola-charcoal sm:text-4xl">
                GoRola Terms of Service
              </h1>
              <p className="font-dm-sans text-xs text-gorola-slate">
                User Agreement &bull; Version 1.0 (Effective 29/09/2026) &bull; Mussoorie, Uttarakhand
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gorola-pine/10 bg-white/80 p-6 shadow-sm backdrop-blur-md space-y-6 text-sm text-gorola-charcoal/90 leading-relaxed font-dm-sans">
          {/* 1. Eligibility */}
          <div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-gorola-pine" />
              1. Eligibility &amp; Account Creation
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                To use GoRola, you must be <strong>at least 18 years of age</strong> and legally competent to enter into a binding contract under the Indian Contract Act, 1872 and the Digital Personal Data Protection (DPDP) Act 2023. By creating an account or accessing our services, you expressly represent and warrant that you are 18 years or older.
              </p>
              <p>
                Accounts are authenticated via mobile One-Time Password (OTP). You are solely responsible for maintaining the confidentiality of your credentials and all activities occurring under your authenticated session.
              </p>
            </div>
          </div>

          {/* 2. Hill Operations & Weather Delivery Modes */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gorola-pine" />
              2. Hill-Station Operations &amp; Weather Delivery Modes
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                GoRola is purpose-built for the steep terrain, altitude, and climate conditions of <strong>Mussoorie</strong> and surrounding hill ridges (Landour, Barlowganj, Library, Picture Palace, Mall Road).
              </p>
              <p>
                During severe hill weather (dense fog, monsoons, snow, landslides), GoRola activates <strong>Weather Mode</strong>. Delivery estimates, minimum order thresholds, and rider dispatch routes may adjust dynamically to ensure rider safety while maintaining hill-station fulfillment.
              </p>
            </div>
          </div>

          {/* 3. Ordering, Pricing & Payments */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              3. Ordering, Pricing &amp; Payments
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                Prices shown on GoRola are inclusive of applicable GST unless explicitly stated. Item availability is tracked live per local merchant partner.
              </p>
              <p>
                We support Cash on Delivery (COD) and secure online payments via our authorized payment aggregator partner (<strong className="font-semibold text-gorola-charcoal">Razorpay</strong>), supporting UPI, Cards, and Netbanking.
              </p>
            </div>
          </div>

          {/* 4. Cancellations, Returns & Refunds */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              4. Cancellations, Returns &amp; Refunds
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                Orders can be cancelled before store acceptance without penalty. Due to the perishable nature of quick-commerce goods (dairy, fresh bakery, produce), cancellations once items are dispatched cannot be accommodated unless items are damaged or expired.
              </p>
              <p>
                Approved refunds are processed via the original payment method through Razorpay within 5–7 business days.
              </p>
            </div>
          </div>

          {/* 5. User Conduct */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              5. User Conduct &amp; Prohibited Uses
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                Users agree not to engage in fraudulent orders, abusive behavior toward store partners or delivery riders, unauthorized scraping or reverse engineering of the application, or misrepresentation of location coordinates.
              </p>
            </div>
          </div>

          {/* 6. Disclaimers & Force Majeure */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              6. Disclaimers, Liability &amp; Force Majeure
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                GoRola shall not be held liable for delivery delays or order cancellations arising from events beyond reasonable control, including natural disasters, landslides, severe weather closures by civil administration, telecommunications outages, or road blockages.
              </p>
            </div>
          </div>

          {/* 7. Governing Law */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              7. Governing Law &amp; Dispute Resolution
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                These Terms of Service are governed by the laws of India. Any disputes arising out of or related to these terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>Dehradun, Uttarakhand</strong>.
              </p>
              <p>
                For data protection and privacy inquiries, please review our comprehensive{" "}
                <Link to="/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
