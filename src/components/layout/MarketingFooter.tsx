import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contractors", label: "For Contractors" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/blog", label: "Blog" },
  { href: "/apps", label: "Apps" },
];

const LEGAL_ITEMS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/complaints", label: "Complaints" },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Link href="/" className="flex items-center gap-2 font-extrabold text-crew-green">
            <Image src="/assets/logo_Crew.png" alt="Crew" width={28} height={28} />
            <span>Crew</span>
          </Link>
          <p className="mt-3 text-sm text-neutral-500">
            Book verified, licensed tradespeople across Australia.
          </p>
          <a href="mailto:hello@getcrew.com.au" className="mt-2 inline-block text-sm text-crew-green">
            hello@getcrew.com.au
          </a>
        </div>

        <nav aria-label="Footer navigation">
          <p className="mb-3 text-sm font-semibold text-crew-ink">Explore</p>
          <ul className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-neutral-500 hover:text-crew-green">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal navigation">
          <p className="mb-3 text-sm font-semibold text-crew-ink">Legal</p>
          <ul className="flex flex-col gap-2">
            {LEGAL_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-neutral-500 hover:text-crew-green">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-neutral-200 py-4 text-center text-xs text-neutral-400">
        &copy; {year} Crew Australia Pty Ltd. ABN 00 000 000 000.
      </div>
    </footer>
  );
}
