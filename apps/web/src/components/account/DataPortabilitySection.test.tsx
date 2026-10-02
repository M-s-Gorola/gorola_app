import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { DataPortabilitySection } from "./DataPortabilitySection";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe("DataPortabilitySection", () => {
  it("renders Data Portability card and button with DPDP Act Sec 11 badge", () => {
    render(<DataPortabilitySection />);

    expect(screen.getByTestId("data-portability-card")).toBeInTheDocument();
    expect(screen.getByText("Download My Data")).toBeInTheDocument();
    expect(screen.getByText("DPDP Act Sec 11")).toBeInTheDocument();
    expect(screen.getByTestId("download-my-data-btn")).toBeInTheDocument();
  });

  it("fetches /api/v1/user/my-data and triggers download when button is clicked", async () => {
    const mockData = {
      profile: { id: "u1", name: "Test User", phone: "+919876543210" },
      addresses: [],
      orders: [],
      consents: []
    };

    vi.mocked(api!.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: mockData
      }
    });

    // Mock URL.createObjectURL and revokeObjectURL
    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(<DataPortabilitySection />);

    const downloadBtn = screen.getByTestId("download-my-data-btn");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(api!.get).toHaveBeenCalledWith("/api/v1/user/my-data");
      expect(createObjectURLMock).toHaveBeenCalled();
    });
  });
});
