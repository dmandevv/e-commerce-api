// Tests for the product Zod schemas: createProductSchema, updateProductSchema, createReviewSchema.
// These schemas validate request bodies BEFORE they reach the controller.
// If the body doesn't match, the validate() middleware returns 400 with field-level errors.

import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  createReviewSchema,
} from "./productSchemas.js";

// ─── createProductSchema ───────────────────────────────────────────

describe("createProductSchema", () => {
  // A valid product body — all required fields present with correct types.
  // This is the "happy path" baseline that all other tests compare against.
  const validProduct = {
    name: "Wireless Mouse",
    description: "A comfortable wireless mouse with ergonomic design",
    price: 29.99,
    category: "Electronics",
    stock: 50,
  };

  it("should accept a valid product body", () => {
    // .safeParse() returns { success: true, data } or { success: false, error }
    // Unlike .parse(), it never throws — better for testing because we can
    // inspect the error details instead of catching exceptions.
    const result = createProductSchema.safeParse(validProduct);

    expect(result.success).toBe(true);
    // When success is true, result.data contains the validated & cleaned body
    if (result.success) {
      expect(result.data.name).toBe("Wireless Mouse");
      expect(result.data.price).toBe(29.99);
      expect(result.data.category).toBe("Electronics");
    }
  });

  it("should default stock to 0 when not provided", () => {
    // stock has .default(0) in the schema — if omitted, Zod fills it in.
    // This is useful for admin UIs where stock might be set later.
    const { stock, ...productWithoutStock } = validProduct;
    const result = createProductSchema.safeParse(productWithoutStock);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock).toBe(0);
    }
  });

  it("should reject when name is missing", () => {
    const { name, ...noName } = validProduct;
    const result = createProductSchema.safeParse(noName);

    // Zod knows name is required — omitting it fails validation
    expect(result.success).toBe(false);
  });

  it("should reject when name is empty string", () => {
    // .min(1) on the schema means at least 1 character — empty string fails
    const result = createProductSchema.safeParse({ ...validProduct, name: "" });

    expect(result.success).toBe(false);
  });

  it("should reject when description is missing", () => {
    const { description, ...noDesc } = validProduct;
    const result = createProductSchema.safeParse(noDesc);

    expect(result.success).toBe(false);
  });

  it("should reject negative price", () => {
    // .min(0) means price >= 0. Negative prices make no sense.
    const result = createProductSchema.safeParse({
      ...validProduct,
      price: -10,
    });

    expect(result.success).toBe(false);
  });

  it("should accept price of 0 (free products)", () => {
    // Edge case: free/sample products should be allowed
    const result = createProductSchema.safeParse({
      ...validProduct,
      price: 0,
    });

    expect(result.success).toBe(true);
  });

  it("should reject invalid category", () => {
    // category is a z.enum() — only values from PRODUCT_CATEGORIES are accepted.
    // "InvalidCategory" is not in that list, so Zod rejects it.
    const result = createProductSchema.safeParse({
      ...validProduct,
      category: "InvalidCategory",
    });

    expect(result.success).toBe(false);
  });

  it("should reject negative stock", () => {
    // You can't have -5 items in a warehouse
    const result = createProductSchema.safeParse({
      ...validProduct,
      stock: -5,
    });

    expect(result.success).toBe(false);
  });

  it("should reject non-integer stock", () => {
    // .int() ensures whole numbers only — you can't have 2.5 items in stock
    const result = createProductSchema.safeParse({
      ...validProduct,
      stock: 2.5,
    });

    expect(result.success).toBe(false);
  });

  it("should accept optional images array", () => {
    // images is .optional() — products can be created without images,
    // and images uploaded later via the separate upload endpoint.
    const result = createProductSchema.safeParse({
      ...validProduct,
      images: [{ publicId: "abc123", url: "https://res.cloudinary.com/demo/image/upload/sample.jpg" }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toHaveLength(1);
    }
  });

  it("should accept product with no images field at all", () => {
    // Omitting images entirely is fine — it's optional
    const result = createProductSchema.safeParse(validProduct);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toBeUndefined();
    }
  });
});

// ─── updateProductSchema ───────────────────────────────────────────

describe("updateProductSchema", () => {
  it("should accept partial updates (only name)", () => {
    // .partial() makes every field optional — PATCH requests
    // only send the fields that changed, not the entire product.
    const result = updateProductSchema.safeParse({ name: "Updated Name" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Updated Name");
      // Fields not sent should be undefined (not present in the output)
      expect(result.data.price).toBeUndefined();
    }
  });

  it("should accept an empty body (no fields to update)", () => {
    // Edge case: if the client sends {} for a PATCH, all fields are optional,
    // so it technically passes validation. The controller handles the no-op.
    const result = updateProductSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("should still validate field types when provided", () => {
    // partial() makes fields optional, but when a field IS provided,
    // it still must match the original type (price must be a number >= 0).
    const result = updateProductSchema.safeParse({ price: -5 });

    expect(result.success).toBe(false);
  });

  it("should reject invalid category even on partial update", () => {
    const result = updateProductSchema.safeParse({ category: "FakeCategory" });

    expect(result.success).toBe(false);
  });
});

// ─── createReviewSchema ────────────────────────────────────────────

describe("createReviewSchema", () => {
  const validReview = {
    productId: "507f1f77bcf86cd799439011",
    rating: 4,
  };

  it("should accept a valid review with just productId and rating", () => {
    // comment and name are optional — a user can leave a star rating without text
    const result = createReviewSchema.safeParse(validReview);

    expect(result.success).toBe(true);
  });

  it("should accept a review with optional comment and name", () => {
    const result = createReviewSchema.safeParse({
      ...validReview,
      comment: "Great product!",
      name: "John",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBe("Great product!");
      expect(result.data.name).toBe("John");
    }
  });

  it("should reject when productId is missing", () => {
    const { productId, ...noId } = validReview;
    const result = createReviewSchema.safeParse(noId);

    expect(result.success).toBe(false);
  });

  it("should reject when productId is empty string", () => {
    // .min(1) requires at least 1 character — empty string is not a valid ID
    const result = createReviewSchema.safeParse({
      ...validReview,
      productId: "",
    });

    expect(result.success).toBe(false);
  });

  it("should reject rating below 1", () => {
    // Ratings are 1-5 stars. 0 stars isn't a valid rating — the user
    // hasn't actually rated the product yet.
    const result = createReviewSchema.safeParse({
      ...validReview,
      rating: 0,
    });

    expect(result.success).toBe(false);
  });

  it("should reject rating above 5", () => {
    const result = createReviewSchema.safeParse({
      ...validReview,
      rating: 6,
    });

    expect(result.success).toBe(false);
  });

  it("should reject non-integer rating", () => {
    // .int() — you can't give 3.5 stars, only whole numbers
    const result = createReviewSchema.safeParse({
      ...validReview,
      rating: 3.5,
    });

    expect(result.success).toBe(false);
  });

  it("should accept boundary ratings (1 and 5)", () => {
    // Boundary testing: ensure min and max are inclusive, not exclusive
    const result1 = createReviewSchema.safeParse({ ...validReview, rating: 1 });
    const result5 = createReviewSchema.safeParse({ ...validReview, rating: 5 });

    expect(result1.success).toBe(true);
    expect(result5.success).toBe(true);
  });
});
