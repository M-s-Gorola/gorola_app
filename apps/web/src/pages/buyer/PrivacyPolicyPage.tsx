import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Lock,
  RefreshCw,
  Scale,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { ConsentNoticeModal } from "@/components/consent/ConsentNoticeModal";
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
                Statutory Compliance Notice &bull; Digital Personal Data Protection (DPDP) Act 2023 &bull; Version 1.1 (Effective 29/09/2026)
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gorola-pine/10 bg-white/80 p-6 shadow-sm backdrop-blur-md space-y-6 text-sm text-gorola-charcoal/90 leading-relaxed font-dm-sans">
          {/* Section 1 */}
          <div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gorola-pine" />
              1. Overview &amp; Data Fiduciary Details
            </h2>
            <p className="text-gorola-slate text-xs leading-relaxed">
              GoRola (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates a hyper-local quick-commerce platform dedicated to serving Mussoorie, Landour, and surrounding Uttarakhand hill communities. As a <strong>Data Fiduciary</strong> under India&apos;s Digital Personal Data Protection (DPDP) Act 2023, we process your personal data lawfully, fairly, and transparently for specified, explicit, and legitimate purposes.
            </p>
          </div>

          {/* Section 2 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4 text-gorola-pine" />
              2. Categories of Personal Data Collected
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>We collect and process the following categories of personal data based on user interactions:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Identity &amp; Contact:</strong> Mobile phone number (encrypted at rest), Display Name (if optionally set).</li>
                <li><strong>Age Eligibility &amp; Verification:</strong> Date of birth (processed ephemerally in-memory at registration to verify 18+ eligibility and discarded immediately without persistent storage; only the timestamp of your affirmative declaration is retained).</li>
                <li><strong>Delivery &amp; Location:</strong> Saved delivery addresses, landmark descriptions, GPS pin coordinates, and dynamic order delivery coordinates.</li>
                <li><strong>Commercial &amp; Financial:</strong> Order histories, item preferences, and payment transaction metadata (excluding raw card numbers or CVVs).</li>
                <li><strong>Technical &amp; Telemetry:</strong> Anonymized performance metrics, IP addresses (stored with 30-day retention), and temporary session tokens.</li>
              </ul>
            </div>
          </div>

          {/* Section 3 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4 text-gorola-pine" />
              3. Specified Purposes of Data Processing
            </h2>
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">A. Authentication &amp; Account Security (Essential)</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Essential</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  We process your phone number exclusively to verify your identity via One-Time Passwords (OTP), prevent unauthorized account access, and ensure session integrity.
                </p>
                <div className="pt-1">
                  <ConsentNoticeModal
                    purpose="OTP_AUTH"
                    triggerLabel="View Complete Notice"
                    triggerClassName="inline-flex items-center gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">B. Age Verification &amp; Statutory Eligibility (Essential)</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Essential</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  Under Section 9 of the DPDP Act 2023, we process your date of birth once during sign-up to verify that you meet the 18+ legal age requirement. Raw date of birth is never stored on our servers; we retain only the timestamp of your verified affirmative declaration.
                </p>
                <div className="pt-1">
                  <ConsentNoticeModal
                    purpose="AGE_DECLARATION"
                    triggerLabel="View Complete Notice"
                    triggerClassName="inline-flex items-center gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">C. Order Fulfillment &amp; Location Services (Essential)</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Essential</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  We process delivery addresses, landmark notes, GPS pins, and Display Names (if set) to route orders, assign delivery riders, coordinate with hill stores, and facilitate payments.
                </p>
                <div className="pt-1">
                  <ConsentNoticeModal
                    purpose="ORDER_PROCESSING"
                    triggerLabel="View Complete Notice"
                    triggerClassName="inline-flex items-center gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">D. Promotions &amp; Seasonal Offers (Voluntary)</h3>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Optional</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  With your explicit opt-in consent, we send updates on hill weather flash sales, seasonal discounts, and store coupons via SMS and app push notifications. 100% voluntary and withdrawable anytime.
                </p>
                <div className="pt-1">
                  <ConsentNoticeModal
                    purpose="MARKETING_COMMS"
                    triggerLabel="View Complete Notice"
                    triggerClassName="inline-flex items-center gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gorola-charcoal">E. Usage &amp; Performance Analytics (Voluntary)</h3>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Optional</span>
                </div>
                <p className="text-gorola-slate leading-relaxed">
                  We collect anonymous device telemetry and network latency data to improve hill route calculations and app speed in weak signal areas. Zero PII is tracked.
                </p>
                <div className="pt-1">
                  <ConsentNoticeModal
                    purpose="ANALYTICS"
                    triggerLabel="View Complete Notice"
                    triggerClassName="inline-flex items-center gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gorola-pine" />
              4. Retention Schedules &amp; Auto-Purge Timelines
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>In adherence to Section 8(7) of the DPDP Act 2023, data is retained strictly as long as necessary:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account Deletion &amp; 30-Day Grace Period:</strong> When you request account erasure, your account enters a 30-day grace period during which you can cancel deletion by logging in. After 30 days, automated purge workers permanently scrub PII and addresses.</li>
                <li><strong>7-Year GST &amp; Commercial Tax Retention:</strong> Order totals and financial transaction records are retained for 7 years as mandated by statutory Indian GST and accounting laws; associated delivery GPS coordinates are permanently nulled upon erasure.</li>
                <li><strong>90-Day OTP Logs:</strong> One-Time Password verification logs are automatically purged after 90 days.</li>
                <li><strong>180-Day Telemetry Logs:</strong> Performance telemetry logs are aggregated or purged after 180 days.</li>
                <li><strong>365-Day Audit Logs:</strong> Security audit logs are automatically archived after 365 days.</li>
              </ul>
            </div>
          </div>

          {/* Section 5 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <Server className="h-4 w-4 text-gorola-pine" />
              5. Third-Party Service Partners &amp; Infrastructure
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>Personal data is shared strictly on a need-to-know basis with vetted Data Processors:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="font-semibold text-gorola-charcoal">Exotel:</strong> DLT-registered Indian telecommunications gateway for transactional OTP delivery and promotional SMS.</li>
                <li><strong className="font-semibold text-gorola-charcoal">Ola Maps:</strong> Geolocation and hill-route mapping services (live GPS streams are processed in-transit and discarded).</li>
                <li><strong className="font-semibold text-gorola-charcoal">Razorpay:</strong> RBI-authorized payment aggregator for processing card and UPI payments securely.</li>
                <li><strong className="font-semibold text-gorola-charcoal">Railway:</strong> Cloud infrastructure host for API services and encrypted PostgreSQL databases (operating under DPAs with 30-day log limits).</li>
                <li><strong className="font-semibold text-gorola-charcoal">Vercel:</strong> Static edge hosting for front-end web client distribution.</li>
                <li><strong>Assigned Local Store Partners &amp; Delivery Riders:</strong> Assigned merchant and rider receive display name, landmark notes, and address pin solely for order packing and physical delivery.</li>
              </ul>
            </div>
          </div>

          {/* Section 6 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-gorola-pine" />
              6. Your Statutory Data Principal Rights (DPDP Act 2023)
            </h2>
            <div className="space-y-3 text-xs text-gorola-slate">
              <p>Under Chapter III of the DPDP Act 2023, you hold the following non-derogable rights:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Right to Access &amp; Portability (Sec 11):</strong> Request a summary of personal data processed and identities of all third parties shared with. Export your full personal data archive via <Link to="/account/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">Download My Data</Link>.
                </li>
                <li>
                  <strong>Right to Correction &amp; Erasure (Sec 12):</strong> Rectify inaccurate data or request permanent deletion of your account and personal identifiers under the <Link to="/account/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">Danger Zone</Link>.
                </li>
                <li>
                  <strong>Right of Grievance Redressal (Sec 13):</strong> Contact our Data Protection Officer for prompt resolution of privacy concerns within 30 days.
                </li>
                <li>
                  <strong>Right to Nominate (Sec 14):</strong> Appoint an authorized nominee to exercise data rights in the event of death or incapacity via the <Link to="/account/privacy" className="font-semibold text-gorola-pine underline hover:text-emerald-700">Nominee Configuration</Link> tool.
                </li>
                <li>
                  <strong>Right to Withdraw Consent (Sec 6):</strong> Easily withdraw voluntary consents (marketing, analytics) with 1 click from your Privacy Dashboard.
                </li>
              </ul>
            </div>
          </div>

          {/* Section 7 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-gorola-pine" />
              7. Protection of Children&apos;s Data
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                GoRola is for people who are at least <strong>18 years of age</strong>. When you first create an account we ask for your date of birth once, to confirm this. We do not store your date of birth — we keep only the date on which you confirmed you are an adult. We do not knowingly collect or process personal data of anyone under 18. If we learn that someone under 18 has an account, we close it and erase their personal data. If someone is refused at sign-up, we keep a one-way scrambled (hashed) form of their phone number, which cannot be read back, for 90 days only, solely to stop repeated sign-up attempts, and then delete it. If you are a parent or guardian and believe a child is using GoRola, write to <a href="mailto:privacy@gorola.in" className="font-semibold text-gorola-pine underline hover:text-emerald-700">privacy@gorola.in</a>.
              </p>
            </div>
          </div>

          {/* Section 8 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4 text-gorola-pine" />
              8. Technical Security Safeguards &amp; Breach Notification
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                We maintain robust technical and organizational security measures under Section 8(5) of the DPDP Act 2023, including AES-256-GCM encryption at rest for personal identifiers, HMAC-SHA256 blind indexing, TLS 1.3 in transit, role-separated database credentials (DML/DDL separation), and rate-limiting brute-force defenses.
              </p>
              <p>
                In the event of a personal data breach affecting users, GoRola maintains an incident response protocol to notify the Data Protection Board of India and affected Data Principals within statutory timelines (<strong>72 hours</strong>).
              </p>
            </div>
          </div>

          {/* Section 9 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2">
              9. Data Protection Officer &amp; Grievance Redressal
            </h2>
            <div className="rounded-xl bg-gorola-pine/5 p-4 text-xs text-gorola-charcoal space-y-1.5">
              <p>
                <strong>Data Protection Officer (DPO):</strong> Grievance Redressal Desk
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:privacy@gorola.in"
                  className="font-semibold text-gorola-pine underline hover:text-emerald-700"
                >
                  privacy@gorola.in
                </a>
              </p>
              <p>
                <strong>Statutory Authority:</strong> If you are unsatisfied with our grievance resolution within 30 days, you hold the statutory right under the DPDP Act 2023 to file a complaint with the <strong>Data Protection Board of India (DPBI)</strong>.
              </p>
            </div>
          </div>

          {/* Section 10 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-gorola-pine" />
              10. Policy Updates &amp; Versioning
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                We may periodically update this Privacy Policy to reflect statutory rule notifications or service updates. Any material revisions will be accompanied by an updated version number and prominent re-consent notifications upon user login.
              </p>
            </div>
          </div>

          {/* Section 11 */}
          <div className="border-t border-gorola-charcoal/5 pt-5">
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal mb-2 flex items-center gap-2">
              <Gavel className="h-4 w-4 text-gorola-pine" />
              11. Governing Law &amp; Jurisdiction
            </h2>
            <div className="space-y-2 text-xs text-gorola-slate leading-relaxed">
              <p>
                This Privacy Policy and all matters related to the processing of personal data shall be governed by the laws of India, including the DPDP Act 2023. Any legal disputes shall be subject to the exclusive jurisdiction of the competent courts in <strong>Dehradun, Uttarakhand</strong>.
              </p>
            </div>
          </div>

          {/* Footer CTA */}
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
