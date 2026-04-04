// Tests for the order Zod schema: updateStatusSchema.
// This schema validates the status field when an admin updates an order's status.
// Only values from ORDER_STATUSES are accepted: PENDING, PAID, SHIPPED, DELIVERED, CANCELLED.

import { describe, it, expect } from "vitest";
import { updateStatusSchema } from "./orderSchemas.js";

describe("updateStatusSchema", () => {
  it("should accept valid status PAID", () => {
    const result = updateStatusSchema.safeParse({ status: "PAID" });
    expect(result.success).toBe(true);
  });

  it("should accept valid status SHIPPED", () => {
    const result = updateStatusSchema.safeParse({ status: "SHIPPED" });
    expect(result.success).toBe(true);
  });

  it("should accept all valid statuses", () => {
    // Verify every status in the enum is accepted
    const statuses = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
    for (const status of statuses) {
      const result = updateStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid status", () => {
    // REFUNDED is not in the ORDER_STATUSES enum
    const result = updateStatusSchema.safeParse({ status: "REFUNDED" });
    expect(result.success).toBe(false);
  });

  it("should reject empty string", () => {
    const result = updateStatusSchema.safeParse({ status: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing status", () => {
    const result = updateStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
