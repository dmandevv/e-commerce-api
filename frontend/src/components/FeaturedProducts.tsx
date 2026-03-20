import ProductCard, { type Product } from "./ProductCard";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface ProductsResponse {
  success: boolean;
  data: Product[];
  pagination: {
    totalCount: number;
  };
}

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch<ProductsResponse>("/api/products?limit=8", {
      next: { revalidate: 60 },
    });
    return res.data;
  } catch {
    return [];
  }
}

export default async function FeaturedProducts() {
  const products = await getFeaturedProducts();

  if (products.length === 0) {
    return (
      <section className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-[#0f1111] mb-4">
          Featured Products
        </h2>
        <div className="bg-white rounded-lg p-8 text-center text-muted-foreground">
          <p>Products are loading from the API...</p>
          <p className="text-sm mt-2">Make sure the backend is running at dmandevv.shop</p>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-[#0f1111]">
          Featured Products
        </h2>
        <Link
          href="/products"
          className="text-sm text-[#007185] hover:text-[#c45500] hover:underline"
        >
          See all products
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
