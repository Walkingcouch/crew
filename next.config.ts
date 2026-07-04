import type { NextConfig } from "next";

// Security headers not already covered by Next.js defaults. CSP allows
// Supabase (auth/DB/Realtime), CheckVault (escrow), and Resend is
// server-side only so needs no client-side allowance. Permissions-Policy
// denies biometric APIs platform-wide, per the ground rule: no WebAuthn,
// no passkeys, ever.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.checkvault.com.au",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.checkvault.com.au",
  "media-src 'self'",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), payment=(), publickey-credentials-get=(), publickey-credentials-create=()",
          },
          { key: "Content-Security-Policy", value: CSP },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/contractor", destination: "/pro", permanent: true },
      { source: "/dashboard", destination: "/manager", permanent: true },
      { source: "/command/tablet", destination: "/command", permanent: true },
      { source: "/downloads", destination: "/apps", permanent: true },
      { source: "/signin", destination: "/login", permanent: true },
    ];
  },
};

export default nextConfig;
