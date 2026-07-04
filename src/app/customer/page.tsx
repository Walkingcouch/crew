import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PushOptInCard } from "@/components/ui/PushOptInCard";

const CATEGORIES = [
  { slug: "lawn-mowing", name: "Lawn Mowing", icon: "🌱" },
  { slug: "garden-maintenance", name: "Garden Maintenance", icon: "🌳" },
  { slug: "house-cleaning", name: "House Cleaning", icon: "🧹" },
  { slug: "electrical", name: "Electrical", icon: "⚡", licensed: true },
  { slug: "plumbing", name: "Plumbing", icon: "🔧", licensed: true },
  { slug: "handyman", name: "Handyman", icon: "🛠️" },
  { slug: "pest-control", name: "Pest Control", icon: "🐜" },
  { slug: "pool-care", name: "Pool Care", icon: "🏊" },
  { slug: "window-cleaning", name: "Window Cleaning", icon: "🪟" },
  { slug: "pressure-washing", name: "Pressure Washing", icon: "💦" },
  { slug: "tree-lopping", name: "Tree Lopping", icon: "🪓", licensed: true },
  { slug: "painting", name: "Painting", icon: "🎨" },
  { slug: "carpet-cleaning", name: "Carpet Cleaning", icon: "🧼" },
  { slug: "gutter-cleaning", name: "Gutter Cleaning", icon: "🏠" },
  { slug: "rubbish-removal", name: "Rubbish Removal", icon: "🗑️" },
];

export default function CustomerHomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-crew-ink">What do you need done?</h1>
      <div className="mt-4">
        <PushOptInCard />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((category) => (
          <Link key={category.slug} href={`/customer/book?service=${category.slug}`}>
            <Card className="flex flex-col items-center gap-1.5 p-3 text-center hover:border-crew-green">
              <span className="text-2xl" aria-hidden="true">
                {category.icon}
              </span>
              <span className="text-xs font-medium text-crew-ink">{category.name}</span>
              {category.licensed && <span className="text-[10px] text-crew-amber">Licensed</span>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
