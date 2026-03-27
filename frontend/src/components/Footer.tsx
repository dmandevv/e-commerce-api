"use client";

import Link from "next/link";

const footerLinks = {
  "Get to Know Us": [
    { label: "About Us", href: "/about" },
    { label: "Careers", href: "#" },
  ],
  "Let Us Help You": [
    { label: "Your Account", href: "/auth/login" },
    { label: "Your Orders", href: "/orders" },
    { label: "Returns & Replacements", href: "#" },
  ],
  "Shop With Us": [
    { label: "All Products", href: "/products" },
    { label: "Electronics", href: "/products?category=electronics" },
    { label: "Laptops", href: "/products?category=laptops" },
    { label: "Cameras", href: "/products?category=cameras" },
  ],
};

export default function Footer() {
  return (
    <footer>
      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="w-full bg-[#37475a] hover:bg-[#485769] text-white text-sm py-3 transition-colors"
      >
        Back to top
      </button>

      {/* Link columns */}
      <div className="bg-[#232f3e] text-white">
        <div className="w-full px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="font-bold mb-3">{title}</h3>
                <ul className="space-y-2 text-sm text-[#ddd]">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-[#131921] text-white text-center py-4 text-xs text-[#999]">
        <p>dmandevv.shop &mdash; Portfolio E-Commerce Platform</p>
      </div>
    </footer>
  );
}
