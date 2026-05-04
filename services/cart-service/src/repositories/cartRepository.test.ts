import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet, mockDel } = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockDel: vi.fn(),
}));

vi.mock("redis", () => ({
    createClient: () => ({
        on: vi.fn(),
        connect: vi.fn(),
        get: mockGet,
        set: mockSet,
        del: mockDel,
    }),
}));

import { CartRepository } from "./cartRepository.js";

let repo: CartRepository;
beforeEach(() => {
    vi.clearAllMocks();
    repo = new CartRepository();
});

describe("getCart", () => {
    it("should return a JSON string of cart if it exists in Redis", async () => {
        const cart = { userId: "user123", items: [{ productId: "p1", name: "Phone", price: 0.99, quantity: 1, image: "", variantId: 'v1' }], total: 0.99};
        mockGet.mockResolvedValue(JSON.stringify(cart));

        const result = await repo.getCart("user123");

        expect(mockGet).toHaveBeenCalledWith("cart:user123");
        expect(result).toEqual(cart);
    });
    it("should return a an empty cart when nothing is in Redis", async () => {
        mockGet.mockResolvedValue(null);

        const result = await repo.getCart("user123");

        expect(result).toEqual({ userId: "user123", items: [], total: 0 });
    });
});

describe("addItem", () => {
    it("should add new item to empty cart", async () => {
        mockGet.mockResolvedValue(null);

        const item = { productId: "p1", name: "Phone", price: 10, quantity: 2, image: "", variantId: 'v1' };
        const cart = await repo.addItem("user123", item);
        
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]).toEqual(item);
        expect(cart.total).toBe(20);
        expect(mockSet).toHaveBeenCalledWith("cart:user123", expect.any(String), { EX: expect.any(Number) });
    });
    it("should increment quantity if item exists in cart", async () => {
        const item = { productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' };
        const cart = { userId: "user123", items: [item], total: 10 };
        mockGet.mockResolvedValue(JSON.stringify(cart));

        const result = await repo.addItem("user123", { ...item, quantity: 3 })
        expect(result.items).toHaveLength(1);
        expect(result.items[0].quantity).toBe(4);
        expect(result.total).toBe(40);
    });
});

describe("updateQuantity", () => {
    it("should update quantity of existing item", async () => {
        const existingCart = { userId: "user123", items: [{ productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' }], total: 10};
        mockGet.mockResolvedValue(JSON.stringify(existingCart));
        const result = await repo.updateQuantity("user123", "v1", 5);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].quantity).toBe(5);
        expect(result.total).toBe(50);
    });
    it("should throw when item is NOT in cart", async () => {
        const existingCart = { userId: "user123", items: [{ productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' }], total: 10};
        mockGet.mockResolvedValue(JSON.stringify(existingCart));
        await expect(repo.updateQuantity("user123", "v4", 5)).rejects.toThrow();
    });    
});

describe("removeItem", () => {
    it("should remove item and recalculate total", async () => {
        const item1 = { productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' };
        const item2 = { productId: "p2", name: "Laptop", price: 50, quantity: 1, image: "", variantId: 'v2' };

        const existingCart = { userId: "user123", items: [item1, item2], total: 60};
        mockGet.mockResolvedValue(JSON.stringify(existingCart));
        
        const result = await repo.removeItem("user123", "v1");
        expect(result.items).not.toContainEqual(item1);
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(50);
    });
});

describe("clearCart", () => {
    it("should delete the cart key from Redis", async () => {
        const result = await repo.clearCart("user123");
        expect(mockDel).toHaveBeenCalledWith("cart:user123");
    });
});