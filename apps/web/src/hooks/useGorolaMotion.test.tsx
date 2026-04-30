import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { App } from "@/App";
import { lenis } from "@/lib/lenis";

vi.mock("@/lib/gsap", () => ({
  initGorolaGsapOnce: vi.fn(),
  linkLenisToGsapTicker: () => () => {}
}));

it("creates Lenis on mount and clears singleton on unmount", async () => {
  const { unmount } = render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(lenis).not.toBeNull();
  });
  unmount();
  await waitFor(() => {
    expect(lenis).toBeNull();
  });
});
