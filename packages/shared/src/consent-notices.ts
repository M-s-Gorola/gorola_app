export const CONSENT_NOTICES = {
  OTP_AUTH: {
    "1.0": "By continuing, you agree to receive a One-Time Password (OTP) via SMS to verify your mobile number for account creation, login, and fraud prevention under India's DPDP Act 2023.",
    "1.1": "GoRola is for people aged 18 and over. By continuing, you agree to receive a One-Time Password (OTP) via SMS to verify your mobile number for account creation, login, and fraud prevention under India's DPDP Act 2023."
  },
  AGE_DECLARATION: {
    "1.1": "GoRola is available only to people aged 18 and over. You confirm that the date of birth you enter is correct. We use it once to check eligibility and do not store it; we keep only the date on which you confirmed."
  }
} as const;

export type ConsentPurposeType = keyof typeof CONSENT_NOTICES;

export type ConsentPurpose =
  | "OTP_AUTH"
  | "AGE_DECLARATION"
  | "ORDER_PROCESSING"
  | "MARKETING_COMMS"
  | "ANALYTICS";

export interface CanonicalDisclosures {
  dataCollected: string[];
  thirdParties: string;
  retention: string;
  rights: string;
}

export interface CanonicalNoticeDefinition {
  purpose: ConsentPurpose;
  title: string;
  version: string;
  effectiveDate: string;
  isEssential: boolean;
  summaryText: string;
  plainText: string;
  noticeTriggerLabel: string;
  checkboxLabel: string;
  transparencyPrompt: string;
  disclosures: CanonicalDisclosures;
}

