import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Phenom People platform — used by Adobe AND Mastercard (same markup). */
export class PhenomScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    await page
      .waitForSelector('a[data-ph-at-id="job-link"], ul[data-ph-at-id="jobs-list"]', {
        timeout: 15000,
      })
      .catch(() => {});
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll('a[data-ph-at-id="job-link"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        const li = a.closest("li");
        const locEl = li?.querySelector(
          '[data-ph-at-id="job-location"], .job-location, [class*="location" i]'
        );
        const title = (a.textContent || "").replace(/\s+/g, " ").trim();
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (title) out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /\/(job|jobs)\/[A-Za-z0-9]/);
  }
}
