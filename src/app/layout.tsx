import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { UpdateToastListener } from "@/components/shared/UpdateToastListener";

export const metadata: Metadata = {
  title: {
    default: "Crew: Australian licensed trades marketplace",
    template: "%s | Crew",
  },
  description:
    "Book verified, licensed tradespeople across Australia. Escrow-protected payments, GST-inclusive pricing, and a 100% satisfaction guarantee.",
  metadataBase: new URL("https://getcrew.com.au"),
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crew",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <UpdateToastListener />
      </body>
    </html>
  );
}