export const CANONICAL_CONSENT_NOTICES: Record<ConsentPurpose, CanonicalNoticeDefinition> = {
  OTP_AUTH: {
    purpose: "OTP_AUTH",
    title: "Authentication & Account Security",
    version: "1.1",
    effectiveDate: "29/09/2026",
    isEssential: true,
    summaryText:
      "GoRola is for people aged 18 and over. We collect your phone number and share it with our secure SMS gateway (Exotel) to send one-time passwords (OTP) and securely authenticate your account sessions under India's DPDP Act 2023. We do not sell your personal data.",
    plainText:
      "We collect your phone number and share it with our secure SMS gateway (Exotel) to send one-time passwords (OTP) and securely authenticate your account sessions under India's DPDP Act 2023. We do not sell your personal data.",
    noticeTriggerLabel: "Authentication Notice",
    checkboxLabel: "I have read and understood this notice",
    transparencyPrompt: "For full details on retention period, data rights, and erasure policies, read the",
    disclosures: {
      dataCollected: ["Phone Number"],
      thirdParties:
        "Your phone number is transmitted securely via our encrypted internal authentication microservices and shared with our authorized SMS Gateway Partners (such as Exotel) solely for automated OTP delivery. We do not sell or monetize your data.",
      retention:
        "Retained for the lifetime of your active account. If you delete your account, this data is permanently erased within 30 days.",
      rights:
        "You have the right to access, rectify, or erase your data. Contact privacy@gorola.in. You also hold the statutory right to lodge a complaint with the Data Protection Board of India (DPBI)."
    }
  },
  AGE_DECLARATION: {
    purpose: "AGE_DECLARATION",
    title: "Age Verification & Eligibility",
    version: "1.1",
    effectiveDate: "29/09/2026",
    isEssential: true,
    summaryText:
      "GoRola is available only to people aged 18 and over. You confirm that the date of birth you enter is correct. We use it once to check eligibility and do not store it; we keep only the date on which you confirmed.",
    plainText:
      "GoRola is available only to people aged 18 and over. You confirm that the date of birth you enter is correct. We use it once to check eligibility and do not store it; we keep only the date on which you confirmed.",
    noticeTriggerLabel: "Age Declaration Notice",
    checkboxLabel: "I confirm that I am at least 18 years of age",
    transparencyPrompt: "For full details on non-storage of raw DOB, 90-day lockout hashing, and data rights, read the",
    disclosures: {
      dataCollected: [
        "Date of Birth — processed ephemerally in-memory during sign-up to verify 18+ eligibility and discarded immediately (zero persistent storage of raw DOB)",
        "Age Confirmation Date — retained as an immutable statutory audit log of your affirmative declaration"
      ],
      thirdParties:
        "None. Age verification is performed strictly in-memory on our secure servers. Your date of birth is never shared with third parties, SMS gateways, or external advertising networks.",
      retention:
        "Raw date of birth is not stored. The timestamp of your age confirmation is retained for the lifetime of your active account.",
      rights:
        "Contact privacy@gorola.in for any data questions. You also hold the statutory right to lodge a complaint with the Data Protection Board of India (DPBI)."
    }
  },
  ORDER_PROCESSING: {
    purpose: "ORDER_PROCESSING",
    title: "Order Fulfillment & Location Services",
    version: "1.0",
    effectiveDate: "29/09/2026",
    isEssential: true,
    summaryText:
      "We collect your delivery address, GPS coordinates, Display Name (if set), and payment details to route orders, fulfill deliveries, and coordinate scheduled on-site service appointments. Data is shared with Ola Maps for navigation, Razorpay for online payments, and assigned store partners, delivery riders, and field service technicians for order fulfillment and scheduled service appointments. Governed by India's DPDP Act 2023.",
    plainText:
      "We collect your delivery address, GPS coordinates, Display Name (if set), and payment details to route orders, fulfill deliveries, and coordinate scheduled on-site service appointments. Data is shared with Ola Maps for navigation, Razorpay for online payments, and assigned store partners, delivery riders, and field service technicians for order fulfillment and scheduled service appointments. Governed by India's DPDP Act 2023.",
    noticeTriggerLabel: "Order Fulfillment Notice",
    checkboxLabel: "I have read and understood this notice",
    transparencyPrompt: "For full details on statutory 7-year GST retention, live GPS handling, and data rights, read the",
    disclosures: {
      dataCollected: [
        "Delivery or Service Address & Landmark Notes",
        "GPS Coordinates (saved address pin, order delivery coordinates, and on-site appointment locations)",
        "Display Name (if you have set one) — shared with your assigned store partner, delivery rider, or field service technician for fulfillment and appointment verification",
        "Transaction & Billing Details (excluding raw credit card data/CVV) — only when online payment is selected"
      ],
      thirdParties:
        "Your delivery address and masked contact details are shared strictly on a need-to-know basis with: Ola Maps (spatial routing and geolocation), Razorpay (secure payment processing — only when online payment is selected), and verified Store Partners, Delivery Riders, and Field Service Technicians solely for physical order fulfillment and scheduled on-site service appointments in compliance with the DPDP Act 2023.",
      retention:
        "Your saved delivery address (including GPS pin) is stored until you delete it or your account. The GPS coordinates copied to each order record are nulled out when you exercise your Right to Erasure; the financial record of the order (totals, payment method) is retained for 7 years under Indian GST and financial accounting law. Live GPS streams used for routing are never persisted — they are processed in-transit by Ola Maps and discarded.",
      rights:
        "You may update your saved addresses at any time. Contact privacy@gorola.in. You also hold the statutory right to lodge a complaint with the Data Protection Board of India (DPBI)."
    }
  },
  MARKETING_COMMS: {
    purpose: "MARKETING_COMMS",
    title: "Promotions & Seasonal Offers",
    version: "1.0",
    effectiveDate: "29/09/2026",
    isEssential: false,
    summaryText:
      "We collect your phone number, Display Name (if set), and purchase categories to send updates on Mussoorie store flash sales, seasonal discounts, and coupons via SMS (Exotel) and app notifications. 100% voluntary.",
    plainText:
      "We collect your phone number, Display Name (if set), and purchase categories to send updates on Mussoorie store flash sales, seasonal discounts, and coupons via SMS (Exotel) and app notifications. 100% voluntary.",
    noticeTriggerLabel: "Promotions Notice",
    checkboxLabel: "Yes, send me seasonal Mussoorie harvest updates and coupons",
    transparencyPrompt: "For full details on 48-hour opt-out scrubbing, data retention, and withdrawal rights, read the",
    disclosures: {
      dataCollected: [
        "Phone Number — used to send SMS promotional messages",
        "Display Name (if you have set one) — used for personalised greetings",
        "Purchase History & Regional Location (Mussoorie cluster) — used to personalise offers"
      ],
      thirdParties:
        "Promotional messages are sent via our authorised SMS gateway partners (Exotel). No data is shared with external advertising networks or third-party marketers. Your phone number is never sold.",
      retention:
        "Processed for marketing until you withdraw your consent. Upon withdrawal, scrubbed from all promotional distributions within 48 hours.",
      rights:
        "Consent for marketing is entirely voluntary. You can withdraw your consent instantly via the Privacy Settings panel at any time without affecting your core service access."
    }
  },
  ANALYTICS: {
    purpose: "ANALYTICS",
    title: "Usage & Performance Analytics",
    version: "1.0",
    effectiveDate: "29/09/2026",
    isEssential: false,
    summaryText:
      "We collect anonymous device telemetry and network latency data to identify bugs, optimize steep hill route planning, and improve app performance in weak signal areas across Mussoorie. Zero personal data is tracked.",
    plainText:
      "We collect anonymous device telemetry and network latency data to identify bugs, optimize steep hill route planning, and improve app performance in weak signal areas across Mussoorie. Zero personal data is tracked.",
    noticeTriggerLabel: "Analytics Notice",
    checkboxLabel: "Allow anonymous telemetry and route performance logging",
    transparencyPrompt: "For full details on 180-day auto-purge schedules, telemetry anonymization, and opt-out rights, read the",
    disclosures: {
      dataCollected: [
        "Device Telemetry (OS version, hardware model, app crash logs)",
        "Network performance data and regional route latency parameters"
      ],
      thirdParties:
        "Processed natively within our secure internal systems. Not mapped to your personal identifier. Handled purely as bulk performance telemetry. Zero PII is tracked.",
      retention:
        "Retained in aggregated logs for a maximum of 180 days, then automatically purged or completely anonymized.",
      rights:
        "Turn off performance tracking at any time via the Privacy dashboard. Disabling this will not restrict any app features or purchases."
    }
  }
};

/**
 * Returns canonical notice text for a given purpose.
 */
export function getCanonicalNoticeText(purpose: ConsentPurpose, version?: string): string {
  // eslint-disable-next-line security/detect-object-injection
  const notice = CANONICAL_CONSENT_NOTICES[purpose];
  if (!notice) {
    throw new Error(`Unknown consent purpose: ${String(purpose)}`);
  }
  if (version && version !== notice.version) {
    throw new Error(`Consent version ${version} not supported for purpose ${purpose}. Current version is ${notice.version}`);
  }
  return notice.plainText;
}

/**
 * Checks whether a given consent purpose is statutory essential (mandatory).
 */
export function isPurposeEssential(purpose: ConsentPurpose): boolean {
  // eslint-disable-next-line security/detect-object-injection
  const notice = CANONICAL_CONSENT_NOTICES[purpose];
  if (!notice) {
    throw new Error(`Unknown consent purpose: ${String(purpose)}`);
  }
  return notice.isEssential;
}
