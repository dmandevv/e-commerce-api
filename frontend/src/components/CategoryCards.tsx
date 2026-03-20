import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const categories = [
  { name: "Electronics", emoji: "📱", slug: "electronics" },
  { name: "Cameras", emoji: "📷", slug: "cameras" },
  { name: "Laptops", emoji: "💻", slug: "laptops" },
  { name: "Accessories", emoji: "🎧", slug: "accessories" },
  { name: "Food", emoji: "🍫", slug: "food" },
];

export default function CategoryCards() {
  return (
    <section className="container mx-auto px-4 -mt-8 relative z-10">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories.map((cat) => (
          <Link key={cat.slug} href={`/products?category=${cat.slug}`}>
            <Card className="h-full hover:shadow-md transition-shadow bg-white cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-[#f7f7f7] rounded-md flex items-center justify-center text-5xl">
                  {cat.emoji}
                </div>
                <p className="text-sm text-[#007185] mt-3 hover:text-[#c45500] hover:underline">
                  Shop now
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
