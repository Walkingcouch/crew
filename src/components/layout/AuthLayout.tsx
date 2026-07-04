import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-crew-green/5 px-4 py-10">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Link href="/" className="mb-6 flex items-center gap-2 font-extrabold text-crew-green">
        <Image src="/assets/logo_Crew.png" alt="Crew" width={40} height={40} priority />
        <span className="text-xl">Crew</span>
      </Link>
      <main id="main-content" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        {children}
      </main>
      <Link href="/" className="mt-6 text-sm text-neutral-500 hover:text-crew-green">
        Back to home
      </Link>
    </div>
  );
}
