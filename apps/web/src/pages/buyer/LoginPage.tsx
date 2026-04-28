import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import gsap from "gsap";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const phoneSchema = z.object({
  localPhone: z
    .string()
    .length(10, "Must be exactly 10 digits after +91")
    .regex(/^\d{10}$/, "Must be exactly 10 digits after +91")
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

type VerifyEnvelope = {
  success?: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    phone?: string;
    userId?: string;
    name?: string | null;
  };
};

function getApiErrorPayload(err: unknown): {
  code?: string;
  message?: string;
  attemptsRemaining?: number;
} {
  const ax = err as AxiosError<{
    error?: { message?: string; code?: string; details?: Record<string, unknown> };
  }>;
  const errBody = ax.response?.data?.error;
  if (typeof errBody !== "object" || errBody === null) {
    return {};
  }
  let attemptsRemaining: number | undefined;
  if (
    typeof errBody.details === "object" &&
    errBody.details !== null &&
    "attemptsRemaining" in errBody.details &&
    typeof (errBody.details as { attemptsRemaining?: unknown }).attemptsRemaining === "number"
  ) {
    attemptsRemaining = (errBody.details as { attemptsRemaining: number }).attemptsRemaining;
  }
  return {
    ...(typeof errBody.code === "string" ? { code: errBody.code } : {}),
    ...(typeof errBody.message === "string" ? { message: errBody.message } : {}),
    ...(attemptsRemaining !== undefined ? { attemptsRemaining } : {})
  };
}

const OTP_SLOTS = [0, 1, 2, 3, 4, 5] as const;

function displayCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const setBuyerSession = useAuthStore((s) => s.setBuyerSession);

  const shellRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"phone" | "otp">("phone");

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [otpNonce, bumpOtpNonce] = useReducer((n: number) => n + 1, 0);
  const [ttlRemaining, setTtlRemaining] = useState(300);

  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const hookForm = useForm<PhoneFormValues>({
    defaultValues: { localPhone: "" },
    resolver: zodResolver(phoneSchema),
    mode: "onSubmit"
  });

  useEffect(() => {
    if (step !== "otp") return;
    setTtlRemaining(300);
  }, [otpNonce, step]);

  useEffect(() => {
    if (step !== "otp") return undefined;
    if (ttlRemaining <= 0) return undefined;
    const id = window.setInterval(() => {
      setTtlRemaining((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, otpNonce, ttlRemaining > 0]);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return undefined;
    if (!shellRef.current) return undefined;
    const el = shellRef.current;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0, y: 10 },
      { duration: 0.35, ease: "power2.out", opacity: 1, y: 0 }
    );
    return () => undefined;
  }, [step]);

  useEffect(() => {
    if (step !== "otp") return undefined;
    const active = otpInputRefs.current[0];
    window.requestAnimationFrame(() => active?.focus());
    return () => undefined;
  }, [step, otpNonce]);

  const submitPhone = hookForm.handleSubmit(async (vals) => {
    setPhoneError(null);
    if (api === null) {
      setPhoneError("API not configured.");
      return;
    }
    const e164 = `+91${vals.localPhone}`;
    setSendLoading(true);
    try {
      await api.post("/api/v1/auth/buyer/send-otp", { phone: e164 });
      setPhoneE164(e164);
      setDigits(Array.from({ length: 6 }, () => ""));
      setOtpError(null);
      bumpOtpNonce();
      setStep("otp");
    } catch (e) {
      const st = getApiErrorPayload(e);
      const msg =
        st.code === "RATE_LIMITED"
          ? (st.message ?? "Too many attempts — try again later.")
          : (st.message ?? "Could not send OTP.");
      setPhoneError(msg);
    } finally {
      setSendLoading(false);
    }
  });

  function updateDigit(at: number, ch: string): void {
    if (!/^[0-9]?$/.test(ch)) return;
    const nextDigit = ch === "" ? "" : ch.slice(-1);
    setDigits((prev) => {
      const copy = [...prev];
      copy[at] = nextDigit;
      return copy;
    });
    setOtpError(null);
    if (nextDigit !== "" && at < 5) {
      otpInputRefs.current[at + 1]?.focus();
    }
  }

  const onDigitChange = useCallback((index: number) => {
    return (e: ChangeEvent<HTMLInputElement>): void => {
      const v = e.target.value.length === 0 ? "" : e.target.value.slice(-1);
      updateDigit(index, v);
    };
  }, []);

  function onDigitKeyDown(index: number) {
    return (e: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Backspace" && digits[index] === "" && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
      if (e.key === "Enter") {
        if (digits.join("").length === 6) {
          void submitOtp();
        }
      }
    };
  }

  async function submitOtp(): Promise<void> {
    if (!phoneE164) return;
    const code = digits.join("");
    if (code.length !== 6 || !/^\d{6}$/.test(code)) return;
    if (api === null) {
      setOtpError("API not configured.");
      return;
    }

    setVerifyLoading(true);
    setOtpError(null);
    try {
      const res = await api.post<VerifyEnvelope>("/api/v1/auth/buyer/verify-otp", {
        otp: code,
        phone: phoneE164
      });

      const body = res.data as VerifyEnvelope;
      const data = body.success === true && body.data !== undefined ? body.data : undefined;
      const accessToken = data?.accessToken;
      const refreshToken = data?.refreshToken;
      const userId = data?.userId;
      if (
        data === undefined ||
        typeof accessToken !== "string" ||
        typeof refreshToken !== "string" ||
        typeof userId !== "string"
      ) {
        setOtpError("Unexpected response.");
        return;
      }

      setBuyerSession({
        accessToken,
        name: data.name ?? null,
        phone: data.phone ?? phoneE164,
        refreshToken,
        userId
      });

      const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      let target = "/";
      if (typeof fromPath === "string" && fromPath !== "" && fromPath !== "/login") {
        target = fromPath;
      }
      navigate(target, { replace: true });
    } catch (e) {
      const payload = getApiErrorPayload(e);
      if (
        payload.code === "UNAUTHORIZED" &&
        typeof payload.attemptsRemaining === "number" &&
        payload.message === "Invalid OTP"
      ) {
        setOtpError(`${payload.attemptsRemaining} attempts left`);
      } else if (payload.code === "RATE_LIMITED") {
        setOtpError(payload.message ?? "Verification locked.");
      } else if (payload.message !== undefined && payload.message.length > 0) {
        setOtpError(payload.message);
      } else {
        setOtpError("Verification failed.");
      }
    } finally {
      setVerifyLoading(false);
    }
  }

  async function resend(): Promise<void> {
    if (!phoneE164 || ttlRemaining > 0 || api === null) return;
    setSendLoading(true);
    setOtpError(null);
    try {
      await api.post("/api/v1/auth/buyer/send-otp", { phone: phoneE164 });
      setDigits(Array.from({ length: 6 }, () => ""));
      bumpOtpNonce();
    } catch (e) {
      const payload = getApiErrorPayload(e);
      setOtpError(
        payload.code === "RATE_LIMITED"
          ? (payload.message ?? "Too many attempts.")
          : (payload.message ?? "Could not resend.")
      );
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-6 px-4 py-10">
      <div ref={shellRef}>
        <h1 className="font-heading text-2xl tracking-tight text-gorola-charcoal">Welcome back</h1>

        {step === "phone" ? (
          <form className="mt-6 flex flex-col gap-4" onSubmit={submitPhone}>
            <div className="flex flex-col gap-2">
              <label className="text-sm leading-none font-medium" htmlFor="buyer-phone">
                Phone number
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0 text-sm tabular-nums">+91</span>
                <Input
                  id="buyer-phone"
                  {...hookForm.register("localPhone")}
                  aria-invalid={hookForm.formState.errors.localPhone !== undefined ? true : undefined}
                  aria-label="Phone number"
                  autoComplete="tel-national"
                  inputMode="numeric"
                  placeholder="XXXXXXXXXX"
                />
              </div>
              {hookForm.formState.errors.localPhone !== undefined ? (
                <p className="text-destructive text-sm" role="alert">
                  {hookForm.formState.errors.localPhone.message?.includes("10")
                    ? "Must be exactly 10 digits after +91"
                    : hookForm.formState.errors.localPhone.message}
                </p>
              ) : null}
              {phoneError !== null ? (
                <p className="text-destructive text-sm" role="alert">
                  {phoneError}
                </p>
              ) : null}
            </div>
            <Button
              className="w-full rounded-full"
              disabled={sendLoading || hookForm.formState.isSubmitting}
              type="submit"
            >
              {sendLoading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <p className="font-medium text-gorola-charcoal">Enter OTP</p>
            <p className="text-muted-foreground text-sm">
              Sent to{" "}
              <span className="text-gorola-charcoal">
                +91{(phoneE164 ?? "").slice(-10)}
              </span>
            </p>
            <p aria-live="polite" className="tabular-nums text-sm">
              Expires in {ttlRemaining <= 0 ? "0:00" : displayCountdown(ttlRemaining)}
            </p>

            <fieldset className="flex flex-row justify-between gap-1">
              <legend className="sr-only">Six-digit OTP</legend>
              {OTP_SLOTS.map((i) => (
                <input
                  aria-label={`Digit ${i + 1}`}
                  aria-invalid={otpError !== null ? true : undefined}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  className="border-input focus-visible:ring-ring h-11 w-full rounded-md border bg-transparent py-2 text-center text-lg shadow-sm tabular-nums focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  data-testid={`otp-digit-${i}`}
                  inputMode="numeric"
                  key={i}
                  maxLength={1}
                  ref={(el): void => {
                    otpInputRefs.current[i] = el;
                  }}
                  role="spinbutton"
                  type="text"
                  value={digits[i]}
                  onChange={onDigitChange(i)}
                  onKeyDown={onDigitKeyDown(i)}
                />
              ))}
            </fieldset>

            <div className="flex flex-row items-center justify-between gap-2">
              <Button
                disabled={verifyLoading || digits.join("").length !== 6}
                onClick={(): void => {
                  void submitOtp();
                }}
                type="button"
                variant="default"
              >
                {verifyLoading ? "Verifying..." : "Verify"}
              </Button>
              <Button
                disabled={sendLoading || ttlRemaining > 0}
                onClick={(): void => {
                  void resend();
                }}
                type="button"
                variant="outline"
              >
                Resend OTP
              </Button>
            </div>
            {otpError !== null ? (
              <p className="text-destructive text-sm" role="alert">
                {otpError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
