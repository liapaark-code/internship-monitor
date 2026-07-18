import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Amazon Jobs — uses the public search.json API. */
export class AmazonScraper extends BaseScraper {
  protected async extract(page: Page, url: string): Promise<RawJobLink[]> {
    if (url.includes("search.json")) {
      const body = await page.evaluate(() => document.body?.innerText || "");
      try {
        const data = JSON.parse(body);
        return (data.jobs || []).map((j: any) => ({
          title: String(j.title || "").trim(),
          url: `https://www.amazon.jobs${j.job_path}`,
          location: j.normalized_location || j.location || "",
        }));
      } catch {
        return [];
      }
    }
    return this.harvestLinks(page, /amazon\.jobs\/.*\/jobs\/\d+/);
  }
}
