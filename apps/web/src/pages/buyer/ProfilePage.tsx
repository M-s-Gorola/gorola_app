/* eslint-disable simple-import-sort/imports */
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import gsap from "gsap";
import { Clock, LogOut, MapPin, UserRound } from "lucide-react";
import type { ReactElement } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { TopographicBg } from "@/components/shared/TopographicBg";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long")
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePage(): ReactElement {
  const { name, phone, setBuyerSession, accessToken, refreshToken, userId, clearSession } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: name ?? ""
    }
  });

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".profile-animate", {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out"
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const logoutBuyer = async (): Promise<void> => {
    try {
      if (api !== null && refreshToken !== null && refreshToken.length > 0) {
        await api.post("/api/v1/auth/buyer/logout", { refreshToken });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearSession();
      sessionStorage.removeItem("gorola_subdomain_override");
      navigate("/", { replace: true });
    }
  };

  const onSubmit = async (data: ProfileFormValues): Promise<void> => {
    if (!api) return;
    setLoading(true);
    try {
      const res = await api.put("/api/v1/account/profile", data);
      const updated = res.data.data;
      
      setBuyerSession({
        accessToken: accessToken!,
        refreshToken: refreshToken!,
        userId: userId!,
        name: updated.name,
        phone: updated.phone
      });
      
      toast.success("Profile updated successfully");
    } catch (error: unknown) {
      let msg = "Failed to update profile";
      if (isAxiosError(error)) {
        msg = error.response?.data?.error?.message || msg;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-h-[80vh] px-4 py-10 md:px-10">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl bg-gorola-pine/[0.03]">
         <TopographicBg opacity={0.08} />
      </div>

      <div className="mx-auto max-w-2xl">
        <header className="profile-animate mb-10">
          <h1 className="font-playfair text-4xl text-gorola-charcoal">Your Profile</h1>
          <p className="mt-2 font-dm-sans text-gorola-slate">Manage your account details and preferences.</p>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Personal Info Card */}
          <section className="profile-animate rounded-2xl bg-white/70 p-6 shadow-sm backdrop-blur-md border border-gorola-pine/5">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-gorola-pine/10 p-2 text-gorola-pine">
                <UserRound size={20} />
              </div>
              <h2 className="font-heading text-lg font-semibold text-gorola-charcoal">Personal Info</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gorola-slate" htmlFor="profile-phone">
                  Phone Number
                </label>
                <div className="rounded-lg bg-gorola-slate/5 px-3 py-2 text-gorola-charcoal tabular-nums border border-transparent">
                  {phone}
                </div>
                <p className="text-[11px] text-gorola-slate/60">Phone number cannot be changed.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gorola-slate" htmlFor="profile-name">
                  Full Name
                </label>
                <Input
                  id="profile-name"
                  {...register("name")}
                  className="bg-white/50"
                  placeholder="Enter your name"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full rounded-xl bg-gorola-pine hover:bg-gorola-pine/90 text-white">
                {loading ? "Updating..." : "Update Name"}
              </Button>
            </form>
          </section>

          {/* Quick Links Card */}
          <section className="profile-animate space-y-4">
             <Link 
               to="/account/orders" 
               className="group flex items-center justify-between rounded-2xl bg-white/70 p-6 shadow-sm backdrop-blur-md border border-gorola-pine/5 transition-all hover:bg-gorola-pine/10"
             >
               <div className="flex items-center gap-3">
                 <div className="rounded-full bg-gorola-saffron/10 p-2 text-gorola-saffron">
                   <Clock size={20} />
                 </div>
                 <div>
                   <h3 className="font-heading font-semibold text-gorola-charcoal">Order History</h3>
                   <p className="text-xs text-gorola-slate">View and track your past orders.</p>
                 </div>
               </div>
               <div className="text-gorola-slate transition-transform group-hover:translate-x-1">→</div>
             </Link>

             <Link 
               to="/account/addresses" 
               className="group flex items-center justify-between rounded-2xl bg-white/70 p-6 shadow-sm backdrop-blur-md border border-gorola-pine/5 transition-all hover:bg-gorola-pine/10"
             >
               <div className="flex items-center gap-3">
                 <div className="rounded-full bg-gorola-amber/10 p-2 text-gorola-amber">
                   <MapPin size={20} />
                 </div>
                 <div>
                   <h3 className="font-heading font-semibold text-gorola-charcoal">Saved Addresses</h3>
                   <p className="text-xs text-gorola-slate">Manage your delivery locations.</p>
                 </div>
               </div>
               <div className="text-gorola-slate transition-transform group-hover:translate-x-1">→</div>
             </Link>

             <button
               type="button"
               onClick={logoutBuyer}
               className="group flex w-full items-center justify-between rounded-2xl bg-red-500/10 p-6 shadow-sm backdrop-blur-md border border-red-500/20 transition-all hover:bg-red-500/20 text-red-600 text-left"
             >
               <div className="flex items-center gap-3">
                 <div className="rounded-full bg-red-500/10 p-2 text-red-600">
                   <LogOut size={20} />
                 </div>
                 <div>
                   <h3 className="font-heading font-semibold text-gorola-charcoal">Logout</h3>
                   <p className="text-xs text-red-500/80">Sign out of your account.</p>
                 </div>
               </div>
               <div className="text-red-600 transition-transform group-hover:translate-x-1">→</div>
             </button>
          </section>
        </div>
      </div>
    </div>
  );
}
