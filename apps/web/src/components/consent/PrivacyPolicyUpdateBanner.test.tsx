import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

import { PrivacyPolicyUpdateBanner } from "./PrivacyPolicyUpdateBanner";

describe("PrivacyPolicyUpdateBanner - Edge & Special Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      userId: null,
      role: null,
      privacyPolicyVersionAccepted: null
    });
  });

  it("Edge case 1: does not render when guest has matching current version 1.0", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="1.0" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("privacy-policy-update-banner")).not.toBeInTheDocument();
  });

  it("Guest path: renders when guest visits on bumped version 2.0 and accepts", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="2.0" />
      </MemoryRouter>
    );

    expect(screen.getByTestId("privacy-policy-update-banner")).toBeInTheDocument();
    expect(screen.getByText(/v2.0/i)).toBeInTheDocument();

    const acceptBtn = screen.getByTestId("accept-policy-btn");
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("privacy-policy-update-banner")).not.toBeInTheDocument();
    });

    expect(localStorage.getItem("gorola_guest_policy_version")).toBe("2.0");
  });

  it("Edge case 2: does not render when user has accepted the exact current version", () => {
    useAuthStore.setState({
      accessToken: "valid-token",
      role: "BUYER",
      userId: "u1",
      privacyPolicyVersionAccepted: "1.0"
    });

    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="1.0" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("privacy-policy-update-banner")).not.toBeInTheDocument();
  });

  it("Edge case 3: does not render when user has a higher/newer version", () => {
    useAuthStore.setState({
      accessToken: "valid-token",
      role: "BUYER",
      userId: "u1",
      privacyPolicyVersionAccepted: "2.1"
    });

    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="2.0" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("privacy-policy-update-banner")).not.toBeInTheDocument();
  });

  it("Edge case 4: does not render for non-BUYER roles (e.g. STORE_OWNER, ADMIN, RIDER)", () => {
    useAuthStore.setState({
      accessToken: "store-token",
      role: "STORE_OWNER",
      userId: "so1",
      privacyPolicyVersionAccepted: "0.9"
    });

    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="1.0" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("privacy-policy-update-banner")).not.toBeInTheDocument();
  });

  it("Happy path: renders when user version is older and accepts successfully", async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api!, "post").mockResolvedValueOnce({
      data: {
        success: true,
        data: { accepted: true, version: "2.0" }
      }
    });

    useAuthStore.setState({
      accessToken: "valid-token",
      role: "BUYER",
      userId: "u1",
      privacyPolicyVersionAccepted: "1.0"
    });

    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="2.0" />
      </MemoryRouter>
    );

    expect(screen.getByTestId("privacy-policy-update-banner")).toBeInTheDocument();
    expect(screen.getByText(/We've updated our/i)).toBeInTheDocument();
    expect(screen.getByText(/v2.0/i)).toBeInTheDocument();

    const reviewLink = screen.getByRole("link", { name: /review policy/i });
    expect(reviewLink).toHaveAttribute("href", "/privacy");

    const acceptBtn = screen.getByTestId("accept-policy-btn");
    await user.click(acceptBtn);

    expect(postSpy).toHaveBeenCalledWith("/api/v1/user/accept-policy", { version: "2.0" });

    await waitFor(() => {
      expect(screen.queryByTestId("privacy-policy-update-banner")).not.toBeInTheDocument();
    });

    expect(useAuthStore.getState().privacyPolicyVersionAccepted).toBe("2.0");
  });

  it("Edge case 5: handles API failure gracefully without crashing and allows retry", async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api!, "post").mockRejectedValueOnce(new Error("Network failure"));

    useAuthStore.setState({
      accessToken: "valid-token",
      role: "BUYER",
      userId: "u1",
      privacyPolicyVersionAccepted: "1.0"
    });

    render(
      <MemoryRouter>
        <PrivacyPolicyUpdateBanner currentVersion="2.0" />
      </MemoryRouter>
    );

    const acceptBtn = screen.getByTestId("accept-policy-btn");
    await user.click(acceptBtn);

    expect(postSpy).toHaveBeenCalled();
    // Banner remains visible so user can retry
    expect(screen.getByTestId("privacy-policy-update-banner")).toBeInTheDocument();
  });
});
