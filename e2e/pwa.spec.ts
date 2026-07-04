import { test, expect } from "@playwright/test";

const SURFACES = ["customer", "pro", "manager", "field", "supervisor", "command"];

test.describe("manifests", () => {
  for (const surface of SURFACES) {
    test(`manifest-${surface}.json is valid and its icons resolve`, async ({ request }) => {
      const res = await request.get(`/manifest-${surface}.json`);
      expect(res.ok()).toBeTruthy();
      expect(res.headers()["content-type"]).toContain("manifest+json");

      const manifest = await res.json();
      expect(manifest.name).toBeTruthy();
      expect(manifest.start_url).toBe(`/${surface}`);
      expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThan(0);

      for (const icon of manifest.icons) {
        const iconRes = await request.get(icon.src);
        expect(iconRes.ok(), `icon ${icon.src} should resolve`).toBeTruthy();
      }
    });
  }
});

test.describe("service worker and offline behaviour", () => {
  test("registers the service worker on a real page load", async ({ page }) => {
    await page.goto("/");
    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return !!registration.active;
    });
    expect(registered).toBe(true);
  });

  test("falls back to the offline page when the network is unreachable", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Give the SW a moment to finish precaching the offline page.
    await page.waitForTimeout(500);

    await context.setOffline(true);
    await page.goto("/some-page-that-requires-network-and-does-not-exist", { waitUntil: "load" }).catch(() => {});

    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
    await context.setOffline(false);
  });

  test("update toast does not appear on a fresh first install", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await expect(page.getByText("A new version of Crew is available.")).toHaveCount(0);
  });
});
