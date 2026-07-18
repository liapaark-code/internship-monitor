import { loadConfig } from "./config";
import { getDb } from "./database/db";
import { applyScrape, ChangeEvent } from "./database/diff";
import { notifyEvent, writeWidgetFeed } from "./notifiers";
import { closeBrowser, scrapeCompany } from "./scrapers";
import { log, logError } from "./utils/logger";

/** One full check cycle across every enabled company. */
export async function runCheckCycle(): Promise<ChangeEvent[]> {
  const cfg = loadConfig();
  const db = getDb();
  const allEvents: ChangeEvent[] = [];

  log("=== Check cycle started ===");
  for (const company of cfg.companies.filter((c) => c.enabled)) {
    log(`Checking ${company.name}...`);
    try {
      const result = await scrapeCompany(company);
      const events = applyScrape(db, company.name, result.jobs, {
        scrapeSucceeded: result.succeeded,
        missesBeforeClosed: cfg.scraping.missesBeforeClosed,
      });

      if (!result.succeeded) {
        log(`${company.name}: scrape failed — postings left untouched.`);
      } else if (events.length === 0) {
        log("No changes.");
      } else {
        for (const event of events) {
          const label =
            event.type === "new"
              ? "New Internship Found."
              : event.type === "reopened"
              ? "Internship Reopened."
              : "Posting Title Changed.";
          log(`${label} (${event.job.company} — ${event.job.title})`);
          await notifyEvent(event);
        }
        allEvents.push(...events);
      }
    } catch (err) {
      logError(`${company.name}: check failed`, err);
    }
  }

  writeWidgetFeed(db);
  await closeBrowser();
  log(`=== Check cycle finished (${allEvents.length} notification(s)) ===`);
  return allEvents;
}
