import { GRIEVANCE_EMAIL, SUPPORT_EMAIL } from "@gorola/shared";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  HelpCircle,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  ShieldAlert,
  Store,
} from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "weather",
    question: "How does mountain weather affect delivery times?",
    answer:
      "During intense fog, heavy monsoon rains, or snow in upper Landour and Cloud's End, our weather-adaptive dispatch dynamically widens delivery windows to ensure rider safety on steep gradients. Live order tracking will update with realistic ETAs and weather advisories.",
  },
  {
    id: "cancellation",
    question: "Can I cancel or modify my order after placing it?",
    answer:
      "You can cancel your order free of charge before the merchant accepts and starts preparing it. Once food preparation or packing begins, cancellations may incur a nominal fee to compensate local store partners and riders.",
  },
  {
    id: "refunds",
    question: "How do refunds work for failed or cancelled orders?",
    answer:
      "Refunds are processed automatically via Razorpay to your original payment method. UPI refunds typically reflect within 2 to 24 hours, while net banking and credit/debit card refunds reflect within 3 to 5 business days.",
  },
  {
    id: "locations",
    question: "Which areas in Mussoorie does GoRola deliver to?",
    answer:
      "We deliver across Mall Road, Kulri Bazaar, Library Chowk, Landour, Char Dukan, Sister's Bazaar, Happy Valley, Barlowganj, Jharipani, Hathipaon, and Bhatta Village. Remote trails may have scheduled batch delivery windows.",
  },
  {
    id: "onboarding",
    question: "How can local Mussoorie merchants or riders join GoRola?",
    answer:
      `Local bakers, grocers, cafes, and delivery riders can contact our hill operations desk at ${SUPPORT_EMAIL}. Our team will assist with catalog onboarding, packaging guidelines, and fleet setup.`,
  },
];

export function SupportPage(): ReactElement {
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-6 px-4 sm:px-6">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gorola-charcoal via-slate-900 to-gorola-pine p-8 sm:p-12 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
            <HelpCircle className="h-4 w-4 text-gorola-saffron" />
            <span>Mussoorie Operations Desk</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Customer Support &amp; Help Desk
          </h1>
          <p className="font-body text-base sm:text-lg text-gorola-fog/90 leading-relaxed">
            We&apos;re here to help with your orders, mountain deliveries, and inquiries. Reach out to
            our local team or browse common answers below.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gorola-fog">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
              <Clock className="h-4 w-4 text-gorola-saffron" />
              <span>
                <strong>Desk Hours:</strong> 7:00 AM – 11:00 PM IST (Daily)
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
              <MapPin className="h-4 w-4 text-gorola-saffron" />
              <span>Mall Road &amp; Landour Ops</span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-gorola-pine/20 blur-3xl" />
      </section>

      {/* 3 Contact Support Channels */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Live Order Support */}
        <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-gorola-pine/30 transition-all">
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gorola-pine/10 text-gorola-pine">
              <Package className="h-5 w-5" />
            </div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              Live Order Assistance
            </h2>
            <p className="text-xs text-gorola-slate leading-relaxed">
              Need help with an ongoing order, delivery delay, or missing item? Track your order or
              email our dispatch desk.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <Link
              to="/account/orders"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gorola-pine/10 px-4 py-2.5 text-xs font-bold text-gorola-pine hover:bg-gorola-pine/20 transition-all"
            >
              View Order History
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gorola-pine/20 px-4 py-2 text-xs font-semibold text-gorola-charcoal hover:bg-gorola-pine/5 transition-all"
            >
              <Mail className="h-3.5 w-3.5 text-gorola-pine" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {/* Merchant & Fleet Inquiries */}
        <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-gorola-pine/30 transition-all">
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Store className="h-5 w-5" />
            </div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              Merchant &amp; Rider Inquiries
            </h2>
            <p className="text-xs text-gorola-slate leading-relaxed">
              Want to list your shop, bakery, or pharmacy on GoRola? Or join our mountain rider fleet
              in Mussoorie?
            </p>
          </div>
          <div className="pt-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Merchant%20or%20Rider%20Partnership`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-500/20 transition-all"
            >
              <Mail className="h-3.5 w-3.5 text-amber-700" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {/* Privacy & Grievance Desk */}
        <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-gorola-pine/30 transition-all">
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h2 className="font-heading text-lg font-bold text-gorola-charcoal">
              Data Privacy &amp; Grievances
            </h2>
            <p className="text-xs text-gorola-slate leading-relaxed">
              For DPDP statutory inquiries, data principal access requests, consent revocations, or
              grievance redressal.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <Link
              to="/privacy"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all"
            >
              Read Privacy Policy
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href={`mailto:${GRIEVANCE_EMAIL}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-gorola-charcoal hover:bg-emerald-50 transition-all"
            >
              <Mail className="h-3.5 w-3.5 text-emerald-700" />
              {GRIEVANCE_EMAIL}
            </a>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="rounded-2xl border border-gorola-pine/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-gorola-pine font-semibold text-xs uppercase tracking-wider">
          <MessageSquare className="h-4 w-4 text-gorola-saffron" />
          <span>Help Articles</span>
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold text-gorola-charcoal">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-gorola-slate mt-1">
            Quick answers to everyday questions about ordering, deliveries, and policies.
          </p>
        </div>

        <div className="divide-y divide-gorola-charcoal/10">
          {FAQ_ITEMS.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <div key={faq.id} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 text-left font-heading text-sm sm:text-base font-bold text-gorola-charcoal hover:text-gorola-pine transition-colors focus:outline-none"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-gorola-slate transition-transform duration-200",
                      isOpen && "rotate-180 text-gorola-pine"
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="mt-2 text-xs sm:text-sm text-gorola-slate leading-relaxed animate-in fade-in-50 duration-150">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Assistance Notice */}
      <div className="rounded-2xl bg-gorola-pine/5 border border-gorola-pine/15 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="space-y-1">
          <h3 className="font-heading text-base font-bold text-gorola-charcoal">
            Still need assistance?
          </h3>
          <p className="text-xs text-gorola-slate">
            Write directly to <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-gorola-pine underline hover:text-emerald-700">{SUPPORT_EMAIL}</a> and our Mussoorie desk will respond promptly.
          </p>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-full bg-gorola-pine px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
        >
          <Mail className="h-4 w-4" />
          Email Support
        </a>
      </div>
    </div>
  );
}
