import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Nike careers. */
export class NikeScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll('a[href*="/job/"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        const card = a.closest("li, div[class*='card' i], article") || a;
        const titleEl = card.querySelector("h2, h3, [class*='title' i]") || a;
        const locEl = card.querySelector("[class*='location' i]");
        const title = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (title && title.length < 160) out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /careers\.nike\.com\/.*job/);
  }
}
