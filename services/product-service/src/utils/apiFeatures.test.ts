// Tests for the APIFeatures class: search, filter, sort, pagination, getPagination.
// APIFeatures wraps a Mongoose Query with chainable methods that transform
// the query based on URL query string parameters (e.g., ?keyword=phone&sort=-price&page=2).

// ─── Why we mock Mongoose Query ───────────────────────────────────
// The real Mongoose Query object talks to MongoDB. We don't want a real
// database in unit tests — we want to verify that APIFeatures calls the
// correct Mongoose methods (.find, .sort, .limit, .skip) with the correct
// arguments. So we build a fake Query that records what was called.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { APIFeatures } from "./apiFeatures.js";

// ─── Mock Query Builder ───────────────────────────────────────────
// Mongoose queries are chainable: Product.find().sort().limit().skip()
// Each method returns `this` so you can keep chaining.
// Our mock does the same — every method returns the mock itself.

function createMockQuery() {
  const mock: any = {
    // .find(filter) — adds conditions to the query.
    // Called by search() and filter() to narrow results.
    find: vi.fn(),

    // .sort(sortStr) — sets the sort order.
    // e.g., "-price" means descending by price.
    sort: vi.fn(),

    // .limit(n) — caps how many documents are returned.
    // Used for pagination (e.g., 8 per page).
    limit: vi.fn(),

    // .skip(n) — skips the first N documents.
    // Used with limit for offset-based pagination.
    skip: vi.fn(),

    // .model — reference to the Mongoose model.
    // getPagination() calls model.countDocuments() to get total count.
    model: {
      countDocuments: vi.fn(),
    },

    // .getFilter() — returns the current filter conditions on the query.
    // getPagination() passes this to countDocuments so the total count
    // matches the same filters (search + category) as the actual results.
    getFilter: vi.fn().mockReturnValue({}),
  };

  // Each chainable method returns the mock itself, enabling: query.find().sort().limit()
  mock.find.mockReturnValue(mock);
  mock.sort.mockReturnValue(mock);
  mock.limit.mockReturnValue(mock);
  mock.skip.mockReturnValue(mock);

  return mock;
}

// ─── search() ──────────────────────────────────────────────────────

describe("APIFeatures.search()", () => {
  it("should add regex search on name and description when keyword is provided", () => {
    const query = createMockQuery();
    // ?keyword=phone — user typed "phone" in the search bar
    const features = new APIFeatures(query, { keyword: "phone" });

    features.search();

    // search() calls query.find() with a $or condition:
    // Match "phone" in EITHER name OR description, case-insensitive.
    // $regex is MongoDB's pattern matching operator.
    // $options: 'i' means case-insensitive (Phone, PHONE, phone all match).
    expect(query.find).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: "phone", $options: "i" } },
        { description: { $regex: "phone", $options: "i" } },
      ],
    });
  });

  it("should pass empty filter when no keyword is provided", () => {
    const query = createMockQuery();
    // No keyword in query string — show all products
    const features = new APIFeatures(query, {});

    features.search();

    // Empty object {} means "no additional filter" — returns everything
    expect(query.find).toHaveBeenCalledWith({});
  });

  it("should be chainable (returns this)", () => {
    const query = createMockQuery();
    const features = new APIFeatures(query, { keyword: "laptop" });

    // search() should return the APIFeatures instance itself,
    // enabling: features.search().filter().sort().pagination(8)
    const result = features.search();
    expect(result).toBe(features);
  });
});

// ─── filter() ──────────────────────────────────────────────────────

describe("APIFeatures.filter()", () => {
  it("should convert query operators to MongoDB syntax", () => {
    const query = createMockQuery();
    // ?price[gte]=100&price[lte]=500 — filter products between $100 and $500.
    // Express parses this into: { price: { gte: "100", lte: "500" } }
    // filter() adds the $ prefix MongoDB requires: { price: { $gte: "100", $lte: "500" } }
    const features = new APIFeatures(query, {
      price: { gte: "100", lte: "500" },
    });

    features.filter();

    expect(query.find).toHaveBeenCalledWith({
      price: { $gte: "100", $lte: "500" },
    });
  });

  it("should strip non-schema fields (keyword, sort, limit, page)", () => {
    const query = createMockQuery();
    // These 4 fields control search/sort/pagination, not filtering.
    // filter() must remove them so they don't become MongoDB query conditions.
    const features = new APIFeatures(query, {
      keyword: "phone",
      sort: "-price",
      limit: "10",
      page: "2",
      category: "Electronics",
    });

    features.filter();

    // Only "category" should survive — the other 4 are stripped
    expect(query.find).toHaveBeenCalledWith({ category: "Electronics" });
  });

  it("should pass empty filter when no filter params exist", () => {
    const query = createMockQuery();
    const features = new APIFeatures(query, {});

    features.filter();

    expect(query.find).toHaveBeenCalledWith({});
  });

  it("should be chainable (returns this)", () => {
    const query = createMockQuery();
    const features = new APIFeatures(query, {});

    const result = features.filter();
    expect(result).toBe(features);
  });
});

// ─── sort() ────────────────────────────────────────────────────────

