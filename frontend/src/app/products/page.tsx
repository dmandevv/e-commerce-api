import { Suspense } from "react";
import ProductGrid from "./ProductGrid";

export const metadata = {
  title: "All Products - dmandevv.shop",
  description: "Browse our full catalog of products",
};

export default function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; sort?: string; page?: string; search?: string };
}) {
  return (
    <div className="bg-[#eaeded] min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <Suspense
          fallback={
            <div className="text-center py-12 text-muted-foreground">
              Loading products...
            </div>
          }
        >
          <ProductGrid searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
