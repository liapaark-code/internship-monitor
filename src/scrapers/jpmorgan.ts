import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** JPMorgan Chase careers (Oracle Cloud Candidate Experience). */
export class JPMorganScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    // Oracle CX renders slowly; give it a nudge.
    await page
      .waitForSelector('a[href*="/job/"], li[data-qa="searchResultItem"]', { timeout: 15000 })
      .catch(() => {});

    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll('li[data-qa="searchResultItem"]').forEach((li) => {
        const a = li.querySelector('a[href*="/job/"]') as HTMLAnchorElement | null;
        const titleEl = li.querySelector('[data-qa="searchResultItemTitle"], .job-tile__title') || a;
        const locEl = li.querySelector('[data-qa*="location" i], .job-list-item__job-info-value');
        if (!a || !titleEl) return;
        const title = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (title) out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /\/job\/\d+/);
  }
}
