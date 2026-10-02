import { defineRailway, project, service } from "railway/iac";

export const partial = "api";

export default defineRailway(() => {
  const api = service("api", {
    build: {
      builder: "NIXPACKS",
      buildCommand:
        "pnpm install --frozen-lockfile && pnpm --filter @gorola/shared build && pnpm --filter @gorola/api run build",
    },
    deploy: {
      startCommand: "pnpm --filter @gorola/api start",
      restartPolicyType: "ON_FAILURE",
      healthcheckPath: "/health",
    },
  });

  return project("gorola", {
    resources: [api],
  });
});
