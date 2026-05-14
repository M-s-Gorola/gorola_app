import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MockInstance } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

import { SavedAddressesPage } from "./SavedAddressesPage";

vi.mock("@/components/buyer/AddressMapPicker", () => ({
  AddressMapPicker: () => <div data-testid="address-map-picker">Map Mock</div>,
  MUSSOORIE_AREA_CENTER: { lat: 30.45, lng: 78.08 }
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe("SavedAddressesPage", () => {
  let apiGetSpy: MockInstance;
  let apiPostSpy: MockInstance;
  let apiPutSpy: MockInstance;
  let apiDeleteSpy: MockInstance;

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ isBootstrapPending: false });
    
    // Radix UI leaves pointer-events: none on body if forcefully unmounted
    document.body.style.pointerEvents = 'auto';

    apiGetSpy = vi.spyOn(api!, "get").mockResolvedValue({
      data: {
        data: {
          addresses: [
            {
              id: "addr1",
              label: "Home",
              landmarkDescription: "Near the big clock",
              flatRoom: "101",
              isDefault: true,
              lat: "30.45",
              lng: "78.08"
            },
            {
              id: "addr2",
              label: "Work",
              landmarkDescription: "Office building 10 chars",
              flatRoom: null,
              isDefault: false,
              lat: null,
              lng: null
            }
          ]
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    apiPostSpy = vi.spyOn(api!, "post").mockResolvedValue({
      data: { data: { id: "new-addr" } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    apiPutSpy = vi.spyOn(api!, "put").mockResolvedValue({
      data: { data: { id: "updated" } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    apiDeleteSpy = vi.spyOn(api!, "delete").mockResolvedValue({
      data: { data: { deleted: true } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <SavedAddressesPage />
      </QueryClientProvider>
    );

  it("renders the list of saved addresses", async () => {
    renderComponent();

    expect(screen.getByText("Saved Addresses")).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });
    expect(apiGetSpy).toHaveBeenCalledWith("/api/v1/addresses");

    expect(screen.getByText("Near the big clock")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("DEFAULT")).toBeInTheDocument();
  });

  it("opens add form and submits a new address", async () => {
    renderComponent();

    const addBtn = await screen.findByRole("button", { name: /Add New/i });
    fireEvent.click(addBtn);

    const dialogTitle = await screen.findByText("Add New Address");
    expect(dialogTitle).toBeInTheDocument();

    const labelInput = screen.getByPlaceholderText("Home");
    const landmarkInput = screen.getByPlaceholderText("E.g. — near the red gate, behind Hotel Padmini");
    const saveBtn = screen.getByRole("button", { name: "Save Address" });

    fireEvent.change(labelInput, { target: { value: "Vacation" } });
    fireEvent.change(landmarkInput, { target: { value: "Near the beach 123" } });

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith("/api/v1/addresses", expect.objectContaining({
        label: "Vacation",
        landmarkDescription: "Near the beach 123",
        isDefault: false
      }));
    });
  });

  it("opens edit form and updates an existing address", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByRole("button", { name: /Open menu/i });
    fireEvent.pointerDown(menuBtns[0]!);
    fireEvent.click(menuBtns[0]!); // Click on first address's menu

    const editBtn = await screen.findByRole("menuitem", { name: /Edit/i });
    fireEvent.click(editBtn);

    const dialogTitle = await screen.findByText("Edit Address");
    expect(dialogTitle).toBeInTheDocument();

    const labelInput = screen.getByDisplayValue("Home");
    fireEvent.change(labelInput, { target: { value: "Primary Home" } });

    const saveBtn = screen.getByRole("button", { name: "Save Address" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPutSpy).toHaveBeenCalledWith("/api/v1/addresses/addr1", expect.objectContaining({
        label: "Primary Home"
      }));
    });
  });

  it("deletes an address", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByRole("button", { name: /Open menu/i });
    fireEvent.pointerDown(menuBtns[0]!);
    fireEvent.click(menuBtns[0]!); // Click on first address's menu

    const deleteBtn = await screen.findByRole("menuitem", { name: /Delete/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(apiDeleteSpy).toHaveBeenCalledWith("/api/v1/addresses/addr1");
    });
  });

  it("sets an address as default", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Work")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByRole("button", { name: /Open menu/i });
    fireEvent.pointerDown(menuBtns[1]!);
    fireEvent.click(menuBtns[1]!); // Click on second address's menu (Work)

    const defaultBtn = await screen.findByRole("menuitem", { name: /Set as Default/i });
    fireEvent.click(defaultBtn);

    await waitFor(() => {
      expect(apiPutSpy).toHaveBeenCalledWith("/api/v1/addresses/addr2/default");
    });
  });
});
