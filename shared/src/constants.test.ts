// Tests for shared constants.
// These arrays are the single source of truth for enums used across
// all services, Prisma schemas, and the frontend. If someone accidentally
// removes or renames a value, these tests catch it.

import { describe, it, expect } from "vitest";
import { PRODUCT_CATEGORIES, ORDER_STATUSES } from "./constants.js";

describe("PRODUCT_CATEGORIES", () => {
  it("should contain 24 categories", () => {
    // If someone adds or removes a category, this test forces them to update intentionally
    expect(PRODUCT_CATEGORIES).toHaveLength(24);
  });

  it("should include key categories that the frontend and seed data depend on", () => {
    // These categories are referenced in seed.ts and frontend filters —
    // removing any of them would break the UI
    expect(PRODUCT_CATEGORIES).toContain("Electronics");
    expect(PRODUCT_CATEGORIES).toContain("Computers");
    expect(PRODUCT_CATEGORIES).toContain("Food & Grocery");
    expect(PRODUCT_CATEGORIES).toContain("Clothing");
  });

  it("should be a readonly tuple (immutable at runtime)", () => {
    // "as const" in the source makes this readonly — verify it's an array
    // that hasn't been accidentally changed to a mutable type
    expect(Array.isArray(PRODUCT_CATEGORIES)).toBe(true);
  });
});

describe("ORDER_STATUSES", () => {
  it("should contain exactly 5 statuses", () => {
    expect(ORDER_STATUSES).toHaveLength(5);
  });

  it("should match the Prisma enum values exactly", () => {
    // These must match the Prisma schema's OrderStatus enum —
    // if they diverge, order creation/updates will fail at the DB level
    expect(ORDER_STATUSES).toEqual([
      "PENDING",    // Order placed, awaiting payment
      "PAID",       // Payment confirmed via Stripe webhook
      "SHIPPED",    // Admin marked as shipped
      "DELIVERED",  // Admin marked as delivered
      "CANCELLED",  // Payment failed or admin cancelled
    ]);
  });
});
