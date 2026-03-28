"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useCartContext } from "@/context/CartContext";
import PaymentForm from "./PaymentForm";

// ─── Stripe setup (module level to avoid re-creating instance) ───
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type CheckoutStage = "summary" | "processing" | "payment" | "error";

interface IOrder {
  id: string;
  userId: string;
  status: string;
  total: string;
  items: Array<{ id: string; productId: string; name: string; price: string; quantity: number }>;
  createdAt: string;
}

async function pollForClientSecret(
  orderId: string,
  token: string
): Promise<string> {
  const MAX_RETRIES = 20;
  const DELAY_MS = 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://api.dmandevv.shop"}/api/payments/${orderId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      if (data.data?.stripeClientSecret) {
        return data.data.stripeClientSecret;
      }
    } catch (err) {
      console.error(`Poll attempt ${attempt + 1} failed:`, err);
    }
  }

  throw new Error(
    "Payment setup timed out. Please refresh and try again."
  );
}

export default function CheckoutPage() {
  const { token, loading: authLoading } = useAuth();
  const { cart } = useCartContext();
  const router = useRouter();

  const [stage, setStage] = useState<CheckoutStage>("summary");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/auth/login");
    }
  }, [authLoading, token, router]);

  if (authLoading) {
    return (
      <div className="w-full px-4 py-8">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!token) return null; // Will redirect

  // ─── Empty cart guard ───────────────────────────────────────
  if (!cart || cart.items.length === 0) {
    return (
      <div className="w-full px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-white">
          <CardHeader>
            <CardTitle className="text-[#0f1111]">Your cart is empty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You need to add items to your cart before checkout.
            </p>
            <Link href="/products">
              <Button className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]">
                Continue Shopping
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Calculate totals ───────────────────────────────────────
  const subtotal = cart.total;
  const tax = Math.round(subtotal * 0.13 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  // ─── Handle place order ───────────────────────────────────
  const handlePlaceOrder = async () => {
    setStage("processing");
    setError(null);

    try {
      // 1. Create order
      const orderRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://api.dmandevv.shop"}/api/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.message || "Failed to create order");
      }

      const orderData = await orderRes.json();
      const order: IOrder = orderData.data;
      setOrderId(order.id);

      // 2. Poll for client secret
      const secret = await pollForClientSecret(order.id, token);
      setClientSecret(secret);

      // 4. Move to payment stage
      setStage("payment");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setStage("error");
    }
  };

  // ─── Render stages ────────────────────────────────────────

  if (stage === "summary") {
    return (
      <div className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold text-[#0f1111] mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Order summary */}
          <div className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-[#0f1111]">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <div className="space-y-3">
                  {cart.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex justify-between items-center text-sm pb-3 border-b"
                    >
                      <div>
                        <p className="font-medium text-[#0f1111]">{item.name}</p>
                        <p className="text-gray-600">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-[#c45500]">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">HST (13%):</span>
                    <span className="font-medium">${tax.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-[#0f1111]">Total:</span>
                    <span className="text-[#c45500]">${total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action panel */}
          <div className="h-fit sticky top-24">
            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="p-6 space-y-4">
                <Button
                  onClick={handlePlaceOrder}
                  className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200] h-12 text-lg"
                >
                  Place Order & Pay
                </Button>

                <Link href="/cart" className="block">
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-lg"
                  >
                    Back to Cart
                  </Button>
                </Link>

                <p className="text-xs text-gray-500 text-center">
                  You will be directed to a secure payment page.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="w-full px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white text-center py-12">
            <div className="space-y-4">
              <div className="inline-block">
                <div className="animate-spin">
                  <div className="text-4xl">⏳</div>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-[#0f1111]">
                Creating your order...
              </h2>
              <p className="text-gray-600">
                Setting up payment. Please wait...
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (stage === "payment" && clientSecret && orderId) {
    return (
      <div className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold text-[#0f1111] mb-8">Payment</h1>

        <div className="max-w-2xl mx-auto">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-[#0f1111]">Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  Order ID: <span className="font-mono font-bold">{orderId.slice(0, 8)}</span>
                </p>
                <p className="text-lg font-semibold text-[#0f1111]">
                  Total: <span className="text-[#c45500]">${total.toFixed(2)}</span>
                </p>
              </div>

              <div className="border-t pt-6">
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: { theme: "stripe" },
                  }}
                >
                  <PaymentForm orderId={orderId} total={total} />
                </Elements>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="w-full px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-red-50 border border-red-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">❌</div>
                <div className="flex-1">
                  <h2 className="font-bold text-red-800 mb-2">
                    Something went wrong
                  </h2>
                  <p className="text-red-700 text-sm mb-4">{error}</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  setStage("summary");
                  setError(null);
                  setOrderId(null);
                  setClientSecret(null);
                }}
                className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]"
              >
                Try Again
              </Button>

              <Link href="/cart" className="block">
                <Button variant="outline" className="w-full rounded-lg">
                  Back to Cart
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
