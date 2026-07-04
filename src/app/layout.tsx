import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Crew: Australian licensed trades marketplace",
    template: "%s | Crew",
  },
  description:
    "Book verified, licensed tradespeople across Australia. Escrow-protected payments, GST-inclusive pricing, and a 100% satisfaction guarantee.",
  metadataBase: new URL("https://getcrew.com.au"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
