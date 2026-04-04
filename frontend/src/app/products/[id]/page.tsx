"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import type { Product } from "@/components/ProductCard";
import AddToCartButton from "./AddToCartButton";
import StarRating from "./StarRating";
import ReviewSection from "./ReviewSection";

interface ProductResponse {
  success: boolean;
  data: Product;
}

const categoryEmoji: Record<string, string> = {
  Electronics: "📱",
  Cameras: "📷",
  Laptops: "💻",
  Accessories: "🎧",
  Food: "🍫",
};

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch<ProductResponse>(`/api/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="bg-[#eaeded] min-h-screen">
        <div className="w-full px-4 py-6">
          <div className="bg-white rounded-lg p-6 md:p-8 animate-pulse">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-[#f7f7f7] rounded-lg aspect-square" />
              <div className="space-y-4">
                <div className="h-8 bg-[#f7f7f7] rounded w-3/4" />
                <div className="h-4 bg-[#f7f7f7] rounded w-1/4" />
                <div className="h-10 bg-[#f7f7f7] rounded w-1/3" />
                <div className="h-20 bg-[#f7f7f7] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="bg-[#eaeded] min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg p-12 text-center">
          <h1 className="text-2xl font-medium text-[#0f1111] mb-2">Product not found</h1>
          <p className="text-muted-foreground mb-6">This product may no longer be available.</p>
          <Link href="/products" className="text-[#007185] hover:underline">
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#eaeded] min-h-screen">
      <div className="w-full px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-[#007185]">
            Home
          </Link>
          <span className="mx-1">/</span>
          <Link href="/products" className="hover:text-[#007185]">
            Products
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/products?category=${product.category.toLowerCase()}`}
            className="hover:text-[#007185]"
          >
            {product.category}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* Product detail card */}
        <div className="bg-white rounded-lg p-6 md:p-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Image */}
            <div className="bg-[#f7f7f7] rounded-lg flex items-center justify-center aspect-square overflow-hidden">
              {product.images?.[0]?.url ? (
                <Image
                  src={product.images[0].url}
                  alt={product.name}
                  width={800}
                  height={800}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span className="text-8xl">
                  {categoryEmoji[product.category] || "📦"}
                </span>
              )}
            </div>

            {/* Details */}
            <div>
              <h1 className="text-2xl md:text-3xl font-medium text-[#0f1111] mb-2">
                {product.name}
              </h1>

              <div className="flex items-center gap-2 mb-3">
                <StarRating rating={product.rating} />
                <Link
                  href="#reviews"
                  className="text-sm text-[#007185] hover:text-[#c45500] hover:underline"
                >
                  {product.numOfReviews}{" "}
                  {product.numOfReviews === 1 ? "rating" : "ratings"}
                </Link>
              </div>

              <hr className="my-3" />

              {/* Price */}
              <div className="mb-4">
                <span className="text-sm text-muted-foreground">Price:</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm align-top mt-1">$</span>
                  <span className="text-3xl font-light text-[#0f1111]">
                    {Math.floor(product.price)}
                  </span>
                  <span className="text-sm align-top mt-1">
                    {(product.price % 1).toFixed(2).substring(1)}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="font-bold text-sm text-[#0f1111] mb-1">
                  About this item
                </h2>
                <p className="text-sm text-[#333] leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Details table */}
              <div className="border rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="bg-[#f7f7f7] px-4 py-2 font-medium text-[#555] w-1/3">
                        Category
                      </td>
                      <td className="px-4 py-2">{product.category}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-[#f7f7f7] px-4 py-2 font-medium text-[#555]">
                        Availability
                      </td>
                      <td className="px-4 py-2">
                        {product.stock > 0 ? (
                          <span className="text-[#007600]">
                            In Stock ({product.stock} available)
                          </span>
                        ) : (
                          <span className="text-destructive">Out of Stock</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-[#f7f7f7] px-4 py-2 font-medium text-[#555]">
                        Rating
                      </td>
                      <td className="px-4 py-2">
                        {product.rating.toFixed(1)} out of 5
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Add to cart */}
              <AddToCartButton
                productId={product._id}
                inStock={product.stock > 0}
                stock={product.stock}
              />
            </div>
          </div>
        </div>

        {/* Reviews */}
        <ReviewSection
          reviews={product.reviews}
          rating={product.rating}
          numOfReviews={product.numOfReviews}
        />
      </div>
    </div>
  );
}
