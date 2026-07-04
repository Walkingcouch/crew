import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Private beta",
};

export default function BetaGatePage() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="text-4xl" aria-hidden="true">
        🔒
      </span>
      <h1 className="text-xl font-bold text-crew-ink">Crew is in private beta</h1>
      <p className="text-sm text-neutral-500">
        Your account works, but this email is not yet on our beta list. Get in touch and we will add you.
      </p>
      <a
        href="mailto:hello@getcrew.com.au"
        className="rounded-full bg-crew-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-crew-green-light"
      >
        Request access
      </a>
      <Link href="/login" className="text-sm text-neutral-500 hover:text-crew-green">
        Back to sign in
      </Link>
    </div>
  );
}
