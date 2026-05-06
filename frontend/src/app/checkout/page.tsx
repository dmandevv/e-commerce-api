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
import { apiFetch } from "@/lib/api";
import PaymentForm from "./PaymentForm";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type CheckoutStage = "summary" | "processing" | "payment" | "error";

interface IAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface IOrder {
  id: string;
  userId: string;
  status: string;
  total: string;
  items: Array<{ id: string; productId: string; name: string; price: string; quantity: number }>;
  createdAt: string;
}

async function pollForClientSecret(orderId: string): Promise<string> {
  const MAX_RETRIES = 20;
  const DELAY_MS = 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/payments/${orderId}`,
        { credentials: "include", headers: { "Content-Type": "application/json" } }
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

  throw new Error("Payment setup timed out. Please refresh and try again.");
}

export default function CheckoutPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { cart } = useCartContext();
  const router = useRouter();

  const [stage, setStage] = useState<CheckoutStage>("summary");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Address state ────────────────────────────────────────
  const [addresses, setAddresses] = useState<IAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "", street: "", city: "", province: "", postalCode: "", country: "Canada", isDefault: false,
  });
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  // ─── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // ─── Load addresses + resume any pending order ───────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    Promise.all([
      apiFetch<{ data: { addresses: IAddress[] } }>("/api/users/profile"),
      apiFetch<{ data: IOrder[] }>("/api/orders/mine"),
    ]).then(([profileRes, ordersRes]) => {
      // Addresses
      const addrs = profileRes.data.addresses ?? [];
      setAddresses(addrs);
      if (addrs.length === 0) {
        setShowAddForm(true);
      } else {
        const def = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (def) setSelectedAddressId(def.id);
      }

      // Resume pending order
      const pending = ordersRes.data.find((o) => o.status === "PENDING");
      if (pending) {
        setOrderId(pending.id);
        setStage("processing");
        pollForClientSecret(pending.id)
          .then((secret) => { setClientSecret(secret); setStage("payment"); })
          .catch(() => setStage("summary"));
      }
    }).catch(() => setShowAddForm(true))
      .finally(() => setAddressesLoading(false));
  }, [isAuthenticated]);

  const handleSaveAddress = async () => {
    setAddressError("");
    if (!newAddress.label || !newAddress.street || !newAddress.city || !newAddress.province || !newAddress.postalCode) {
      setAddressError("All fields are required.");
      return;
    }
    setSavingAddress(true);
    try {
      const res = await apiFetch<{ data: { address: IAddress } }>("/api/users/addresses", {
        method: "POST",
        body: JSON.stringify(newAddress),
      });
      const added = res.data.address;
      setAddresses((prev) => [...prev, added]);
      setSelectedAddressId(added.id);
      setShowAddForm(false);
      setNewAddress({ label: "", street: "", city: "", province: "", postalCode: "", country: "Canada", isDefault: false });
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : "Failed to save address.");
    } finally {
      setSavingAddress(false);
    }
  };

  if (authLoading) {
    return <div className="w-full px-4 py-8 text-center text-gray-600">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="w-full px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-white">
          <CardHeader><CardTitle className="text-[#0f1111]">Your cart is empty</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">Add items before checking out.</p>
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

  const subtotal = cart.total;
  const tax = Math.round(subtotal * 0.13 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setError("Please select a shipping address.");
      return;
    }

    setStage("processing");
    setError(null);

    try {
      const orderData = await apiFetch<{ data: IOrder }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ addressId: selectedAddressId }),
      });
      const order: IOrder = orderData.data;
      setOrderId(order.id);

      const secret = await pollForClientSecret(order.id);
      setClientSecret(secret);
      setStage("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStage("error");
    }
  };

  if (stage === "summary") {
    return (
      <div className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold text-[#0f1111] mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-4">
            {/* Order summary */}
            <Card className="bg-white">
              <CardHeader><CardTitle className="text-[#0f1111]">Order Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {cart.items.map((item) => (
                    <div key={item.productId} className="flex justify-between items-center text-sm pb-3 border-b">
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

            {/* Shipping address */}
            <Card className="bg-white">
              <CardHeader><CardTitle className="text-[#0f1111]">Shipping Address</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {addressesLoading ? (
                  <p className="text-sm text-gray-500">Loading addresses...</p>
                ) : addresses.length === 0 && !showAddForm ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">No addresses saved. Add one to continue.</p>
                    <Button onClick={() => setShowAddForm(true)} variant="outline" className="rounded-lg">
                      + Add Address
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedAddressId === addr.id
                              ? "border-[#e77600] bg-[#fff3e0]"
                              : "border-[#d5d9d9] hover:border-[#007185]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={addr.id}
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-0.5"
                          />
                          <div className="text-sm">
                            <p className="font-medium text-[#0f1111]">{addr.label}</p>
                            <p className="text-gray-600">{addr.street}</p>
                            <p className="text-gray-600">{addr.city}, {addr.province} {addr.postalCode}</p>
                            <p className="text-gray-600">{addr.country}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" className="rounded-lg text-sm">
                      {showAddForm ? "Cancel" : "+ Add New Address"}
                    </Button>
                  </>
                )}

                {/* Add address form */}
                {showAddForm && (
                  <div className="border rounded-lg p-4 space-y-3 bg-[#f7f7f7]">
                    <p className="font-medium text-sm text-[#0f1111]">New Address</p>
                    {[
                      { key: "label", placeholder: "Label (e.g. Home)" },
                      { key: "street", placeholder: "Street address" },
                      { key: "city", placeholder: "City" },
                      { key: "province", placeholder: "Province" },
                      { key: "postalCode", placeholder: "Postal code" },
                      { key: "country", placeholder: "Country" },
                    ].map(({ key, placeholder }) => (
                      <input
                        key={key}
                        type="text"
                        placeholder={placeholder}
                        value={(newAddress as unknown as Record<string, string>)[key]}
                        onChange={(e) => setNewAddress((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full border border-[#d5d9d9] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007185]"
                      />
                    ))}
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress((prev) => ({ ...prev, isDefault: e.target.checked }))}
                      />
                      Set as default address
                    </label>
                    {addressError && <p className="text-sm text-red-600">{addressError}</p>}
                    <Button
                      onClick={handleSaveAddress}
                      disabled={savingAddress}
                      className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]"
                    >
                      {savingAddress ? "Saving..." : "Save Address"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action panel */}
          <div className="h-fit sticky top-24">
            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="p-6 space-y-4">
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                <Button
                  onClick={handlePlaceOrder}
                  disabled={!selectedAddressId || addressesLoading}
                  className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200] h-12 text-lg disabled:opacity-50"
                >
                  Place Order & Pay
                </Button>
                <Link href="/cart" className="block">
                  <Button variant="outline" className="w-full h-10 rounded-lg">Back to Cart</Button>
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
              <div className="text-4xl animate-spin inline-block">⏳</div>
              <h2 className="text-xl font-semibold text-[#0f1111]">Creating your order...</h2>
              <p className="text-gray-600">Setting up payment. Please wait...</p>
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
            <CardHeader><CardTitle className="text-[#0f1111]">Payment Details</CardTitle></CardHeader>
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
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
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
                  <h2 className="font-bold text-red-800 mb-2">Something went wrong</h2>
                  <p className="text-red-700 text-sm mb-4">{error}</p>
                </div>
              </div>
              <Button
                onClick={() => { setStage("summary"); setError(null); setOrderId(null); setClientSecret(null); }}
                className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]"
              >
                Try Again
              </Button>
              <Link href="/cart" className="block">
                <Button variant="outline" className="w-full rounded-lg">Back to Cart</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
