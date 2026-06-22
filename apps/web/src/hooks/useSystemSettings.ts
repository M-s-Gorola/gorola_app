import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export type SystemSettingsMap = {
  DELIVERY_CHARGE: string;
  SERVICE_CHARGE: string;
};

export function useSystemSettings() {
  return useQuery<SystemSettingsMap>({
    queryKey: ["settings"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: SystemSettingsMap }>("/api/v1/settings");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: {
      DELIVERY_CHARGE: "30",
      SERVICE_CHARGE: "0"
    }
  });
}

export function useSystemSettingsSocket() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const baseURL = import.meta.env.VITE_API_BASE_URL || "";
    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    socket.on("system_settings_updated", (newSettingsMap: SystemSettingsMap) => {
      queryClient.setQueryData(["settings"], newSettingsMap);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
