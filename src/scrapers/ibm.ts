import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** IBM careers search. */
export class IBMScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    await page
      .waitForSelector('a[href*="/job/"], [class*="card" i] a', { timeout: 15000 })
      .catch(() => {});
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll('a[href*="/job/"], a[href*="careers.ibm.com"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        if (!/\/job\//i.test(a.href)) return;
        const card = a.closest("div, li, article") || a;
        const titleEl = card.querySelector("h3, h4, [class*='title' i]") || a;
        const locEl = card.querySelector("[class*='location' i], [class*='subtitle' i]");
        const title = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (title && title.length < 160) out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /ibm\.com.*\/job\//i);
  }
}
