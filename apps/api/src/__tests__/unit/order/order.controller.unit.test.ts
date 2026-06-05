/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerOrderRoutes } from "../../../modules/order/order.controller.js";

describe("OrderController Idempotency Unit", () => {
  const mockBuyerCheckout = {
    placeFromCart: vi.fn()
  };
  const mockCartRepo = {
    addItem: vi.fn()
  };
  const mockOrderRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    updateRating: vi.fn()
  };
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn()
  };
  const mockTokenVerifier = vi.fn();

  let mockApp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = {
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      decorate: vi.fn(),
      addHook: vi.fn(),
      setErrorHandler: vi.fn()
    };
  });

  it("checks redis for idempotency key and returns cached response on hit", async () => {
    registerOrderRoutes(mockApp, {
      buyerCheckout: mockBuyerCheckout as any,
      cart: mockCartRepo as any,
      orders: mockOrderRepo as any,
      tokenVerifier: mockTokenVerifier as any,
      redis: mockRedis as any
    });

    const handler = mockApp.post.mock.calls.find((call: any) => call[0] === "/api/v1/orders")[2];

    const mockRequest = {
      headers: { "x-idempotency-key": "test-key" },
      user: { sub: "buyer-1" },
      body: { addressMode: "saved", addressId: "addr-1", paymentMethod: "COD" },
      id: "req-1"
    } as any;

    const mockReply = {
      getHeader: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis()
    } as any;

    const cachedResponse = { success: true, data: { id: "order-cached" }, meta: { requestId: "req-old" } };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedResponse));

    await handler(mockRequest, mockReply);

    expect(mockRedis.get).toHaveBeenCalledWith("idempotency:buyer-1:test-key");
    expect(mockBuyerCheckout.placeFromCart).not.toHaveBeenCalled();
    expect(mockReply.send).toHaveBeenCalledWith(cachedResponse);
  });

  it("calls placeFromCart on cache miss and stores result in redis", async () => {
    registerOrderRoutes(mockApp, {
      buyerCheckout: mockBuyerCheckout as any,
      cart: mockCartRepo as any,
      orders: mockOrderRepo as any,
      tokenVerifier: mockTokenVerifier as any,
      redis: mockRedis as any
    });

    const handler = mockApp.post.mock.calls.find((call: any) => call[0] === "/api/v1/orders")[2];

    const mockRequest = {
      headers: { "x-idempotency-key": "new-key", "user-agent": "test-agent" },
      user: { sub: "buyer-2" },
      body: { addressMode: "saved", addressId: "addr-2", paymentMethod: "COD" },
      ip: "127.0.0.1",
      id: "req-2"
    } as any;

    const mockReply = {
      getHeader: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis()
    } as any;

    mockRedis.get.mockResolvedValue(null);
    const placedOrder = { 
      order: { 
        id: "order-new", 
        createdAt: new Date(), 
        updatedAt: new Date(),
        items: [],
        status: "PLACED",
        subtotal: { toString: () => "100" },
        total: { toString: () => "130" },
        deliveryFee: { toString: () => "30" },
        store: { id: "s1", name: "S1", phone: "123" },
        statusHistory: [],
        landmarkDescription: "l",
        addressLabel: "a",
        flatRoom: "f",
        paymentMethod: "COD",
        storeId: "s1",
        userId: "buyer-2"
      },
      appliedDiscountAmount: "0.00",
      appliedDiscountCode: null
    };
    mockBuyerCheckout.placeFromCart.mockResolvedValue(placedOrder);

    await handler(mockRequest, mockReply);

    expect(mockRedis.get).toHaveBeenCalledWith("idempotency:buyer-2:new-key");
    expect(mockBuyerCheckout.placeFromCart).toHaveBeenCalledWith(
      "buyer-2",
      expect.objectContaining({ addressMode: "saved", addressId: "addr-2", paymentMethod: "COD" }),
      "127.0.0.1",
      "test-agent"
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      "idempotency:buyer-2:new-key", 
      expect.stringContaining("order-new"), 
      "EX", 
      86400
    );
  });
});
