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
