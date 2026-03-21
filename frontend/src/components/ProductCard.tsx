import Link from "next/link";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const categoryEmoji: Record<string, string> = {
  Electronics: "📱",
  Computers: "💻",
  "Smart Home": "🏠",
  "Arts & Crafts": "🎨",
  Automotive: "🚗",
  Baby: "👶",
  "Beauty & Personal Care": "💄",
  Books: "📚",
  Clothing: "👕",
  Shoes: "👟",
  Jewelry: "💍",
  "Food & Grocery": "🍫",
  Handmade: "🧶",
  "Health & Household": "💊",
  "Home & Kitchen": "🍳",
  "Industrial & Scientific": "🔬",
  Luggage: "🧳",
  "Movies & TV": "🎬",
  Music: "🎵",
  "Pet Supplies": "🐾",
  "Sports & Outdoors": "⚽",
  "Tools & Home Improvement": "🔧",
  "Toys & Games": "🎮",
  "Video Games": "🕹️",
};

export interface Product {
  _id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  stock: number;
  rating: number;
  numOfReviews: number;
  images: string[];
  reviews: Review[];
  createdAt: string;
}

export interface Review {
  _id: string;
  user: string;
  name: string;
  rating: number;
  comment: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= Math.round(rating)
              ? "fill-[#ffa41c] text-[#ffa41c]"
              : "fill-[#e0e0e0] text-[#e0e0e0]"
          }`}
        />
      ))}
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product._id}`}>
      <Card className="h-full hover:shadow-md transition-shadow bg-white border-0 shadow-sm group">
        {/* Image placeholder */}
        <div className="aspect-square bg-[#f7f7f7] flex items-center justify-center p-6 group-hover:scale-105 transition-transform overflow-hidden rounded-t-lg">
          <div className="text-4xl text-muted-foreground/30 font-light">
            {categoryEmoji[product.category] || "📦"}
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="font-medium text-sm line-clamp-2 text-[#0f1111] mb-1 group-hover:text-[#c45500]">
            {product.name}
          </h3>

          <div className="flex items-center gap-1 mb-1">
            <StarRating rating={product.rating} />
            <span className="text-xs text-[#007185]">
              {product.numOfReviews.toLocaleString()}
            </span>
          </div>

          <div className="mt-1">
            <span className="text-xs align-top">$</span>
            <span className="text-xl font-medium text-[#0f1111]">
              {Math.floor(product.price)}
            </span>
            <span className="text-xs align-top">
              {(product.price % 1).toFixed(2).substring(1)}
            </span>
          </div>

          {product.stock > 0 ? (
            <p className="text-xs text-[#007600] mt-1">In Stock</p>
          ) : (
            <p className="text-xs text-destructive mt-1">Out of Stock</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
