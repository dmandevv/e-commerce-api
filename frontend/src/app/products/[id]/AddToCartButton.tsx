"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AddToCartButton({
  productId,
  inStock,
}: {
  productId: string;
  inStock: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAddToCart() {
    setAdding(true);
    setMessage("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!token) {
        setMessage("Please sign in to add items to your cart");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://dmandevv.shop"}/api/cart/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId, quantity }),
        }
      );

      if (res.ok) {
        setMessage("Added to cart!");
      } else {
        const data = await res.json().catch(() => null);
        setMessage(data?.message || "Failed to add to cart");
      }
    } catch {
      setMessage("Failed to add to cart");
    } finally {
      setAdding(false);
    }
  }

  if (!inStock) {
    return (
      <Button disabled className="w-full h-12 text-base">
        Out of Stock
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Qty:</label>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border border-[#d5d9d9] rounded-lg px-3 py-1.5 bg-[#f0f2f2] text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007185]"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <Button
        onClick={handleAddToCart}
        disabled={adding}
        className="w-full h-12 text-base bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-full border border-[#fcd200] shadow-sm"
      >
        <ShoppingCart className="h-5 w-5 mr-2" />
        {adding ? "Adding..." : "Add to Cart"}
      </Button>

      {message && (
        <p
          className={`text-sm text-center ${
            message.includes("Added") ? "text-[#007600]" : "text-[#c45500]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