describe("APIFeatures.sort()", () => {
  it("should apply custom sort when sort param is provided", () => {
    const query = createMockQuery();
    // ?sort=-price,rating — sort by price descending, then rating ascending.
    // Commas in the URL become spaces for Mongoose: "-price rating"
    const features = new APIFeatures(query, { sort: "-price,rating" });

    features.sort();

    // Mongoose sort() accepts space-separated fields.
    // "-price" = descending price, "rating" = ascending rating.
    expect(query.sort).toHaveBeenCalledWith("-price rating");
  });

  it("should default to newest first (-createdAt) when no sort param", () => {
    const query = createMockQuery();
    // No sort param — show newest products first (default for most e-commerce sites)
    const features = new APIFeatures(query, {});

    features.sort();

    expect(query.sort).toHaveBeenCalledWith("-createdAt");
  });

  it("should be chainable (returns this)", () => {
    const query = createMockQuery();
    const features = new APIFeatures(query, {});

    const result = features.sort();
    expect(result).toBe(features);
  });
});

// ─── pagination() ──────────────────────────────────────────────────

describe("APIFeatures.pagination()", () => {
  it("should limit and skip based on page number", () => {
    const query = createMockQuery();
    // ?page=3 — user clicked page 3. With 8 items per page,
    // we skip the first 16 items (pages 1 and 2) and show 8.
    const features = new APIFeatures(query, { page: "3" });

    features.pagination(8);

    // limit(8) = return at most 8 documents
    expect(query.limit).toHaveBeenCalledWith(8);
    // skip(16) = skip first 2 pages worth of items: 8 * (3 - 1) = 16
    expect(query.skip).toHaveBeenCalledWith(16);
  });

  it("should default to page 1 when no page param", () => {
    const query = createMockQuery();
    const features = new APIFeatures(query, {});

    features.pagination(8);

    expect(query.limit).toHaveBeenCalledWith(8);
    // Page 1: skip 0 items — 8 * (1 - 1) = 0
    expect(query.skip).toHaveBeenCalledWith(0);
  });

  it("should default to page 1 when page is invalid", () => {
    const query = createMockQuery();
    // "abc" can't be parsed as a number — Number("abc") is NaN.
    // The || 1 fallback catches this and defaults to page 1.
    const features = new APIFeatures(query, { page: "abc" });

    features.pagination(8);

    expect(query.skip).toHaveBeenCalledWith(0);
  });

  it("should be chainable (returns this)", () => {
    const query = createMockQuery();
    const features = new APIFeatures(query, {});

    const result = features.pagination(8);
    expect(result).toBe(features);
  });
});

// ─── getPagination() ───────────────────────────────────────────────

describe("APIFeatures.getPagination()", () => {
  it("should return correct pagination info for middle page", async () => {
    const query = createMockQuery();
    // 24 total products, 8 per page, currently on page 2.
    // That means: 3 total pages, has previous (page 1), has next (page 3).
    query.model.countDocuments.mockResolvedValue(24);

    const features = new APIFeatures(query, { page: "2" });
    features.pagination(8);

    const pagination = await features.getPagination();

    expect(pagination).toEqual({
      page: 2,
      perPage: 8,
      totalCount: 24,
      totalPages: 3,    // ceil(24 / 8) = 3
      hasNext: true,     // page 2 < 3 total pages
      hasPrev: true,     // page 2 > 1
    });
  });

  it("should set hasNext=false on the last page", async () => {
    const query = createMockQuery();
    // 16 products, 8 per page = 2 pages. We're on page 2 (last page).
    query.model.countDocuments.mockResolvedValue(16);

    const features = new APIFeatures(query, { page: "2" });
    features.pagination(8);

    const pagination = await features.getPagination();

    expect(pagination.hasNext).toBe(false); // No page 3
    expect(pagination.hasPrev).toBe(true);  // Page 1 exists
  });

  it("should set hasPrev=false on the first page", async () => {
    const query = createMockQuery();
    query.model.countDocuments.mockResolvedValue(20);

    const features = new APIFeatures(query, { page: "1" });
    features.pagination(8);

    const pagination = await features.getPagination();

    expect(pagination.hasPrev).toBe(false); // Nothing before page 1
    expect(pagination.hasNext).toBe(true);  // ceil(20/8) = 3, more pages exist
  });

  it("should handle zero results", async () => {
    const query = createMockQuery();
    // No products match the search — 0 results, 0 pages.
    query.model.countDocuments.mockResolvedValue(0);

    const features = new APIFeatures(query, {});
    features.pagination(8);

    const pagination = await features.getPagination();

    expect(pagination).toEqual({
      page: 1,
      perPage: 8,
      totalCount: 0,
      totalPages: 0,    // ceil(0 / 8) = 0
      hasNext: false,
      hasPrev: false,
    });
  });

  it("should pass current filter to countDocuments", async () => {
    const query = createMockQuery();
    // Simulate that search() + filter() already set a filter on the query.
    // getPagination must count only the FILTERED results, not all products.
    const activeFilter = { category: "Electronics" };
    query.getFilter.mockReturnValue(activeFilter);
    query.model.countDocuments.mockResolvedValue(5);

    const features = new APIFeatures(query, {});
    features.pagination(8);

    await features.getPagination();

    // countDocuments should receive the same filter the query uses,
    // so the total count matches the actual results being returned.
    expect(query.model.countDocuments).toHaveBeenCalledWith(activeFilter);
  });
});
