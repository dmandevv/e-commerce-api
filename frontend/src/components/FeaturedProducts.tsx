"use client";

import { useState, useEffect } from "react";
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

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ProductsResponse>("/api/products?limit=8")
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="w-full px-4 py-8">
        <h2 className="text-2xl font-bold text-[#0f1111] mb-4">Featured Products</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg h-64 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="w-full px-4 py-8">
        <h2 className="text-2xl font-bold text-[#0f1111] mb-4">Featured Products</h2>
        <div className="bg-white rounded-lg p-8 text-center text-muted-foreground">
          <p>Unable to load products.</p>
          <p className="text-sm mt-2">Make sure the backend is running at api.dmandevv.shop</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-[#0f1111]">Featured Products</h2>
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
