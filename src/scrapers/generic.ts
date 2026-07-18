import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/**
 * Generic scraper — used for ad-hoc companies added to config.json with
 * "scraper": "generic", and as the test harness. Harvests every link that
 * looks like a job posting; keyword filtering does the rest.
 */
export class GenericScraper extends BaseScraper {
  protected async extract(page: Page): Promise<RawJobLink[]> {
    return this.harvestLinks(page, /(job|jobs|careers|positions|details|requisition)/i);
  }
}
