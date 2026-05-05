import { describe, it, expect } from 'vitest';
import { addItemSchema, updateQuantitySchema } from "./cartSchemas.js";

// addItemSchema ----
describe("addItemSchema", () => {
    const validItem = {
      productId: "507f1f77bcf86cd799439011",
      variantId: 'v1',
      quantity: 2
    }
    it("should accept valid productId and quantity", () => {
       const result = addItemSchema.safeParse(validItem);
       expect(result.success).toBe(true);
       if (result.success) {
          expect(result.data).toEqual(validItem)
       }
    });
    it("should reject when missing productId", () => {
        const result = addItemSchema.safeParse({ quantity: 1, variantId: 'v1' });
        expect(result.success).toBe(false);
    });
    it("should reject when productId is empty", () => {
        const result = addItemSchema.safeParse({ productId: "", variantId: 'v1' });
        expect(result.success).toBe(false);
    });
    it("should reject when missing quantity", () => {
        const result = addItemSchema.safeParse({ productId: "abc123", variantId: 'v1' });
        expect(result.success).toBe(false);
    });
    it("should reject when quantity is 0", () => {
        const result = addItemSchema.safeParse({ productId: "abc123", quantity: 0, variantId: 'v1' });
        expect(result.success).toBe(false);
    });
    it("should reject when quantity is negative", () => {
        const result = addItemSchema.safeParse({ productId: "abc123", quantity: -1, variantId: 'v1' });
        expect(result.success).toBe(false);
    });
    it("should reject non-integer quantity", () => {
        const result = addItemSchema.safeParse({ productId: "abc123", quantity: 1.5, variantId: 'v1' });
        expect(result.success).toBe(false);
    });
    it("should accept the minimum quantity", () => {
        const result = addItemSchema.safeParse({ productId: "abc123", quantity: 1, variantId: 'v1' });
        expect(result.success).toBe(true);
    });
});

describe("updateQuantitySchema", () => {
    it("should accept a valid quantity", () => {
        const result = updateQuantitySchema.safeParse({ quantity: 5 });
        expect(result.success).toBe(true);
    });
    it("should reject 0 quantity", () => {
        const result = updateQuantitySchema.safeParse({ quantity: 0 });
        expect(result.success).toBe(false);
    });
    it("should reject negative quantity", () => {
        const result = updateQuantitySchema.safeParse({ quantity: -1 });
        expect(result.success).toBe(false);
    });
    it("should reject non-integer quantity", () => {
        const result = updateQuantitySchema.safeParse({ quantity: 1.75 });
        expect(result.success).toBe(false);
    });
    it("should reject non-number quantity", () => {
        const result = updateQuantitySchema.safeParse({ quantity: "totally a number" });
        expect(result.success).toBe(false);
    });
    it("should reject empty quantity", () => {
        const result = updateQuantitySchema.safeParse({ });
        expect(result.success).toBe(false);
    });
});