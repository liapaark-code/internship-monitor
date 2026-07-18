import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Apple Jobs search + pinned posting pages. */
export class AppleScraper extends BaseScraper {
  protected async extract(page: Page, url: string): Promise<RawJobLink[]> {
    // Pinned detail page: read the posting title directly.
    if (url.includes("/details/")) {
      const title = await page
        .locator("h1")
        .first()
        .textContent({ timeout: 8000 })
        .catch(() => null);
      if (title && title.trim()) {
        return [{ title: title.replace(/\s+/g, " ").trim(), url }];
      }
      return [];
    }

    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll('a[href*="/details/"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        const title = (a.textContent || "").replace(/\s+/g, " ").trim();
        if (!title) return;
        const row = a.closest("tr, li, div[class*='result']");
        const locEl = row?.querySelector(
          "[class*='location' i], [id*='location' i], span[class*='table--advanced-search']"
        );
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /jobs\.apple\.com\/[a-z-]+\/details\//);
  }

  protected normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`; // drop ?team=… tracking
    } catch {
      return url;
    }
  }
}
