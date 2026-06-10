import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

const riderLoginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Must be a valid email"),
  password: z.string().min(1, "Password is required")
});

type RiderLoginFormValues = z.infer<typeof riderLoginSchema>;

type LoginEnvelope = {
  success?: boolean;
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

function decodeJwt(token: string): { sub: string; storeId: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1]!;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function RiderLoginPage(): ReactElement {
  const navigate = useNavigate();
  const setRiderSession = useAuthStore((s) => s.setRiderSession);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RiderLoginFormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(riderLoginSchema),
    mode: "onSubmit"
  });

  const onSubmit = onSubmitWrapper();

  function onSubmitWrapper() {
    return handleSubmit(async (vals) => {
      setErrorMessage(null);
      if (!api) {
        setErrorMessage("API not configured.");
        return;
      }

      setLoading(true);
      try {
        const res = await api.post<LoginEnvelope>("/api/v1/rider/auth/login", {
          email: vals.email,
          password: vals.password
        });

        const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
        const body = res.data;
        if (body.success === true && body.data?.accessToken && body.data?.refreshToken) {
          const decoded = decodeJwt(body.data.accessToken);
          if (decoded && decoded.sub && decoded.storeId) {
            setRiderSession({
              accessToken: body.data.accessToken,
              refreshToken: body.data.refreshToken,
              userId: decoded.sub,
              storeId: decoded.storeId
            });
            navigate(getScopedPath("/rider/orders", "rider", isSubdomainMode), { replace: true });
          } else {
            setErrorMessage("Invalid session token received.");
          }
        } else {
          setErrorMessage("Unexpected response from server.");
        }
      } catch (err) {
        const ax = err as AxiosError<{
          error?: { message?: string; code?: string };
        }>;
        const msg = ax.response?.data?.error?.message ?? "Invalid credentials";
        setErrorMessage(msg);
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl tracking-tight text-gorola-charcoal">Rider Partner Portal</h1>
        <p className="text-muted-foreground text-sm">Sign in to start your shifts</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium leading-none" htmlFor="rider-email">
            Email address
          </label>
          <Input
            id="rider-email"
            type="email"
            placeholder="name@rider.com"
            autoComplete="email"
            {...register("email")}
            aria-invalid={errors.email ? "true" : undefined}
          />
          {errors.email && (
            <p className="text-destructive text-xs" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium leading-none" htmlFor="rider-password">
            Password
          </label>
          <div className="relative">
            <Input
              id="rider-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-10"
              {...register("password")}
              aria-invalid={errors.password ? "true" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={showPassword ? "Hide" : "Show"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-destructive text-xs" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-destructive text-sm font-medium text-center" role="alert">
            {errorMessage}
          </p>
        )}

        <Button
          className="w-full rounded-full bg-gorola-pine hover:bg-gorola-pine-dark text-white font-medium"
          disabled={loading}
          type="submit"
        >
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </div>
  );
}
