"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useCartContext } from "@/context/CartContext";
import { apiFetch } from "@/lib/api";

export default function CartPage() {
  const { token, loading: authLoading } = useAuth();
  const { cart, loading: cartLoading, removeItem, updateQuantity } =
    useCartContext();
  const router = useRouter();
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});

  // ─── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/auth/login");
    }
  }, [authLoading, token, router]);

  // ─── Fetch product stocks ───────────────────────────────
  useEffect(() => {
    if (!cart || cart.items.length === 0) return;

    Promise.all(
      cart.items.map((item) =>
        apiFetch<{ success: boolean; data: { stock: number } }>(
          `/api/products/${item.productId}`
        )
          .then((res) => ({ [item.productId]: res.data.stock }))
          .catch(() => ({ [item.productId]: 99 })) // Fallback to 99 if fetch fails
      )
    ).then((results) => {
      setProductStocks(Object.assign({}, ...results));
    });
  }, [cart?.items.length]);

  if (authLoading || cartLoading) {
    return (
      <div className="w-full px-4 py-8">
        <div className="text-center text-gray-600">Loading your cart...</div>
      </div>
    );
  }

  if (!token) return null; // Will redirect

  // ─── Empty cart state ───────────────────────────────────────
  if (!cart || cart.items.length === 0) {
    return (
      <div className="w-full px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-[#0f1111]">Your cart is empty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                You haven't added any items to your cart yet. Start shopping to find products you love!
              </p>
              <Link href="/products">
                <Button className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Calculate totals ───────────────────────────────────────
  const subtotal = cart.total;
  const tax = Math.round(subtotal * 0.13 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return (
    <div className="w-full px-4 py-8">
      <h1 className="text-3xl font-bold text-[#0f1111] mb-8">Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Cart items */}
        <div className="space-y-4">
          {cart.items.map((item) => (
            <Card key={item.productId} className="bg-white">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  {/* Product image placeholder */}
                  <div className="flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded"
                        onError={(e) => {
                          // Fallback to emoji if image fails to load
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : null}
                    <div
                      className="w-20 h-20 rounded bg-gray-100 flex items-center justify-center text-3xl"
                      style={{
                        display: item.image ? "none" : "flex",
                      }}
                    >
                      📦
                    </div>
                  </div>

                  {/* Product details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#0f1111] text-lg mb-2">
                      {item.name}
                    </h3>
                    <p className="text-[#c45500] font-semibold mb-4">
                      ${item.price.toFixed(2)}
                    </p>

                    {/* Quantity selector */}
                    <div className="flex items-center gap-2 mb-4">
                      <label htmlFor={`qty-${item.productId}`} className="text-sm text-gray-600">
                        Qty:
                      </label>
                      <select
                        id={`qty-${item.productId}`}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.productId, parseInt(e.target.value))
                        }
                        className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#007185]"
                      >
                        {Array.from(
                          { length: Math.min(productStocks[item.productId] ?? 99, 99) },
                          (_, i) => i + 1
                        ).map((qty) => (
                          <option key={qty} value={qty}>
                            {qty}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Line total */}
                    <p className="text-sm text-gray-700 mb-3">
                      Subtotal:{" "}
                      <span className="font-semibold text-[#c45500]">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </p>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-[#007185] hover:text-[#c45500] font-medium text-sm transition-colors"
                    >
                      Remove from cart
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Order summary (sticky) */}
        <div className="h-fit sticky top-24">
          <Card className="bg-white border-2 border-gray-200">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-bold text-lg text-[#0f1111]">Order Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({cart.items.length} items):</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Estimated HST (13%):</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-[#0f1111]">Order Total:</span>
                  <span className="text-[#c45500]">${total.toFixed(2)}</span>
                </div>
              </div>

              <Link href="/checkout" className="block w-full">
                <Button className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200] h-10">
                  Proceed to Checkout
                </Button>
              </Link>

              <p className="text-xs text-gray-500 text-center mt-3">
                Taxes and shipping calculated at checkout
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
