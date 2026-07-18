import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Microsoft careers — uses the public search API (JSON), far more stable than the SPA. */
export class MicrosoftScraper extends BaseScraper {
  protected async extract(page: Page, url: string): Promise<RawJobLink[]> {
    const body = await page.evaluate(() => document.body?.innerText || "");
    try {
      const data = JSON.parse(body);
      const jobs =
        data?.operationResult?.result?.jobs || data?.result?.jobs || data?.jobs || [];
      return jobs.map((j: any) => ({
        title: String(j.title || j.jobTitle || "").trim(),
        url: `https://jobs.careers.microsoft.com/global/en/job/${j.jobId || j.id}/`,
        location:
          (Array.isArray(j.properties?.locations) && j.properties.locations[0]) ||
          j.properties?.primaryLocation ||
          "",
      }));
    } catch {
      // API shape changed — fall back to scraping the SPA search page.
      const q = new URL(url).searchParams.get("q") || "design intern";
      await page.goto(
        `https://jobs.careers.microsoft.com/global/en/search?q=${encodeURIComponent(q)}`,
        { waitUntil: "domcontentloaded" }
      );
      await this.settle(page);
      return this.harvestLinks(page, /jobs\.careers\.microsoft\.com\/.*\/job\/\d+/);
    }
  }
}
