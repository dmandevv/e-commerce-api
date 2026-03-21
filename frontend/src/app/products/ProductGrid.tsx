import ProductCard, { type Product } from "@/components/ProductCard";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

interface ProductsResponse {
  success: boolean;
  data: Product[];
  count: number;
  pagination?: {
    page: number;
    perPage: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function getProducts(params: {
  category?: string;
  sort?: string;
  page?: string;
  search?: string;
}): Promise<ProductsResponse> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", params.page);
  if (params.search) query.set("keyword", params.search);
  query.set("limit", "12");

  try {
    return await apiFetch<ProductsResponse>(
      `/api/products?${query.toString()}`,
      { next: { revalidate: 30 } }
    );
  } catch {
    return { success: false, data: [], count: 0 };
  }
}

export default async function ProductGrid({
  searchParams,
}: {
  searchParams: { category?: string; sort?: string; page?: string; search?: string };
}) {
  const res = await getProducts(searchParams);
  const products = res.data;
  const currentPage = Number(searchParams.page) || 1;
  const totalPages = (res.pagination?.totalPages ?? Math.ceil(res.count / 12)) || 1;
  const activeCategory = searchParams.category?.toLowerCase();

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return `/products?${params.toString()}`;
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-[#007185]">
          Home
        </Link>
        <span className="mx-1">/</span>
        <span className="text-foreground">
          {activeCategory
            ? PRODUCT_CATEGORIES.find((c) => c.toLowerCase() === activeCategory) || "Products"
            : "All Products"}
        </span>
      </nav>

      {/* Filters bar */}
      <div className="bg-white rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Category chips */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <Link
            href="/products"
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              !activeCategory
                ? "bg-[#131921] text-white border-[#131921]"
                : "border-[#d5d9d9] hover:bg-[#f7fafa]"
            }`}
          >
            All
          </Link>
          {PRODUCT_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={buildUrl({ category: cat.toLowerCase(), page: undefined })}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activeCategory === cat.toLowerCase()
                  ? "bg-[#131921] text-white border-[#131921]"
                  : "border-[#d5d9d9] hover:bg-[#f7fafa]"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">Sort by:</span>
          <div className="flex gap-1">
            {[
              { label: "Newest", value: "-createdAt" },
              { label: "Price: Low", value: "price" },
              { label: "Price: High", value: "-price" },
              { label: "Rating", value: "-rating" },
            ].map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ sort: opt.value, page: undefined })}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  searchParams.sort === opt.value
                    ? "bg-[#131921] text-white border-[#131921]"
                    : "border-[#d5d9d9] hover:bg-[#f7fafa]"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {res.count > 0
            ? `Showing ${products.length} of ${res.pagination?.totalCount ?? res.count} results`
            : "No products found"}
        </p>
      </div>

      {/* Product grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center">
          <p className="text-lg text-muted-foreground mb-2">No products found</p>
          <Link href="/products" className="text-[#007185] hover:underline text-sm">
            Clear filters
          </Link>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-2 mt-8">
          {currentPage > 1 && (
            <Link
              href={buildUrl({ page: String(currentPage - 1) })}
              className="px-4 py-2 rounded-lg border border-[#d5d9d9] bg-white text-sm hover:bg-[#f7fafa] transition-colors"
            >
              Previous
            </Link>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) =>
                p === 1 ||
                p === totalPages ||
                Math.abs(p - currentPage) <= 2
            )
            .map((p, i, arr) => (
              <span key={p} className="flex items-center gap-2">
                {i > 0 && arr[i - 1] !== p - 1 && (
                  <span className="text-muted-foreground">...</span>
                )}
                <Link
                  href={buildUrl({ page: String(p) })}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm border transition-colors ${
                    p === currentPage
                      ? "bg-[#131921] text-white border-[#131921]"
                      : "border-[#d5d9d9] bg-white hover:bg-[#f7fafa]"
                  }`}
                >
                  {p}
                </Link>
              </span>
            ))}

          {currentPage < totalPages && (
            <Link
              href={buildUrl({ page: String(currentPage + 1) })}
              className="px-4 py-2 rounded-lg border border-[#d5d9d9] bg-white text-sm hover:bg-[#f7fafa] transition-colors"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
