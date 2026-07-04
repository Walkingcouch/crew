import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Blog",
  description: "News and guides from Crew.",
};

const POSTS = [
  { title: "How escrow protects both sides of a booking", date: "2026-04-12" },
  { title: "A guide to licensed trade work in Australia", date: "2026-03-28" },
  { title: "Setting up recurring lawn care the smart way", date: "2026-03-05" },
];

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold text-crew-ink">Blog</h1>
      <div className="mt-10 flex flex-col gap-4">
        {POSTS.map((post) => (
          <Card key={post.title}>
            <p className="font-semibold text-crew-ink">{post.title}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {new Date(post.date).toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
