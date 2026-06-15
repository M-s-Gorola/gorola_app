import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Home } from "lucide-react";
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

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as Record<string, unknown>).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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
  const paymentMethod = useCartStore((s) => s.selectedPaymentMethod);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [addressDefaultSet, setAddressDefaultSet] = useState(false);
  const [mapCoords, setMapCoords] = useState<MapCoordinates | null>(null);
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);

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

  const activeOffers = useCartStore((s) => s.activeOffers);

  const subtotal = useMemo(
    () => lines.reduce((acc, line) => acc + (line.unitPrice ?? 0) * line.quantity, 0),
    [lines]
  );

  const appliedOffers = useMemo(() => {
    let currentSaved = 0;
    const list: Array<{ id: string; title: string; savedAmount: number }> = [];
    for (const offer of activeOffers) {
      const minOrder = offer.minOrderAmount ?? 0;
      if (subtotal >= minOrder) {
        let saved = 0;
        if (offer.discountType === "PERCENTAGE") {
          saved = (subtotal * offer.discountValue) / 100;
          if (offer.maxDiscount !== null && offer.maxDiscount !== undefined) {
            saved = Math.min(saved, offer.maxDiscount);
          }
        } else {
          saved = offer.discountValue;
        }
        const eligibleAmount = Math.max(0, Math.min(subtotal - currentSaved, saved));
        if (eligibleAmount > 0) {
          currentSaved += eligibleAmount;
          list.push({
            id: offer.id,
            title: offer.title,
            savedAmount: eligibleAmount
          });
        }
      }
    }
    return list;
  }, [activeOffers, subtotal]);

  const offerSavedAmount = useMemo(() => {
    return appliedOffers.reduce((acc, o) => acc + o.savedAmount, 0);
  }, [appliedOffers]);

  const total = Math.max(subtotal + DELIVERY_FEE - discountSavedAmount - offerSavedAmount, 0);

  const selectedAddressLabel = useMemo(() => {
    if (deliveryChoice === "new") {
      return saveAddress && addressLabel.trim().length > 0 ? addressLabel.trim() : null;
    }
    const addr = addressesList.find((a) => a.id === deliveryChoice);
    return addr ? addr.label : null;
  }, [deliveryChoice, saveAddress, addressLabel, addressesList]);

  const selectedFlatRoom = useMemo(() => {
    if (deliveryChoice === "new") {
      return flatRoom.trim().length > 0 ? flatRoom.trim() : null;
    }
    return null;
  }, [deliveryChoice, flatRoom]);

  const selectedLandmark = useMemo(() => {
    if (deliveryChoice === "new") {
      return landmarkInput.trim();
    }
    const addr = addressesList.find((a) => a.id === deliveryChoice);
    return addr ? addr.landmarkDescription : "";
  }, [deliveryChoice, landmarkInput, addressesList]);

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

      if (payment === "COD") {
        return id;
      }

      await loadRazorpayScript();
      if (!(window as unknown as Record<string, unknown>).Razorpay) {
        throw new Error("Razorpay SDK could not be loaded.");
      }

      const initiateRes = await api.post<{
        data?: { razorpayOrderId: string; amount: number; currency: string };
      }>("/api/v1/payments/initiate", {
        orderId: id,
        paymentMethod: payment
      });

      const initData = initiateRes.data?.data;
      if (!initData || !initData.razorpayOrderId) {
        throw new Error("Failed to initiate payment");
      }

      return new Promise<string>((resolve, reject) => {
        const options = {
          key: (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "rzp_test_mock",
          amount: initData.amount,
          currency: initData.currency,
          name: "GoRola",
          description: `Payment for Order #${id}`,
          order_id: initData.razorpayOrderId,
          handler: async function (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) {
            try {
              await api!.post("/api/v1/payments/verify", {
                orderId: id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });
              resolve(id);
            } catch {
              reject(new Error("Payment could not be verified. Please contact support."));
            }
          },
          modal: {
            ondismiss: function () {
              reject(new Error("Payment window closed. Please try again."));
            }
          },
          theme: {
            color: "#1B4D3E"
          }
        };

        const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as new (opts: unknown) => { open: () => void };
        const rzp = new RazorpayConstructor(options);
        rzp.open();
      });
    },
    onSuccess: (orderId) => {
      clearCart();
      // Ensure UI updates instantly by clearing the stale cache for orders and addresses
      void queryClient.invalidateQueries({ queryKey: ["orders", "history"] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] });
      
      navigate(`/orders/${orderId}`, { replace: true });
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
              <div className="w-full space-y-4 rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm">
                <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Deliver to:</p>

                <div className="space-y-3">
                  {addressesList.map((a) => (
                    <label key={a.id} className="flex items-start gap-2.5 font-dm-sans text-sm text-gorola-charcoal cursor-pointer">
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
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold">{a.label}</span>
                        <span className="block text-xs text-gorola-slate mt-0.5">{a.landmarkDescription}</span>
                      </span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2.5 font-dm-sans text-sm text-gorola-charcoal cursor-pointer">
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
                    <span className="font-semibold">Deliver to new location</span>
                  </label>
                </div>

                {deliveryChoice === "new" ? (
                  <div className="space-y-3 rounded-xl border border-gorola-pine/15 p-4 bg-gorola-mint/5 mt-4">
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

                    <label className="flex items-center gap-2 font-dm-sans text-sm text-gorola-charcoal cursor-pointer">
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
              </div>

              {step1Error !== null ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 font-dm-sans text-sm text-red-700">{step1Error}</p>
              ) : null}

              <button
                className="rounded-full bg-gorola-pine px-6 py-2.5 font-dm-sans text-sm font-semibold text-white hover:bg-gorola-pine/90 transition-colors shadow-sm"
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

          <div className="w-full space-y-4 rounded-2xl border border-gorola-pine/10 bg-white p-5 text-left shadow-sm">
            <div className="pb-2 border-b border-gorola-pine/10">
              <h3 className="font-playfair text-lg font-bold text-gorola-charcoal">Your items</h3>
            </div>
            <ul aria-label="Order items" className="space-y-2">
              {lines.map((line) => (
                <li
                  className="flex justify-between gap-3 border-b border-gorola-pine/10 pb-2 font-dm-sans text-sm last:border-0 last:pb-0"
                  key={line.productVariantId}
                >
                  <span className="text-gorola-charcoal">
                    {line.productName ?? "Item"}{" "}
                    <span className="text-gorola-slate">× {line.quantity}</span>
                  </span>
                  <span className="shrink-0 font-medium text-gorola-charcoal">
                    Rs {((line.unitPrice ?? 0) * line.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-1.5 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-charcoal">
              <div className="flex justify-between">
                <span className="text-gorola-slate">Subtotal:</span>
                <span className="font-medium">Rs {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gorola-slate">Delivery fee:</span>
                <span className="font-medium">Rs {DELIVERY_FEE.toFixed(2)}</span>
              </div>
              {(() => {
                const totalDiscount = offerSavedAmount + discountSavedAmount;
                if (totalDiscount <= 0) return null;
                return (
                  <div className="space-y-1 font-dm-sans text-sm" data-testid="discount-summary-row">
                    <div className="flex justify-between items-center text-emerald-700">
                      <button
                        type="button"
                        onClick={() => setIsDiscountExpanded(!isDiscountExpanded)}
                        data-testid="discount-breakdown-toggle"
                        aria-expanded={isDiscountExpanded}
                        className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition-colors font-medium focus:outline-none"
                      >
                        <span>Discount:</span>
                        <span className="text-[10px] transform transition-transform duration-200">
                          {isDiscountExpanded ? "▼" : "▶"}
                        </span>
                      </button>
                      <span className="font-medium">-Rs {totalDiscount.toFixed(2)}</span>
                    </div>
                    {isDiscountExpanded && (
                      <div className="space-y-1 pl-3 border-l border-emerald-100" data-testid="discount-breakdown-list">
                        {appliedOffers.map((o) => (
                          <div key={o.id} className="flex justify-between items-start gap-4 text-xs text-emerald-600/90 italic" data-testid="checkout-offer-discount">
                            <span className="text-left flex-1">• Store Offer ({o.title})</span>
                            <span className="text-right whitespace-nowrap shrink-0">-Rs {o.savedAmount.toFixed(2)}</span>
                          </div>
                        ))}
                        {discountSavedAmount > 0 && (
                          <div className="flex justify-between items-start gap-4 text-xs text-emerald-600/90 italic" data-testid="checkout-coupon-discount">
                            <span className="text-left flex-1">• Discount ({discountCode || "Applied"})</span>
                            <span className="text-right whitespace-nowrap shrink-0">-Rs {discountSavedAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex justify-between border-t border-gorola-pine/10 pt-2 font-semibold">
                <span>Total:</span>
                <span>Rs {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1 border-t border-gorola-pine/10 pt-3 font-dm-sans text-sm text-gorola-slate">
              <div className="flex justify-between font-dm-sans text-sm text-gorola-charcoal">
                <span className="text-gorola-slate">Payment Method:</span>
                <span className="font-medium">
                  {paymentMethod === "COD" ? "Cash on delivery" : paymentMethod}
                </span>
              </div>
            </div>

            <div className="space-y-1 border-t border-gorola-pine/10 pt-3 text-left">
              <p className="font-dm-sans text-sm font-semibold text-gorola-charcoal">Delivery Address</p>
              <div className="space-y-1 text-left" data-testid="review-delivery-address">
                {selectedAddressLabel ? (
                  <div className="flex items-center gap-1.5 font-dm-sans text-sm font-bold text-gorola-charcoal">
                    <Home className="h-3.5 w-3.5 text-gorola-pine" />
                    {selectedAddressLabel}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 font-dm-sans text-sm font-bold text-gorola-charcoal">
                    <Home className="h-3.5 w-3.5 text-gorola-pine" />
                    New Location
                  </div>
                )}
                <p className="font-dm-sans text-sm text-gorola-slate">
                  {selectedFlatRoom ? `${selectedFlatRoom}, ` : ""}
                  {selectedLandmark}
                </p>
              </div>
            </div>
          </div>

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
