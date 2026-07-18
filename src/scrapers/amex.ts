import { Page } from "playwright";
import { BaseScraper, RawJobLink } from "./base";

/** American Express — Eightfold AI platform; uses its public JSON API. */
export class AmexScraper extends BaseScraper {
  protected async extract(page: Page, url: string): Promise<RawJobLink[]> {
    const parsed = new URL(url);
    const query = parsed.searchParams.get("query") || "product design intern";
    const domain = parsed.searchParams.get("domain") || "aexp.com";
    const apiUrl = `${parsed.origin}/api/apply/v2/jobs?domain=${encodeURIComponent(
      domain
    )}&query=${encodeURIComponent(query)}&num=20&start=0`;

    try {
      const res = await page.request.get(apiUrl, { timeout: 30000 });
      if (res.ok()) {
        const data = await res.json();
        const positions = data.positions || [];
        return positions.map((p: any) => ({
          title: String(p.name || "").trim(),
          url:
            p.canonicalPositionUrl ||
            `${parsed.origin}/careers?pid=${p.id}&domain=${domain}`,
          location: p.location || "",
        }));
      }
    } catch {
      /* fall through to DOM harvest */
    }
    return this.harvestLinks(page, /(careers\?pid=\d+|\/careers\/job)/);
  }
}
