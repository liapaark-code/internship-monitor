import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Meta Careers job search (JS-rendered). */
export class MetaScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    const structured = await page.evaluate(() => {
      const out: { title: string; url: string; location?: string }[] = [];
      document
        .querySelectorAll('a[href*="/jobs/"], a[href*="/v2/jobs/"]')
        .forEach((el) => {
          const a = el as HTMLAnchorElement;
          if (!/\/jobs\/\d+/.test(a.href) && !/\/v2\/jobs\/\d+/.test(a.href)) return;
          const text = (a.textContent || "").replace(/\s+/g, " ").trim();
          if (!text || text.length > 200) return;
          out.push({ title: text.split("|")[0].trim(), url: a.href });
        });
      return out;
    });
    if (structured.length > 0) return structured;
    return this.harvestLinks(page, /metacareers\.com\/(v2\/)?jobs\/\d+/);
  }
}
