"use client";

import Link from "next/link";
import { Search, ShoppingCart, User, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCartContext } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(24);
  const { user, logout } = useAuth();
  const { cartCount } = useCartContext();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const allProductsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateFit = () => {
      if (!containerRef.current || !allProductsRef.current) return;

      const container = containerRef.current;
      const allProductsBtn = allProductsRef.current;

      // Get the parent container width
      const parentWidth = container.parentElement?.offsetWidth || 0;
      const allProductsWidth = allProductsBtn.offsetWidth;
      const availableWidth = parentWidth - allProductsWidth - 24; // 24px for padding/gaps

      // Estimate: each category is roughly 100-110px (category name + padding)
      // Use a reasonable estimate to calculate how many fit
      const estimatedCategoryWidth = 105;
      const estimatedCount = Math.floor(availableWidth / estimatedCategoryWidth);

      // Cap between 1 and total categories
      const count = Math.max(1, Math.min(estimatedCount, PRODUCT_CATEGORIES.length));

      setVisibleCount(count);
    };

    // Calculate on mount with delay to ensure DOM is ready
    const mountTimer = setTimeout(calculateFit, 100);

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(() => {
      calculateFit();
    });

    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
      clearTimeout(mountTimer);
      resizeObserver.disconnect();
    };
  }, []);

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-[#131921] text-white">
        <div className="w-full flex items-center gap-4 px-4 py-2">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 text-xl font-bold tracking-tight hover:outline hover:outline-1 hover:outline-white rounded px-1 py-0.5">
            scamazon<span className="text-[#febd69]">.ca</span>
          </Link>

          {/* Search bar */}
          <div className="hidden sm:flex flex-1">
            <div className="flex w-full">
              <select className="rounded-l-md bg-[#e6e6e6] text-[#555] text-xs px-2 border-none focus:outline-none cursor-pointer">
                <option>All</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
              <Input
                type="text"
                placeholder="Search products..."
                className="rounded-none border-none h-10 bg-white text-black focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                size="icon"
                className="rounded-l-none rounded-r-md bg-[#febd69] hover:bg-[#f3a847] text-black h-10 w-12"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/orders"
                  className="flex flex-col text-xs hover:outline hover:outline-1 hover:outline-white rounded px-2 py-1"
                >
                  <span className="text-[#ccc]">Hello, {user.name}</span>
                  <span className="font-bold text-sm">Account</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex flex-col text-xs hover:outline hover:outline-1 hover:outline-white rounded px-2 py-1"
                >
                  <span className="text-[#ccc]">Sign out</span>
                  <span className="font-bold text-sm">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="hidden sm:flex flex-col text-xs hover:outline hover:outline-1 hover:outline-white rounded px-2 py-1"
              >
                <span className="text-[#ccc]">Hello, sign in</span>
                <span className="font-bold text-sm">Account</span>
              </Link>
            )}

            <Link
              href="/orders"
              className="hidden sm:flex flex-col text-xs hover:outline hover:outline-1 hover:outline-white rounded px-2 py-1"
            >
              <span className="text-[#ccc]">Returns</span>
              <span className="font-bold text-sm">& Orders</span>
            </Link>

            <Link
              href="/cart"
              className="flex items-center gap-1 hover:outline hover:outline-1 hover:outline-white rounded px-2 py-1"
            >
              <div className="relative">
                <ShoppingCart className="h-7 w-7" />
                <span className="absolute -top-1 -right-1 bg-[#febd69] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              </div>
              <span className="hidden sm:inline font-bold text-sm">Cart</span>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden px-4 pb-2">
          <div className="flex w-full">
            <Input
              type="text"
              placeholder="Search products..."
              className="rounded-r-none border-none h-10 bg-white text-black focus-visible:ring-0"
            />
            <Button
              size="icon"
              className="rounded-l-none bg-[#febd69] hover:bg-[#f3a847] text-black h-10 w-12"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Category bar */}
      <nav className="bg-[#232f3e] text-white text-sm">
        <div className="w-full px-4">
          <div className="flex items-center gap-0.5 py-1">
            {/* All Products - always visible on the left */}
            <div ref={allProductsRef}>
              <Link
                href="/products"
                className="whitespace-nowrap px-3 py-1 rounded hover:bg-white/10 transition-colors font-semibold text-sm flex-shrink-0"
              >
                All Products
              </Link>
            </div>
            {/* Category list - dynamically shows what fits */}
            <div className="flex items-center gap-1 flex-1 overflow-hidden" ref={containerRef}>
              {PRODUCT_CATEGORIES.slice(0, visibleCount).map((cat) => (
                <Link
                  key={cat}
                  data-category-link
                  href={`/products?category=${cat.toLowerCase()}`}
                  className="whitespace-nowrap px-3 py-1 rounded hover:bg-white/10 transition-colors text-sm"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-[#232f3e] text-white border-t border-white/10">
          <div className="px-4 py-3 space-y-2">
            {user ? (
              <>
                <div className="px-2 py-1 text-sm text-[#ccc]">
                  Hello, {user.name}
                </div>
                <Link href="/orders" className="flex items-center gap-2 py-2 hover:bg-white/10 rounded px-2">
                  Orders
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 py-2 hover:bg-white/10 rounded px-2 w-full text-left"
                >
                  <LogOut className="h-5 w-5" /> Sign Out
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="flex items-center gap-2 py-2 hover:bg-white/10 rounded px-2">
                <User className="h-5 w-5" /> Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
