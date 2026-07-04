import type { ReactNode } from "react";

export function LegalDoc({
  title,
  intro,
  effective,
  updated,
  toc,
  children,
}: {
  title: string;
  intro: string;
  effective: string;
  updated: string;
  toc: { href: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold text-crew-ink">{title}</h1>
      <p className="mt-2 text-neutral-500">{intro}</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-400">
        <span>Effective: {effective}</span>
        <span>Last updated: {updated}</span>
        <span>Governing law: Australia</span>
      </div>

      <nav aria-label="Table of contents" className="mt-8 rounded-xl2 border border-neutral-200 bg-neutral-50 p-5">
        <p className="mb-2 text-sm font-semibold text-crew-ink">Contents</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {toc.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="text-crew-green hover:underline">
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="prose prose-neutral mt-8 max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-crew-ink [&_h2]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-neutral-700 [&_li]:text-sm [&_li]:text-neutral-700 [&_a]:text-crew-green">
        {children}
      </div>
    </div>
  );
}

export function LegalNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-crew-amber/30 bg-crew-amber/10 p-3 text-sm text-crew-ink">
      {children}
    </div>
  );
}
