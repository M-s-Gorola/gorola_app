import { ArrowLeft, ExternalLink, FileText, Lock, ShieldCheck, UserCheck } from "lucide-react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { TopographicBg } from "@/components/shared/TopographicBg";

export function PrivacyPolicyPage(): ReactElement {
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
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-playfair text-3xl font-bold text-gorola-charcoal sm:text-4xl">
                GoRola Privacy Policy
              </h1>
              <p className="font-dm-sans text-xs text-gorola-slate">
                Statutory Compliance Notice &bull; Digital Personal Data Protection (DPDP) Act 2023 &bull; Version 1.0 (Effective 29/09/2026)
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gorola-pine/10 bg-white/80 p-6 shadow-sm backdrop-blur-md space-y-6 text-sm text-gorola-charcoal/90 leading-relaxed font-dm-sans">
          <div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gorola-pine" />
              1. Overview &amp; Data Fiduciary Details
            </h2>
            <p className="text-gorola-slate text-xs leading-relaxed">
              GoRola (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates a hyper-local quick-commerce platform serving the Mussoorie hill-station region. As a <strong>Data Fiduciary</strong> under India&apos;s Digital Personal Data Protection (DPDP) Act 2023, we are committed to processing your personal data lawfully, fairly, and transparently for specified, explicit purposes.
            </p>
          </div>

          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-gorola-pine" />
              2. Specified Purposes of Data Processing &amp; Service Partners
            </h2>

            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">A. Authentication &amp; Account Security (Essential)</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Essential</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  We process your phone number exclusively to verify your identity via One-Time Passwords (OTP), prevent unauthorized account access, and ensure session integrity.
                </p>
                <p className="text-gorola-slate">
                  <strong>Third-Party Processors:</strong> Transmitted securely via our encrypted internal microservices and shared with our authorized SMS Gateway Partner (<strong className="font-semibold text-gorola-charcoal">Exotel</strong>) solely for automated OTP delivery. Data is never sold or monetized.
                </p>
                <p className="text-gorola-slate">
                  <strong>Retention:</strong> Active account lifetime; permanently erased within 30 days of account deletion.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">B. Order Fulfillment &amp; Location Services (Essential)</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Essential</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  We process delivery addresses, landmark notes, GPS pins, and Display Names (if set) to route orders, assign delivery riders, coordinate with hill stores, and facilitate payments.
                </p>
                <p className="text-gorola-slate">
                  <strong>Third-Party Processors:</strong> Shared strictly on a need-to-know basis with <strong className="font-semibold text-gorola-charcoal">Ola Maps</strong> (spatial routing and geolocation), <strong className="font-semibold text-gorola-charcoal">Razorpay</strong> (secure payment processing for online payments), and <strong className="font-semibold text-gorola-charcoal">Local Store Partners &amp; Assigned Delivery Riders</strong> (order packing and physical delivery).
                </p>
                <p className="text-gorola-slate">
                  <strong>Retention:</strong> Delivery coordinates on orders are nulled upon erasure requests; financial transaction records are retained for 7 years as required by Indian GST and commercial accounting law. Live GPS streams are processed in-transit by <strong className="font-semibold text-gorola-charcoal">Ola Maps</strong> and never permanently persisted.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">C. Promotions &amp; Seasonal Offers (Voluntary)</h3>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Optional</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  With your explicit consent, we send updates on hill weather flash sales, seasonal discounts, and store coupons via SMS (<strong className="font-semibold text-gorola-charcoal">Exotel</strong>) and app push notifications using your phone number, Display Name (if set), and purchase categories.
                </p>
                <p className="text-gorola-slate">
                  <strong>Withdrawal:</strong> 100% voluntary. You can withdraw anytime from your Privacy Settings; contact lists are scrubbed within 48 hours.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">D. Usage &amp; Performance Analytics (Voluntary)</h3>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Optional</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  We collect anonymous device telemetry and network latency data to improve hill route calculations and app speed in weak signal areas.
                </p>
                <p className="text-gorola-slate">
                  <strong>Retention &amp; Anonymity:</strong> Zero PII is tracked. Telemetry logs are automatically purged or aggregated after 180 days.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-gorola-pine" />
              3. Your Statutory Data Principal Rights (DPDP Act 2023)
            </h2>
            <div className="space-y-3 text-xs text-gorola-slate">
              <p>
                Under Chapter III of the DPDP Act 2023, you hold the following non-derogable rights:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Right to Access &amp; Portability (Sec 11):</strong> Request a summary of personal data processed and identities of all third parties shared with. Export your full personal data archive via <Link to="/account/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">Download My Data</Link>.
                </li>
                <li>
                  <strong>Right to Correction &amp; Erasure (Sec 12):</strong> Rectify inaccurate data or request permanent deletion of your account and personal identifiers under the <Link to="/account/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">Danger Zone</Link>.
                </li>
                <li>
                  <strong>Right of Grievance Redressal (Sec 13):</strong> Contact our Data Protection Officer for prompt resolution of privacy concerns.
                </li>
                <li>
                  <strong>Right to Nominate (Sec 14):</strong> Appoint an authorized nominee to exercise data rights in the event of death or incapacity via the <Link to="/account/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">Nominee Configuration</Link> tool.
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              4. Data Protection Officer &amp; Grievance Redressal
            </h2>
            <div className="rounded-xl bg-gorola-pine/5 p-4 text-xs text-gorola-charcoal space-y-1.5">
              <p>
                <strong>Data Protection Officer (DPO):</strong> Grievance Redressal Desk
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:dpo@gorola.com"
                  className="font-semibold text-gorola-pine underline hover:text-emerald-700"
                >
                  dpo@gorola.com
                </a>
              </p>
              <p>
                <strong>Statutory Authority:</strong> If you are unsatisfied with our grievance resolution, you hold the legal right to file a complaint with the <strong>Data Protection Board of India (DPBI)</strong>.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gorola-charcoal/5">
            <span className="text-xs text-gorola-slate">
              Need to manage your consents or exercise your rights?
            </span>
            <Link
              to="/account/privacy"
              className="inline-flex items-center gap-1.5 rounded-full bg-gorola-pine px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-gorola-pine/90 transition-all"
            >
              Manage Privacy &amp; Consent Settings
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
