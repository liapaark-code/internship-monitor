import * as assert from "assert";
import { openTestDb } from "../database/db";
import { applyScrape, buildSummaryData, ScrapedJob } from "../database/diff";

/**
 * Unit tests for the diff engine — the exact notification rules:
 *   1. never-seen-before          -> notify ("new")
 *   2. closed -> open             -> notify ("reopened")
 *   3. title changed              -> notify ("title_changed")
 *   4. unchanged                  -> NO notification
 *   5. one missed scrape          -> stays open (no premature close)
 *   6. two missed scrapes         -> closed; reappearing later -> "reopened"
 *   7. failed scrape              -> never closes anything
 */

const job = (over: Partial<ScrapedJob> = {}): ScrapedJob => ({
  company: "Google",
  title: "Product Design Intern - Summer 2027",
  location: "Mountain View, CA",
  url: "https://careers.google.com/jobs/results/123",
  is2027: true,
  ...over,
});

const OPTS = { scrapeSucceeded: true, missesBeforeClosed: 2 };

function run(): void {
  const db = openTestDb();

  // 1. brand new posting -> "new"
  let events = applyScrape(db, "Google", [job()], OPTS);
  assert.strictEqual(events.length, 1, "new posting should emit 1 event");
  assert.strictEqual(events[0].type, "new");
  assert.strictEqual(events[0].job.status, "open");

  // 4. same posting again -> no events
  events = applyScrape(db, "Google", [job()], OPTS);
  assert.strictEqual(events.length, 0, "unchanged posting must not notify");

  // 3. title change -> "title_changed"
  events = applyScrape(db, "Google", [job({ title: "Product Design Intern (Summer 2027)" })], OPTS);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, "title_changed");
  assert.strictEqual(events[0].previousTitle, "Product Design Intern - Summer 2027");

  // 5. missing once -> still open
  events = applyScrape(db, "Google", [], OPTS);
  assert.strictEqual(events.length, 0);
  let row: any = db.prepare("SELECT * FROM jobs").get();
  assert.strictEqual(row.status, "open", "one miss must not close");
  assert.strictEqual(row.miss_count, 1);

  // 7. failed scrape -> never closes
  events = applyScrape(db, "Google", [], { ...OPTS, scrapeSucceeded: false });
  row = db.prepare("SELECT * FROM jobs").get();
  assert.strictEqual(row.miss_count, 1, "failed scrape must not bump miss_count");

  // 6a. missing twice (successful scrapes) -> closed
  events = applyScrape(db, "Google", [], OPTS);
  row = db.prepare("SELECT * FROM jobs").get();
  assert.strictEqual(row.status, "closed", "two misses should close");
  assert.ok(row.closed_at, "closed_at should be set");

  // 2. reappears -> "reopened"
  events = applyScrape(db, "Google", [job({ title: "Product Design Intern (Summer 2027)" })], OPTS);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, "reopened");
  assert.strictEqual(events[0].job.status, "open");

  // summary math
  const summary = buildSummaryData(db, 15, "America/Chicago");
  assert.strictEqual(summary.companiesChecked, 15);
  assert.strictEqual(summary.stillOpen, 1);
  assert.strictEqual(summary.newToday.length, 1);

  // second company, second posting -> independent "new"
  events = applyScrape(
    db,
    "Visa",
    [job({ company: "Visa", title: "UX Design Intern", url: "https://visa.example/456", is2027: false })],
    OPTS
  );
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, "new");

  console.log("✅ All diff-engine tests passed (7 scenarios).");
}

run();
