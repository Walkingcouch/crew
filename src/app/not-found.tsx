import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Image src="/assets/logo_Crew.png" alt="Crew" width={48} height={48} />
      <h1 className="text-2xl font-extrabold text-crew-ink">This page does not exist</h1>
      <p className="max-w-sm text-neutral-500">
        The page you are looking for has moved, been renamed, or never existed. Let&apos;s get you back on track.
      </p>
      <Link
        href="/"
        className="rounded-full bg-crew-green px-6 py-3 text-sm font-semibold text-white hover:bg-crew-green-light"
      >
        Back to Crew
      </Link>
    </div>
  );
}
