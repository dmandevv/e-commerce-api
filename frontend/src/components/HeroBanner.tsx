import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HeroBanner() {
  return (
    <section className="relative bg-gradient-to-b from-[#232f3e] to-[#eaeded] overflow-hidden">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Shop the latest fake products
          </h1>
          <p className="text-lg text-[#ccc] mb-6">
            Seriously - nothing on here is real.
          </p>
          <Link href="/products">
            <Button className="bg-[#febd69] hover:bg-[#f3a847] text-black font-semibold px-8 h-12 text-base rounded-lg">
              Shop Now
            </Button>
          </Link>
        </div>
      </div>

      {/* Gradient fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#eaeded] to-transparent" />
    </section>
  );
}
