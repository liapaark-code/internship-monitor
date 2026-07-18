import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Roblox careers. */
export class RobloxScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll('a[href*="/jobs/"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        if (!/careers\.roblox\.com\/jobs\/\d+/.test(a.href)) return;
        const card = a.closest("div[class*='card' i], li, article") || a;
        const titleEl = card.querySelector("h2, h3, [class*='title' i]") || a;
        const locEl = card.querySelector("[class*='location' i]");
        const title = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (title) out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /careers\.roblox\.com\/jobs\/\d+/);
  }
}
