import { Suspense } from "react";
import ProductGrid from "./ProductGrid";

export const metadata = {
  title: "All Products - dmandevv.shop",
  description: "Browse our full catalog of products",
};

export default function ProductsPage() {
  return (
    <div className="bg-[#eaeded] min-h-screen">
      <div className="w-full px-4 py-6">
        <Suspense
          fallback={
            <div className="text-center py-12 text-muted-foreground">
              Loading products...
            </div>
          }
        >
          <ProductGrid />
        </Suspense>
      </div>
    </div>
  );
}
