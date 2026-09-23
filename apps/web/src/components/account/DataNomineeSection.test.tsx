import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { DataNomineeSection } from "./DataNomineeSection";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe("DataNomineeSection", () => {
  it("renders Data Nominee section with DPDP Act Sec 14 badge and input fields", async () => {
    vi.mocked(api!.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: { nomineeName: null, nomineeContact: null, nomineeRelationship: null }
      }
    });

    render(<DataNomineeSection />);

    expect(screen.getByTestId("data-nominee-card")).toBeInTheDocument();
    expect(screen.getByText("Data Nominee")).toBeInTheDocument();
    expect(screen.getByText("DPDP Act Sec 14")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("nominee-name-input")).toBeInTheDocument();
      expect(screen.getByTestId("nominee-contact-input")).toBeInTheDocument();
      expect(screen.getByTestId("nominee-relationship-input")).toBeInTheDocument();
      expect(screen.getByTestId("save-nominee-btn")).toBeInTheDocument();
    });
  });

  it("submits nominee details via PUT /api/v1/user/nominee", async () => {
    vi.mocked(api!.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: { nomineeName: null, nomineeContact: null, nomineeRelationship: null }
      }
    });

    vi.mocked(api!.put).mockResolvedValueOnce({
      data: {
        success: true,
        data: { nomineeName: "Aarav Sharma", nomineeContact: "+919876543210", nomineeRelationship: "Spouse" }
      }
    });

    render(<DataNomineeSection />);

    await waitFor(() => {
      expect(screen.getByTestId("nominee-name-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("nominee-name-input"), { target: { value: "Aarav Sharma" } });
    fireEvent.change(screen.getByTestId("nominee-contact-input"), { target: { value: "+919876543210" } });
    fireEvent.change(screen.getByTestId("nominee-relationship-input"), { target: { value: "Spouse" } });

    fireEvent.click(screen.getByTestId("save-nominee-btn"));

    await waitFor(() => {
      expect(api!.put).toHaveBeenCalledWith("/api/v1/user/nominee", {
        nomineeName: "Aarav Sharma",
        nomineeContact: "+919876543210",
        nomineeRelationship: "Spouse"
      });
    });
  });
});
