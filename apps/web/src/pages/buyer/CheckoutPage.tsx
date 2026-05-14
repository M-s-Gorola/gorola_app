import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AddressMapPicker,
  type MapCoordinates,
  MUSSOORIE_AREA_CENTER} from "@/components/buyer/AddressMapPicker";
import { api } from "@/lib/api";
import { syncBuyerCartFromServer } from "@/lib/buyer-cart-sync";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

const DELIVERY_FEE = 30;

type AddrRow = {
  id: string;
  label: string;
  landmarkDescription: string;
};

export function CheckoutPage(): ReactElement {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const lines = useCartStore((s) => s.lines);
  const discountCode = useCartStore((s) => s.discountCode);
  const discountSavedAmount = useCartStore((s) => s.discountSavedAmount);
  const clearCart = useCartStore((s) => s.clear);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);

  const addressesQuery = useQuery({
    enabled: !isBootstrapPending,
    queryFn: async () => {
      const response = await api!.get<{ data?: { addresses: AddrRow[] } }>(
        "/api/v1/addresses"
      );
      return response.data.data?.addresses ?? [];
    },
    queryKey: ["buyer-addresses"]
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [deliveryChoice, setDeliveryChoice] = useState<string>("new");
  const [landmarkInput, setLandmarkInput] = useState("");
  const [flatRoom, setFlatRoom] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [paymentMethod] = useState<"COD" | "UPI" | "CARD">("COD");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [addressDefaultSet, setAddressDefaultSet] = useState(false);
  const [mapCoords, setMapCoords] = useState<MapCoordinates | null>(null);

  const addressesList = addressesQuery.data ?? [];

  const handleMapCoordinates = useCallback((coords: MapCoordinates) => {
    setMapCoords(coords);
  }, []);

  useEffect(() => {
    if (accessToken === null) {
      return;
    }
    // Optimization: If we already have items in the SPA state, we don't need to sync 
    // immediately on mount unless we want to force a refresh. This prevents race 
    // conditions where a stale "empty" server response wipes a non-empty local cart.
    if (lines.length > 0) {
      return;
    }
    void syncBuyerCartFromServer().catch(() => {
      /* keep local lines if cart fetch fails */
    });
  }, [accessToken, lines.length]);

  useEffect(() => {
    if (addressDefaultSet) {
      return;
    }
    if (!addressesQuery.isSuccess) {
      return;
    }
    if (addressesList.length > 0) {
      setDeliveryChoice(addressesList[0]!.id);
      setAddressDefaultSet(true);
    }
  }, [addressDefaultSet, addressesList, addressesQuery.isSuccess]);

  const subtotal = useMemo(
    () => lines.reduce((acc, line) => acc + (line.unitPrice ?? 0) * line.quantity, 0),
    [lines]
  );
  const total = Math.max(subtotal + DELIVERY_FEE - discountSavedAmount, 0);

  /** Sync guard — double-clicks can fire two POSTs before mutation pending state updates in the DOM. */
  const placeOrderInFlightRef = useRef(false);

  const queryClient = useQueryClient();
  const placeMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      // ... (existing code inside mutationFn)
      if (api === null) {
        throw new Error("Cannot place order offline");
      }
      const payment = paymentMethod;

      let body: Record<string, unknown>;
      if (deliveryChoice === "new") {
        body = {
          addressMode: "new",
          landmarkDescription: landmarkInput.trim(),
          paymentMethod: payment
        };
        if (discountCode.trim().length > 0) {
          body.discountCode = discountCode.trim();
        }

        const room = flatRoom.trim();
        if (room.length > 0) {
          body.flatRoom = room;
        }

        if (saveAddress === true) {
          const labelTrim = addressLabel.trim();
          body.saveAddress = true;
          body.addressLabel = labelTrim.length > 0 ? labelTrim : "Saved";
        }
        if (mapCoords !== null) {
          body.lat = mapCoords.lat;
          body.lng = mapCoords.lng;
        }
      } else {
        body = {
          addressId: deliveryChoice,
          addressMode: "saved",
          paymentMethod: payment
        };
        if (discountCode.trim().length > 0) {
          body.discountCode = discountCode.trim();
        }
      }

      const res = await api.post<{ data?: { id: string } }>(`/api/v1/orders`, body);
      const id = res.data?.data?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("Missing order id");
      }
      return id;
    },
    onSuccess: (orderId) => {
      clearCart();
      // Ensure UI updates instantly by clearing the stale cache for orders and addresses
      void queryClient.invalidateQueries({ queryKey: ["orders", "history"] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] });
      
      navigate(`/orders/${orderId}`);
    }
  });

  const placeOrderErrorDetail = useMemo(() => {
    const err = placeMutation.error;
    if (err === null) {
      return null;
    }
    if (isAxiosError(err)) {
      const body = err.response?.data;
      const msg =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error?: { message?: unknown } }).error?.message === "string"
          ? (body as { error: { message: string } }).error.message
          : null;
      return msg ?? (err.response?.status === 500 ? "Something went wrong on our side — please try once more." : null);
    }
    return err instanceof Error ? err.message : null;
  }, [placeMutation.error]);

  function handleContinueFromAddress(): void {
    setStep1Error(null);

    if (deliveryChoice === "new") {
      const trimmed = landmarkInput.trim();
      if (trimmed.length < 10) {
        setStep1Error("Landmark must be at least 10 characters so drivers can find you.");
        return;
      }
      if (saveAddress && addressLabel.trim().length === 0) {
        setStep1Error("Add a label for this saved address, or disable “Save”.");
        return;
      }
    }

    setStep(2);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="font-playfair text-3xl text-gorola-charcoal">Checkout</h1>

      {step === 1 ? (
        <section aria-label="Delivery step" className="space-y-4">
          <h2 className="font-playfair text-2xl text-gorola-charcoal">Address</h2>

          {addressesQuery.isFetching ? (
            <p className="font-dm-sans text-sm text-gorola-slate">Loading addresses…</p>
          ) : (
            <>
              <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Deliver to:</p>

              <div className="space-y-2">
                {addressesList.map((a) => (
                  <label key={a.id} className="flex items-start gap-2 font-dm-sans text-sm text-gorola-charcoal">
                    <input
                      aria-label={a.label}
                      checked={deliveryChoice === a.id}
                      name="delivery-address-group"
                      onChange={() => {
                        setMapCoords(null);
                        setDeliveryChoice(a.id);
                      }}
                      type="radio"
                      value={a.id}
                    />
                    <span>
                      <span className="font-semibold">{a.label}</span>
                      <span className="block text-xs text-gorola-slate">{a.landmarkDescription}</span>
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
                  <input
                    aria-label="Deliver to new location"
                    checked={deliveryChoice === "new"}
                    name="delivery-address-group"
                    onChange={() => {
                      setDeliveryChoice("new");
                    }}
                    type="radio"
                    value="new"
                  />
                  Deliver to new location
                </label>
              </div>

              {deliveryChoice === "new" ? (
                <div className="space-y-3 rounded-xl border border-gorola-pine/15 p-4">
                  <label className="block space-y-1">
                    <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">
                      Landmark (required)
                    </span>
                    <textarea
                      className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                      name="landmarkDescription"
                      onChange={(e) => {
                        setLandmarkInput(e.target.value);
                      }}
                      placeholder="E.g. — near the red gate, behind Hotel Padmini"
                      rows={3}
                      value={landmarkInput}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">
                      Flat / room (optional)
                    </span>
                    <input
                      className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                      name="flatRoom"
                      onChange={(e) => {
                        setFlatRoom(e.target.value);
                      }}
                      value={flatRoom}
                    />
                  </label>

                  <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal">
                    <input
                      aria-label="Save this address"
                      checked={saveAddress}
                      onChange={(e) => {
                        setSaveAddress(e.target.checked);
                      }}
                      type="checkbox"
                    />
                    Save this address
                  </label>

                  {saveAddress ? (
                    <label className="block space-y-1">
                      <span className="font-dm-sans text-sm font-semibold text-gorola-charcoal">
                        Label for saved address
                      </span>
                      <input
                        className="w-full rounded-lg border border-gorola-pine/20 px-3 py-2 font-dm-sans text-sm"
                        onChange={(e) => {
                          setAddressLabel(e.target.value);
                        }}
                        value={addressLabel}
                      />
                    </label>
                  ) : null}

                  <div className="space-y-1 pt-2">
                    <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">
                      Drag the pin near your entrance
                    </p>
                    <AddressMapPicker
                      center={MUSSOORIE_AREA_CENTER}
                      onCoordinatesChange={handleMapCoordinates}
                    />
                    <p className="font-dm-sans text-xs text-gorola-slate">
                      Tiles ©{" "}
                      <a
                        className="text-gorola-pine underline"
                        href="https://www.openstreetmap.org/copyright"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        OpenStreetMap
                      </a>
                    </p>
                  </div>
                </div>
              ) : null}

              {step1Error !== null ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{step1Error}</p>
              ) : null}

              <button
                className="rounded-full bg-gorola-pine px-6 py-2 font-dm-sans text-sm font-semibold text-white"
                onClick={() => {
                  handleContinueFromAddress();
                }}
                type="button"
              >
                Continue
              </button>
            </>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="checkout-review-heading" className="space-y-4">
          <h2 className="font-playfair text-2xl text-gorola-charcoal" id="checkout-review-heading">
            Review
          </h2>
          <ul className="space-y-2">
            {lines.map((line) => (
              <li key={line.productVariantId}>
                <p className="font-dm-sans text-sm text-gorola-charcoal">
                  {(line.productName ?? "Item")}{" "}
                  <span aria-hidden={true}>×</span>
                  {" "}
                  {line.quantity}: Rs{" "}
                  {((line.unitPrice ?? 0) * line.quantity).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
          <p className="font-dm-sans text-sm text-gorola-charcoal">Delivery fee: Rs {DELIVERY_FEE.toFixed(2)}</p>
          {discountSavedAmount > 0 ? (
            <p className="font-dm-sans text-sm font-semibold text-gorola-pine">
              Discount ({discountCode || "Applied"}): -Rs {discountSavedAmount.toFixed(2)}
            </p>
          ) : null}
          <p className="font-dm-sans text-lg font-semibold text-gorola-charcoal">Total: Rs {total.toFixed(2)}</p>
          <p className="font-dm-sans text-sm text-gorola-slate">
            Payment: {paymentMethod === "COD" ? "Cash on delivery" : paymentMethod}
          </p>

          <div
            aria-live="polite"
            className="min-h-[1.25rem] font-dm-sans text-sm text-gorola-slate"
          >
            {placeMutation.isPending ? "Placing your order…" : "\u00A0"}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full border border-gorola-pine/30 px-5 py-2 font-dm-sans text-sm text-gorola-charcoal"
              disabled={placeMutation.isPending}
              onClick={() => {
                setStep(1);
              }}
              type="button"
            >
              Back
            </button>
            <button
              aria-busy={placeMutation.isPending}
              aria-label="Place order"
              className="rounded-full bg-gorola-pine px-6 py-2 font-dm-sans text-sm font-semibold text-white disabled:opacity-60"
              disabled={placeMutation.isPending}
              onClick={() => {
                if (placeOrderInFlightRef.current || placeMutation.isPending) {
                  return;
                }
                placeOrderInFlightRef.current = true;
                placeMutation.mutate(undefined, {
                  onSettled: () => {
                    placeOrderInFlightRef.current = false;
                  },
                });
              }}
              type="button"
            >
              {placeMutation.isPending ? "Placing order…" : "Place Order"}
            </button>
          </div>
          {placeMutation.isError ? (
            <p className="font-dm-sans text-sm text-red-600" role="alert">
              Could not place order.{" "}
              {placeOrderErrorDetail ?? "Tap Place order again."}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
