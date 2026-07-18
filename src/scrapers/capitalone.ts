import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Capital One careers (Radancy platform). */
export class CapitalOneScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document
        .querySelectorAll("#search-results-list a[data-job-id], section a[data-job-id]")
        .forEach((el) => {
          const a = el as HTMLAnchorElement;
          const titleEl = a.querySelector("h2, .job-title") || a;
          const locEl = a.querySelector(".job-location, [class*='location' i]");
          const title = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
          const location = locEl ? (locEl.textContent || "").replace(/\s+/g, " ").trim() : "";
          if (title) out.push({ title, url: a.href, location });
        });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /capitalonecareers\.com\/job\//);
  }
}
