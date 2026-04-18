"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "./AuthContext";

export interface ICartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface ICart {
  userId: string;
  items: ICartItem[];
  total: number;
}

// ─── Context Type ───────────────────────────────────────────

interface CartContextType {
  cart: ICart | null;
  cartCount: number;
  loading: boolean;
  addItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<ICart | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived value: sum of all item quantities
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  // ─── Fetch cart from API ───────────────────────────────

  const fetchCart = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: ICart }>("/api/cart");
      setCart(res.data);
    } catch (err) {
      console.error("Failed to fetch cart:", err);
      setCart(null);
    }
  }, []);

  // ─── Initialize cart on auth state change ───────────────

  useEffect(() => {
    if (authLoading) return;

    setLoading(true);

    if (isAuthenticated) {
      fetchCart().finally(() => setLoading(false));
    } else {
      setCart(null);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchCart]);

  // ─── Optimistic mutations ───────────────────────────────

  const addItem = async (productId: string, quantity: number) => {
    if (!isAuthenticated) return;

    // Snapshot current state
    const prevCart = cart;

    // Optimistic update: find item or create new
    const newCart = { ...cart! };
    const existingItem = newCart.items.find(
      (item) => item.productId === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      // This is a placeholder — in real life we'd fetch product details
      // For now, just add to local state; server response will correct it
      newCart.items.push({
        productId,
        name: "",
        price: 0,
        quantity,
        image: "",
      });
    }

    // Recalculate total (rough estimate)
    newCart.total = newCart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    setCart(newCart);

    // Send to server
    try {
      const res = await apiFetch<{ success: boolean; data: ICart }>(
        "/api/cart/items",
        {
          method: "POST",
          body: JSON.stringify({ productId, quantity }),
        }
      );
      setCart(res.data); // Set from server response (source of truth)
    } catch (err) {
      console.error("Failed to add item to cart:", err);
      setCart(prevCart ?? null); // Restore on error
      throw err;
    }
  };

  const removeItem = async (productId: string) => {
    if (!isAuthenticated) return;

    const prevCart = cart;

    // Optimistic update
    const newCart = { ...cart! };
    newCart.items = newCart.items.filter(
      (item) => item.productId !== productId
    );
    newCart.total = newCart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    setCart(newCart);

    // Send to server
    try {
      const res = await apiFetch<{ success: boolean; data: ICart }>(
        `/api/cart/items/${productId}`,
        {
          method: "DELETE",
        }
      );
      setCart(res.data);
    } catch (err) {
      console.error("Failed to remove item from cart:", err);
      setCart(prevCart ?? null);
      throw err;
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!isAuthenticated) return;

    const prevCart = cart;

    // Optimistic update
    const newCart = { ...cart! };
    const item = newCart.items.find((i) => i.productId === productId);
    if (item) {
      item.quantity = quantity;
      newCart.total = newCart.items.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );
    }
    setCart(newCart);

    // Send to server
    try {
      const res = await apiFetch<{ success: boolean; data: ICart }>(
        `/api/cart/items/${productId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        }
      );
      setCart(res.data);
    } catch (err) {
      console.error("Failed to update item quantity:", err);
      setCart(prevCart ?? null);
      throw err;
    }
  };

  const clearCart = async () => {
    if (!isAuthenticated) return;

    const prevCart = cart;

    // Optimistic update
    setCart({ userId: cart?.userId ?? "", items: [], total: 0 });

    // Send to server
    try {
      await apiFetch("/api/cart", {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to clear cart:", err);
      setCart(prevCart ?? null);
      throw err;
    }
  };

  const refreshCart = async () => {
    if (!isAuthenticated) return;
    await fetchCart();
  };

  return (
    <CartContext.Provider
      value={{ cart, cartCount, loading, addItem, removeItem, updateQuantity, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartContext must be used within CartProvider");
  return ctx;
}
