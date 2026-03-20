import type { Review } from "@/components/ProductCard";
import StarRating from "./StarRating";

export default function ReviewSection({
  reviews,
  rating,
  numOfReviews,
}: {
  reviews: Review[];
  rating: number;
  numOfReviews: number;
}) {
  return (
    <div id="reviews" className="bg-white rounded-lg p-6 md:p-8 mt-6">
      <h2 className="text-xl font-bold text-[#0f1111] mb-4">
        Customer Reviews
      </h2>

      {/* Summary */}
      <div className="flex items-center gap-3 mb-6">
        <StarRating rating={rating} size="lg" />
        <span className="text-lg font-medium">{rating.toFixed(1)} out of 5</span>
        <span className="text-sm text-muted-foreground">
          ({numOfReviews} {numOfReviews === 1 ? "review" : "reviews"})
        </span>
      </div>

      <hr className="mb-6" />

      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">
          No reviews yet. Be the first to review this product.
        </p>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review._id}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-[#232f3e] text-white flex items-center justify-center text-sm font-medium">
                  {review.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium">{review.name}</span>
              </div>
              <div className="ml-10">
                <StarRating rating={review.rating} />
                <p className="text-sm text-[#333] mt-1 leading-relaxed">
                  {review.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
