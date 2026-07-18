import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Google Careers (also used for YouTube via ?company=YouTube). */
export class GoogleCareersScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    // Primary: structured cards (h3 title inside an li that links to the job).
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document.querySelectorAll("li").forEach((li) => {
        const h3 = li.querySelector("h3");
        const a = li.querySelector('a[href*="jobs/results/"]') as HTMLAnchorElement | null;
        if (!h3 || !a) return;
        const title = (h3.textContent || "").replace(/\s+/g, " ").trim();
        const locEl = li.querySelector('[aria-label*="location" i], .r0wTof, .pwO9Dc');
        const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (title) out.push({ title, url: a.href, location });
      });
      return out;
    });
    if (structured.length > 0) return structured;
    // Fallback: harvest any job-result links.
    return this.harvestLinks(page, /\/careers\/applications\/jobs\/results\/\d+/);
  }

  protected normalizeUrl(url: string): string {
    // Job IDs are stable; strip query noise entirely.
    try {
      const u = new URL(super.normalizeUrl(url));
      const m = u.pathname.match(/(.*\/jobs\/results\/\d+[^/]*)/);
      return m ? `${u.origin}${m[1]}` : u.toString();
    } catch {
      return url;
    }
  }
}
