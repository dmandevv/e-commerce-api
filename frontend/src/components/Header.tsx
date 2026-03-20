"use client";

import Link from "next/link";
import { Search, ShoppingCart, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const categories = [
  "Electronics",
  "Cameras",
  "Laptops",
  "Accessories",
  "Food",
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-[#131921] text-white">
        <div className="container mx-auto flex items-center gap-4 px-4 py-2">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 text-xl font-bold tracking-tight hover:outline hover:outline-1 hover:outline-white rounded px-1 py-0.5">
            dmandevv<span className="text-[#febd69]">.shop</span>
          </Link>

          {/* Search bar */}
          <div className="hidden sm:flex flex-1 max-w-2xl">
            <div className="flex w-full">
              <select className="rounded-l-md bg-[#e6e6e6] text-[#555] text-xs px-2 border-none focus:outline-none cursor-pointer">
                <option>All</option>
                {categories.map((cat) => (
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
            <Link
              href="/auth/login"
              className="hidden sm:flex flex-col text-xs hover:outline hover:outline-1 hover:outline-white rounded px-2 py-1"
            >
              <span className="text-[#ccc]">Hello, sign in</span>
              <span className="font-bold text-sm">Account</span>
            </Link>

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
                  0
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
        <div className="container mx-auto px-4">
          <ul className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-hide">
            {categories.map((cat) => (
              <li key={cat}>
                <Link
                  href={`/products?category=${cat.toLowerCase()}`}
                  className="whitespace-nowrap px-3 py-1 rounded hover:bg-white/10 transition-colors"
                >
                  {cat}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/products"
                className="whitespace-nowrap px-3 py-1 rounded hover:bg-white/10 transition-colors font-semibold"
              >
                All Products
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-[#232f3e] text-white border-t border-white/10">
          <div className="px-4 py-3 space-y-2">
            <Link href="/auth/login" className="flex items-center gap-2 py-2 hover:bg-white/10 rounded px-2">
              <User className="h-5 w-5" /> Sign In
            </Link>
            <Link href="/orders" className="flex items-center gap-2 py-2 hover:bg-white/10 rounded px-2">
              Orders
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
