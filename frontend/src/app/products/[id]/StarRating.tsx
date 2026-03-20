import { Star } from "lucide-react";

export default function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${cls} ${
            star <= Math.round(rating)
              ? "fill-[#ffa41c] text-[#ffa41c]"
              : "fill-[#e0e0e0] text-[#e0e0e0]"
          }`}
        />
      ))}
    </div>
  );
}
