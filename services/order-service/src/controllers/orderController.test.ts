// Tests for order controller: placeOrder, getOrder, getMyOrders, updateStatus.
// Controllers are thin — they extract request data, call the service, and send a response.
// We mock the entire service layer so we only test the controller logic.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const {
  mockPlaceOrder,
  mockGetOrderById,
  mockGetUserOrders,
  mockUpdateOrderStatus,
} = vi.hoisted(() => ({
  mockPlaceOrder: vi.fn(),
  mockGetOrderById: vi.fn(),
  mockGetUserOrders: vi.fn(),
  mockUpdateOrderStatus: vi.fn(),
}));

// ─── Mock: order service ──────────────────────────────────────────
vi.mock("../services/orderService.js", () => ({
  placeOrder: mockPlaceOrder,
  getOrderById: mockGetOrderById,
  getUserOrders: mockGetUserOrders,
  updateOrderStatus: mockUpdateOrderStatus,
}));

// ─── Import controller AFTER mocks ───────────────────────────────
import { placeOrder, getOrder, getMyOrders, updateStatus } from "./orderController.js";

// ─── Helpers: fake req / res ──────────────────────────────────────
// mockReq builds a minimal Express Request with the fields controllers use.
// mockRes builds a fake Response with chainable .status().json().
function mockReq(overrides = {}) {
  return {
    user: { id: "user123" },
    headers: { authorization: "Bearer token123" },
    params: {},
    body: {},
    requestId: "req-1",
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  // status() returns res so you can chain .json()
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// ─── Reset mocks between tests ────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

//test data
const order = {
  id: "order1",
  userId: "user123",
  items: [
    { productId: "p1", name: "Phone", price: 50, quantity: 1 },
    { productId: "p2", name: "Case", price: 20, quantity: 2 },
  ],
  total: 90,
  status: "PENDING",
  stripePaymentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("placeOrder", () => {
  it("should place an order for current user", async () => {
    const req = mockReq();
    const res = mockRes();
    mockPlaceOrder.mockResolvedValue(order);
    await placeOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: order } );
  });
});

describe("getOrder", () => {
  it("should retrieve order by id", async () => {
    const req = mockReq({ params: { id: "order1" } });
    const res = mockRes();
    mockGetOrderById.mockResolvedValue(order);
    await getOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: order } );
  });
});

describe("getMyOrders", () => {
  it("should retrieve all orders for current user", async () => {
    const req = mockReq();
    const res = mockRes();
    mockGetUserOrders.mockResolvedValue([order]);
    await getMyOrders(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [order] } );
  });
});

describe("updateStatus", () => {
  it("should change orders status with matching id", async () => {
    const req = mockReq({ params: { id: "order1" }, body: {status: "SHIPPED" } });
    const res = mockRes();
    mockUpdateOrderStatus.mockResolvedValue(order);
    await updateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: order } );
  });
});