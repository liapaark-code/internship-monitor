import * as cron from "node-cron";
import { loadConfig } from "./config";
import { getDb } from "./database/db";
import { runCheckCycle } from "./monitor";
import { notifySummary, writeWidgetFeed } from "./notifiers";
import { buildSummaryText } from "./summary";
import { log, logError } from "./utils/logger";

async function runSummary(): Promise<void> {
  const db = getDb();
  const text = buildSummaryText(db);
  log("=== Daily summary ===");
  for (const line of text.split("\n")) log(`  ${line}`);
  await notifySummary(text);
  writeWidgetFeed(db);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cfg = loadConfig();

  if (args.includes("--once")) {
    // Single check cycle (used by GitHub Actions and for manual testing).
    await runCheckCycle();
    return;
  }
  if (args.includes("--summary")) {
    await runSummary();
    return;
  }

  // Long-running mode (your Mac): node-cron drives everything.
  log(`Internship Monitor started.`);
  log(`Check schedule:   "${cfg.schedule.checkCron}" (${cfg.schedule.timezone})`);
  log(`Summary schedule: "${cfg.schedule.summaryCron}" (${cfg.schedule.timezone})`);

  cron.schedule(
    cfg.schedule.checkCron,
    () => {
      runCheckCycle().catch((err) => logError("Check cycle crashed", err));
    },
    { timezone: cfg.schedule.timezone }
  );

  cron.schedule(
    cfg.schedule.summaryCron,
    () => {
      runSummary().catch((err) => logError("Summary crashed", err));
    },
    { timezone: cfg.schedule.timezone }
  );

  // Kick off an immediate first check so you don't wait up to 3 hours.
  await runCheckCycle().catch((err) => logError("Initial check crashed", err));
}

main().catch((err) => {
  logError("Fatal", err);
  process.exit(1);
});
