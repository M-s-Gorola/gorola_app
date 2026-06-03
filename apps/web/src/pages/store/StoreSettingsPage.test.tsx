import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreSettingsPage } from "./StoreSettingsPage";

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    put: putMock
  }
}));

// Mock toast notification to avoid dependency on real DOM rendering
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function renderStoreSettings(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <StoreSettingsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreSettingsPage Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
  });

  it("renders loading state, fetches settings, and populates store details", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          name: "Mussoorie Pastry Shop",
          description: "Famous local bakery",
          phone: "+919999999999",
          address: "Mall Road, Mussoorie",
          weatherModeDeliveryWindowStart: "30",
          weatherModeDeliveryWindowEnd: "45",
          email: "pastry@gorola.in",
          totpEnabled: false
        }
      }
    });

    renderStoreSettings();

    expect(screen.getByText(/Loading settings/i)).toBeInTheDocument();

    expect(await screen.findByDisplayValue("Mussoorie Pastry Shop")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Famous local bakery")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+919999999999")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mall Road, Mussoorie")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("45")).toBeInTheDocument();
    expect(screen.getByText("pastry@gorola.in")).toBeInTheDocument();
  });

  it("submits edited settings successfully and calls the PUT api", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          name: "Mussoorie Pastry Shop",
          description: "Famous local bakery",
          phone: "+919999999999",
          address: "Mall Road, Mussoorie",
          weatherModeDeliveryWindowStart: "30",
          weatherModeDeliveryWindowEnd: "45",
          email: "pastry@gorola.in",
          totpEnabled: false
        }
      }
    });
    putMock.mockResolvedValueOnce({
      data: { success: true }
    });

    renderStoreSettings();

    const nameInput = await screen.findByDisplayValue("Mussoorie Pastry Shop");
    await user.clear(nameInput);
    await user.type(nameInput, "Mussoorie Sweet Pastries");

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/settings", {
        name: "Mussoorie Sweet Pastries",
        description: "Famous local bakery",
        phone: "+919999999999",
        address: "Mall Road, Mussoorie",
        weatherModeDeliveryWindowStart: "30",
        weatherModeDeliveryWindowEnd: "45"
      });
    });
  });

  it("performs client-side validation on password mismatch", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          name: "Mussoorie Pastry Shop",
          description: "Bakery",
          phone: "+919999999999",
          address: "Mall Road",
          weatherModeDeliveryWindowStart: "",
          weatherModeDeliveryWindowEnd: "",
          email: "pastry@gorola.in",
          totpEnabled: false
        }
      }
    });

    renderStoreSettings();

    await screen.findByDisplayValue("Mussoorie Pastry Shop");

    await user.type(screen.getByLabelText(/^Current Password/i), "OldPassword#123");
    await user.type(screen.getByLabelText(/^New Password/i), "NewPassword#123");
    await user.type(screen.getByLabelText(/^Confirm New Password/i), "DifferentPassword#123");

    await user.click(screen.getByRole("button", { name: /Update Password/i }));

    expect(screen.getByText(/New passwords do not match/i)).toBeInTheDocument();
    expect(putMock).not.toHaveBeenCalled();
  });

  it("submits change password successfully when matching fields are supplied", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          name: "Mussoorie Pastry Shop",
          description: "Bakery",
          phone: "+919999999999",
          address: "Mall Road",
          weatherModeDeliveryWindowStart: "",
          weatherModeDeliveryWindowEnd: "",
          email: "pastry@gorola.in",
          totpEnabled: false
        }
      }
    });
    putMock.mockResolvedValueOnce({
      data: { success: true }
    });

    renderStoreSettings();

    await screen.findByDisplayValue("Mussoorie Pastry Shop");

    await user.type(screen.getByLabelText(/^Current Password/i), "OldPassword#123");
    await user.type(screen.getByLabelText(/^New Password/i), "NewPassword#123");
    await user.type(screen.getByLabelText(/^Confirm New Password/i), "NewPassword#123");

    await user.click(screen.getByRole("button", { name: /Update Password/i }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/auth/store-owner/change-password", {
        currentPassword: "OldPassword#123",
        newPassword: "NewPassword#123"
      });
    });
  });

  it("renders enabled status when TOTP is already enabled", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          name: "Mussoorie Pastry Shop",
          description: "Bakery",
          phone: "+919999999999",
          address: "Mall Road",
          weatherModeDeliveryWindowStart: "",
          weatherModeDeliveryWindowEnd: "",
          email: "pastry@gorola.in",
          totpEnabled: true
        }
      }
    });

    renderStoreSettings();

    await screen.findByDisplayValue("Mussoorie Pastry Shop");

    expect(screen.getByText(/Two-Factor Auth is currently/i)).toBeInTheDocument();
    expect(screen.getByText(/Enabled/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Setup 2FA/i })).not.toBeInTheDocument();
  });

  it("supports the 2FA setup and verification flow when TOTP is disabled", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          name: "Mussoorie Pastry Shop",
          description: "Bakery",
          phone: "+919999999999",
          address: "Mall Road",
          weatherModeDeliveryWindowStart: "",
          weatherModeDeliveryWindowEnd: "",
          email: "pastry@gorola.in",
          totpEnabled: false
        }
      }
    });

    // Mock 2FA Setup
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          secret: "SECRET123KEY",
          qrCodeUri: "otpauth://totp/GoRola:pastry@gorola.in?secret=SECRET123KEY"
        }
      }
    });

    // Mock 2FA Verification
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: { verified: true }
      }
    });

    renderStoreSettings();

    await screen.findByDisplayValue("Mussoorie Pastry Shop");

    expect(screen.getByText(/Disabled/i)).toBeInTheDocument();

    const setupBtn = screen.getByRole("button", { name: /Setup 2FA/i });
    await user.click(setupBtn);

    expect(postMock).toHaveBeenCalledWith("/api/v1/auth/store-owner/setup-2fa", {
      email: "pastry@gorola.in"
    });

    // QR Code and input box should appear
    expect(await screen.findByText("SECRET123KEY")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /qr code/i })).toBeInTheDocument();

    // Type 6 digit confirmation code
    const codeInput = screen.getByLabelText(/Enter 6-digit TOTP Code/i);
    await user.type(codeInput, "123456");

    const verifyBtn = screen.getByRole("button", { name: /Verify and Enable/i });
    await user.click(verifyBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/store-owner/verify-2fa", {
        email: "pastry@gorola.in",
        code: "123456"
      });
    });

    // Should switch status to Enabled
    expect(await screen.findByText(/Two-Factor Auth is currently/i)).toBeInTheDocument();
    expect(screen.getByText(/Enabled/i)).toBeInTheDocument();
  });
});
