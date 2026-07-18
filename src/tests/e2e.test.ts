import * as assert from "assert";
import * as http from "http";
import { CompanyConfig } from "../config";
import { getDb } from "../database/db";
import { applyScrape } from "../database/diff";
import { formatSms } from "../notifiers/sms";
import { writeWidgetFeed } from "../notifiers/widget";
import { closeBrowser, scrapeCompany } from "../scrapers";
import { buildSummaryText } from "../summary";

/**
 * End-to-end pipeline test against a local mock careers site:
 * real Playwright browser -> real scraper machinery (robots check, retry,
 * bot-wall detection, link harvest, keyword filter) -> real SQLite ->
 * SMS formatting -> widget feed -> daily summary.
 */

const PAGE = `<!doctype html><html><head><title>TestCo Careers</title></head><body>
  <ul>
    <li><a href="/job/101">Product Design Intern - Summer 2027</a> <span>New York, NY</span></li>
    <li><a href="/job/102">UX Design Intern</a></li>
    <li><a href="/job/103">Senior Product Designer</a></li>          <!-- excluded: senior, no program kw -->
    <li><a href="/job/104">Software Engineer Intern</a></li>         <!-- no role keyword -->
    <li><a href="/job/105">Design Technologist Intern (University)</a></li>
    <li><a href="/about">About us</a></li>
  </ul>
</body></html>`;

async function run(): Promise<void> {
  process.env.DATABASE_PATH = "data/test-e2e.db";
  const fs = require("fs");
  try { fs.unlinkSync(require("path").join(__dirname, "../../data/test-e2e.db")); } catch {}

  const server = http.createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nDisallow: /private/\n");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(PAGE);
  });
  await new Promise<void>((r) => server.listen(8899, "127.0.0.1", r));

  const company: CompanyConfig = {
    name: "TestCo",
    scraper: "generic",
    enabled: true,
    urls: ["http://127.0.0.1:8899/careers"],
  };

  try {
    const result = await scrapeCompany(company);
    assert.strictEqual(result.succeeded, true, "scrape should succeed");
    const titles = result.jobs.map((j) => j.title).sort();
    assert.deepStrictEqual(
      titles,
      [
        "Design Technologist Intern (University)",
        "Product Design Intern - Summer 2027",
        "UX Design Intern",
      ],
      `keyword filter selected wrong jobs: ${JSON.stringify(titles)}`
    );
    const j2027 = result.jobs.find((j) => j.title.includes("2027"));
    assert.ok(j2027 && j2027.is2027, "2027 posting should be tagged");

    const db = getDb();
    const events = applyScrape(db, "TestCo", result.jobs, {
      scrapeSucceeded: result.succeeded,
      missesBeforeClosed: 2,
    });
    assert.strictEqual(events.length, 3, "3 new postings -> 3 events");
    assert.ok(events.every((e) => e.type === "new"));

    // SMS format matches the requested layout
    const sms = formatSms(events.find((e) => e.job.is_2027)!);
    assert.ok(sms.startsWith("Product Design Internship Open!!!!"), "SMS headline");
    for (const label of ["Company:", "Title:", "Location:", "Apply:", "First Seen:"]) {
      assert.ok(sms.includes(label), `SMS missing "${label}"`);
    }
    assert.ok(sms.includes("TestCo"), "SMS company");
    assert.ok(sms.includes("http://127.0.0.1:8899/job/101"), "SMS url");
    console.log("--- sample SMS ---\n" + sms + "\n------------------");

    // Widget feed
    writeWidgetFeed(db);
    const feed = JSON.parse(
      fs.readFileSync(require("path").join(__dirname, "../../data/status.json"), "utf-8")
    );
    assert.strictEqual(feed.counts.open, 3, "widget feed open count");
    assert.ok(feed.openJobs.length === 3);

    // Daily summary
    const summary = buildSummaryText(db);
    assert.ok(summary.includes("Internship Monitor Daily Summary"));
    assert.ok(summary.includes("New jobs:"));
    console.log("--- sample summary ---\n" + summary + "\n----------------------");

    console.log("✅ E2E pipeline test passed (Playwright -> scraper -> DB -> SMS/widget/summary).");
  } finally {
    server.close();
    await closeBrowser();
    try { fs.unlinkSync(require("path").join(__dirname, "../../data/test-e2e.db")); } catch {}
  }
}

run().catch((err) => {
  console.error("❌ E2E test failed:", err);
  process.exit(1);
});
