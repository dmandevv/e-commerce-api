"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// ─── Type definitions ────────────────────────────────────────
interface IOrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  price: string; // Prisma Decimal serialized as string
  quantity: number;
}

interface IOrder {
  id: string;
  userId: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  total: string; // Prisma Decimal serialized as string
  items: IOrderItem[];
  stripePaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Status badge configuration ──────────────────────────────
const STATUS_CONFIG: Record<
  IOrder["status"],
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  SHIPPED: {
    label: "Shipped",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  DELIVERED: {
    label: "Delivered",
    className: "bg-[#e6f4f1] text-[#007185] border-[#b2dfdb]",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

export default function OrdersPage() {
  const { token, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const router = useRouter();

  // ─── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/auth/login");
    }
  }, [authLoading, token, router]);

  // ─── Fetch orders ──────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !token) return;

    setLoading(true);
    setError(null);

    apiFetch<{ success: boolean; data: IOrder[] }>("/api/orders/mine", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        setOrders(res.data);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load orders"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, authLoading]);

  // ─── Toggle expansion ──────────────────────────────────────
  const toggleExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  if (authLoading || loading) {
    return (
      <div className="w-full px-4 py-8">
        <div className="text-center text-gray-600">Loading your orders...</div>
      </div>
    );
  }

  if (!token) return null; // Will redirect

  // ─── Error state ──────────────────────────────────────────
  if (error) {
    return (
      <div className="w-full px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-red-50 border border-red-200">
          <CardContent className="p-6 space-y-4">
            <p className="text-red-700 font-semibold">Failed to load orders</p>
            <p className="text-sm text-red-600">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────
  if (orders.length === 0) {
    return (
      <div className="w-full px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-white">
          <CardHeader>
            <CardTitle className="text-[#0f1111]">No orders yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              When you place an order, it will appear here.
            </p>
            <Link href="/products">
              <Button className="bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]">
                Start Shopping
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Orders list ──────────────────────────────────────────
  return (
    <div className="w-full px-4 py-8">
      <h1 className="text-3xl font-bold text-[#0f1111] mb-8">Your Orders</h1>

      <div className="max-w-4xl mx-auto space-y-4">
        {orders.map((order) => {
          const isExpanded = expandedOrders.has(order.id);
          const config = STATUS_CONFIG[order.status];
          const itemCount = order.items.length;

          return (
            <Card
              key={order.id}
              className="bg-white cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => toggleExpanded(order.id)}
            >
              <CardContent className="p-6">
                {/* Order header (always visible) */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-[#0f1111] mb-1">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge className={`${config.className} border`}>
                        {config.label}
                      </Badge>
                      <p className="text-lg font-bold text-[#c45500] mt-2">
                        ${parseFloat(order.total).toFixed(2)}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Item count */}
                <p className="text-sm text-gray-600 mb-3">
                  {itemCount} item{itemCount !== 1 ? "s" : ""}
                </p>

                {/* Expandable items section */}
                {isExpanded && (
                  <div className="border-t pt-4 space-y-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xl">
                            📦
                          </div>
                          <div>
                            <p className="font-medium text-[#0f1111]">
                              {item.name}
                            </p>
                            <p className="text-gray-600">
                              Qty: {item.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold text-[#c45500]">
                          ${(
                            parseFloat(item.price) * item.quantity
                          ).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
