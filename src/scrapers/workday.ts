import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** Workday-hosted careers (Visa). Uses Workday's CXS JSON API via POST. */
export class WorkdayScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    const wd = this.company.workday;
    if (!wd) return [];
    const searchTexts = this.company.searchTexts?.length
      ? this.company.searchTexts
      : ["design intern"];
    const apiUrl = `https://${wd.host}/wday/cxs/${wd.tenant}/${wd.site}/jobs`;
    const out: RawJobLink[] = [];

    for (const searchText of searchTexts) {
      try {
        const res = await page.request.post(apiUrl, {
          data: { appliedFacets: {}, limit: 20, offset: 0, searchText },
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          timeout: 30000,
        });
        if (!res.ok()) continue;
        const data = await res.json();
        for (const j of data.jobPostings || []) {
          if (!j.title || !j.externalPath) continue;
          out.push({
            title: String(j.title).trim(),
            url: `https://${wd.host}/en-US/${wd.site}${j.externalPath}`,
            location: j.locationsText || "",
          });
        }
      } catch {
        /* try next search text */
      }
    }

    if (out.length > 0) return out;
    // Fallback: harvest the rendered Workday list page.
    return this.harvestLinks(page, /myworkdayjobs\.com\/.+\/job\//);
  }
}
