import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
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

const adminLoginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Must be a valid email"),
  password: z.string().min(1, "Password is required")
});

type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;

type LoginEnvelope = {
  success?: boolean;
  data?: {
    requiresTwoFactor?: boolean;
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
  };
};

function decodeJwt(token: string): { sub: string; role: string } | null {
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

export function AdminLoginPage(): ReactElement {
  const navigate = useNavigate();
  const setAdminSession = useAuthStore((s) => s.setAdminSession);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AdminLoginFormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(adminLoginSchema),
    mode: "onSubmit"
  });

  const onSubmit = handleSubmit(async (vals) => {
    setErrorMessage(null);
    if (!api) {
      setErrorMessage("API not configured.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<LoginEnvelope>("/api/v1/auth/admin/login", {
        email: vals.email,
        password: vals.password
      });

      const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
      const body = res.data;
      if (body.success === true) {
        if (body.data?.requiresTwoFactor === true) {
          navigate(getScopedPath("/admin/2fa", "admin", isSubdomainMode), { state: { email: vals.email, password: vals.password } });
        } else if (body.data?.accessToken && body.data?.refreshToken) {
          const decoded = decodeJwt(body.data.accessToken);
          if (decoded && decoded.sub) {
            setAdminSession({
              accessToken: body.data.accessToken,
              refreshToken: body.data.refreshToken,
              userId: decoded.sub,
              twoFactorVerified: true
            });
            navigate(getScopedPath("/admin/dashboard", "admin", isSubdomainMode), { replace: true });
          } else {
            setErrorMessage("Invalid session token received.");
          }
        } else {
          setErrorMessage("Unexpected response from server.");
        }
      } else {
        setErrorMessage("Unexpected response from server.");
      }
    } catch (err) {
      const ax = err as AxiosError<{
        error?: { message?: string; code?: string };
      }>;
      const errorMsg = ax.response?.data?.error?.message ?? "";
      const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

      if (ax.response?.status === 401 && errorMsg.includes("2FA is not configured")) {
        navigate(getScopedPath("/admin/setup-2fa", "admin", isSubdomainMode), { state: { email: vals.email } });
      } else if (ax.response?.status === 401) {
        setErrorMessage("Invalid credentials");
      } else {
        setErrorMessage(errorMsg || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl tracking-tight text-gorola-charcoal">System Admin Sign In</h1>
        <p className="text-muted-foreground text-sm">Sign in to manage the GoRola platform</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium leading-none" htmlFor="email">
            Email address
          </label>
          <Input
            id="email"
            type="email"
            placeholder="admin@gorola.com"
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
          <label className="text-sm font-medium leading-none" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
            aria-invalid={errors.password ? "true" : undefined}
          />
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

        <Button className="w-full rounded-full" disabled={loading} type="submit">
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </div>
  );
}
