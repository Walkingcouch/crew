import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { MarketingFooter } from "@/components/layout/MarketingFooter";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main id="main-content">{children}</main>
      <MarketingFooter />
    </>
  );
}
