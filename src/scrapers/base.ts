import { Browser, BrowserContext, Page, chromium } from "playwright";
import { CompanyConfig, loadConfig } from "../config";
import { ScrapedJob } from "../database/diff";
import { matchTitle } from "../utils/keywords";
import { log, logError } from "../utils/logger";
import { sleep, withRetry } from "../utils/retry";
import { isAllowedByRobots } from "../utils/robots";

export interface ScrapeResult {
  jobs: ScrapedJob[];
  succeeded: boolean;
}

let sharedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    // CHROMIUM_PATH lets you point at a system Chromium instead of the
    // Playwright-managed download (useful in restricted environments).
    const executablePath = process.env.CHROMIUM_PATH || undefined;
    sharedBrowser = await chromium.launch({
      headless: true,
      executablePath,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
  }
}

export interface RawJobLink {
  title: string;
  url: string;
  location?: string;
}

/**
 * Base class for all company scrapers.
 * Provides: shared browser, retry + exponential backoff, robots.txt checks,
 * Cloudflare/bot-wall detection, and a generic link-harvest fallback that
 * survives site redesigns.
 */
export abstract class BaseScraper {
  constructor(protected company: CompanyConfig) {}

  /** Company-specific extraction. Return raw candidate links (unfiltered). */
  protected abstract extract(page: Page, url: string): Promise<RawJobLink[]>;

  /** Optional URL normalizer (strip tracking params etc.). */
  protected normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = "";
      for (const p of ["utm_source", "utm_medium", "utm_campaign", "src", "source", "codes"]) {
        u.searchParams.delete(p);
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  async run(): Promise<ScrapeResult> {
    const cfg = loadConfig().scraping;
    const all: RawJobLink[] = [];
    let anyPageSucceeded = false;
    let context: BrowserContext | null = null;

    try {
      const browser = await getBrowser();
      context = await browser.newContext({
        userAgent: cfg.userAgent,
        viewport: { width: 1440, height: 900 },
        locale: "en-US",
      });

      const urls = [...this.company.urls, ...(this.company.pinnedUrls || [])];
      for (const url of urls) {
        if (cfg.respectRobotsTxt && !(await isAllowedByRobots(url))) {
          log(`robots.txt disallows ${url} — skipping this URL.`);
          continue;
        }
        try {
          const links = await withRetry(
            () => this.scrapeOne(context!, url),
            { retries: cfg.maxRetries - 1, baseDelayMs: cfg.baseDelayMs, label: this.company.name }
          );
          all.push(...links);
          anyPageSucceeded = true;
        } catch (err) {
          logError(`${this.company.name}: failed to scrape ${url}`, err);
        }
        await sleep(800 + Math.random() * 700); // be polite between pages
      }
    } catch (err) {
      logError(`${this.company.name}: browser error`, err);
    } finally {
      await context?.close().catch(() => {});
    }

    return { jobs: this.filter(all), succeeded: anyPageSucceeded };
  }

  private async scrapeOne(context: BrowserContext, url: string): Promise<RawJobLink[]> {
    const cfg = loadConfig().scraping;
    const page = await context.newPage();
    try {
      await page.goto(url, {
        timeout: cfg.navigationTimeoutMs,
        waitUntil: "domcontentloaded",
      });
      await this.settle(page);

      if (await this.isBotWall(page)) {
        throw new Error("Cloudflare / bot challenge detected");
      }

      const links = await this.extract(page, url);
      return links;
    } finally {
      await page.close().catch(() => {});
    }
  }

  /** Wait for the page's JS to render content. */
  protected async settle(page: Page): Promise<void> {
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await sleep(1500);
  }

  /** Detect Cloudflare and similar bot walls so we back off instead of parsing garbage. */
  protected async isBotWall(page: Page): Promise<boolean> {
    try {
      const title = (await page.title()).toLowerCase();
      const markers = ["just a moment", "attention required", "access denied", "verify you are human", "cloudflare"];
      if (markers.some((m) => title.includes(m))) return true;
      const bodyText = await page.evaluate(() =>
        document.body ? document.body.innerText.slice(0, 800).toLowerCase() : ""
      );
      return ["checking your browser", "verify you are human", "enable javascript and cookies"].some((m) =>
        bodyText.includes(m)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generic fallback: harvest every anchor on the page whose text looks like
   * a job title and whose href matches the given pattern. Site redesigns
   * rarely break this.
   */
  protected async harvestLinks(page: Page, hrefPattern: RegExp): Promise<RawJobLink[]> {
    const anchors = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent || "").replace(/\s+/g, " ").trim(),
      }))
    );
    return anchors
      .filter((a) => a.text.length > 3 && a.text.length < 160 && hrefPattern.test(a.href))
      .map((a) => ({ title: a.text, url: a.href }));
  }

  /** Apply keyword filtering + normalization and convert to ScrapedJob. */
  protected filter(raw: RawJobLink[]): ScrapedJob[] {
    const out: ScrapedJob[] = [];
    const seen = new Set<string>();
    for (const link of raw) {
      const { matches, is2027 } = matchTitle(link.title);
      if (!matches) continue;
      const url = this.normalizeUrl(link.url);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        company: this.company.name,
        title: link.title,
        location: (link.location || "").trim(),
        url,
        is2027,
      });
    }
    return out;
  }
}
