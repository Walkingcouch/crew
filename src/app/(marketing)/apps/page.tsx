import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Crew Apps",
  description: "Install the Crew app for your role: customer, contractor, manager, field worker, supervisor or command centre.",
};

interface AppEntry {
  key: string;
  name: string;
  description: string;
  route: string;
  accent: string;
}

const APPS: AppEntry[] = [
  { key: "customer", name: "Crew", description: "Book services and manage bookings.", route: "/customer", accent: "text-role-customer" },
  { key: "pro", name: "Crew Pro", description: "For contractors: jobs, quotes and payouts.", route: "/pro", accent: "text-role-pro" },
  { key: "manager", name: "Crew Manager", description: "Manage a team of contractors.", route: "/manager", accent: "text-role-manager" },
  { key: "field", name: "Crew Field", description: "Mobile-first job list for field workers.", route: "/field", accent: "text-role-field" },
  { key: "supervisor", name: "Crew Supervisor", description: "Oversee multiple crews and jobs.", route: "/supervisor", accent: "text-role-supervisor" },
  { key: "command", name: "Crew Command", description: "Admin dashboard and platform metrics.", route: "/command", accent: "text-role-command" },
];

const APK_RELEASES_URL = "https://github.com/Walkingcouch/crew/releases";

export default function AppsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-crew-ink sm:text-4xl">Install the Crew app for your role</h1>
        <p className="mt-3 text-neutral-600">
          Each Crew app installs directly from your browser. On Android, scan the QR code or download the APK. On
          iOS, use Safari&apos;s Share menu and choose &quot;Add to Home Screen&quot;.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map((app) => (
          <Card key={app.key} className="flex flex-col items-center gap-3 text-center">
            <p className={`text-lg font-bold ${app.accent}`}>{app.name}</p>
            <p className="text-sm text-neutral-500">{app.description}</p>
            <Image
              src={`/assets/qr/${app.key}.png`}
              alt={`QR code to install ${app.name}`}
              width={120}
              height={120}
              className="rounded-lg border border-neutral-200"
            />
            <div className="flex flex-col gap-2 text-sm">
              <a href={app.route} className="font-semibold text-crew-green hover:underline">
                Install as PWA
              </a>
              <a
                href={APK_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-500 hover:text-crew-green"
              >
                Download Android APK
              </a>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-12 rounded-xl2 border border-neutral-200 bg-neutral-50 p-6">
        <h2 className="text-lg font-bold text-crew-ink">Installing on iOS</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
          <li>Open the app&apos;s link above in Safari.</li>
          <li>
            Tap the Share icon, then <strong>Add to Home Screen</strong>.
          </li>
          <li>Confirm the name and tap Add. The app icon appears on your home screen like any other app.</li>
        </ol>
      </div>
    </div>
  );
}
