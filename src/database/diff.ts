import type Database from "better-sqlite3";
import { jobHash } from "../utils/hash";
import type { JobRow } from "./db";

export interface ScrapedJob {
  company: string;
  title: string;
  location: string;
  url: string;
  is2027: boolean;
}

export type ChangeType = "new" | "reopened" | "title_changed";

export interface ChangeEvent {
  type: ChangeType;
  job: JobRow;
  previousTitle?: string;
}

/**
 * The diff engine. Applies one company's freshly-scraped postings to the DB
 * and returns ONLY the events that warrant a notification:
 *   1. never seen before          -> "new"
 *   2. closed -> open             -> "reopened"
 *   3. title changed              -> "title_changed"
 *
 * Also handles closing: an open posting missing from `missesBeforeClosed`
 * consecutive SUCCESSFUL scrapes is marked closed (a failed scrape never
 * closes anything).
 */
export function applyScrape(
  db: Database.Database,
  company: string,
  scraped: ScrapedJob[],
  opts: { scrapeSucceeded: boolean; missesBeforeClosed: number; now?: Date }
): ChangeEvent[] {
  const now = (opts.now ?? new Date()).toISOString();
  const events: ChangeEvent[] = [];

  const getByUrl = db.prepare("SELECT * FROM jobs WHERE url = ?");
  const insert = db.prepare(`
    INSERT INTO jobs (company, title, location, url, first_seen, last_checked, status, hash, is_2027, miss_count)
    VALUES (@company, @title, @location, @url, @first_seen, @last_checked, 'open', @hash, @is_2027, 0)
  `);
  const update = db.prepare(`
    UPDATE jobs SET title=@title, location=@location, last_checked=@last_checked,
      status='open', hash=@hash, is_2027=@is_2027, miss_count=0, closed_at=NULL
    WHERE url=@url
  `);

  const seenUrls = new Set<string>();

  const txn = db.transaction(() => {
    for (const job of dedupe(scraped)) {
      seenUrls.add(job.url);
      const hash = jobHash({
        company: job.company,
        title: job.title,
        location: job.location,
        url: job.url,
        status: "open",
      });
      const existing = getByUrl.get(job.url) as JobRow | undefined;

      if (!existing) {
        insert.run({
          company: job.company,
          title: job.title,
          location: job.location,
          url: job.url,
          first_seen: now,
          last_checked: now,
          hash,
          is_2027: job.is2027 ? 1 : 0,
        });
        const row = getByUrl.get(job.url) as JobRow;
        events.push({ type: "new", job: row });
        continue;
      }

      const wasClosed = existing.status === "closed";
      const titleChanged =
        existing.title.trim().toLowerCase() !== job.title.trim().toLowerCase();

      update.run({
        title: job.title,
        location: job.location,
        last_checked: now,
        hash,
        is_2027: job.is2027 ? 1 : 0,
        url: job.url,
      });
      const row = getByUrl.get(job.url) as JobRow;

      if (wasClosed) {
        events.push({ type: "reopened", job: row });
      } else if (titleChanged) {
        events.push({ type: "title_changed", job: row, previousTitle: existing.title });
      }
      // unchanged open posting -> no event (last_checked still refreshed)
    }

    // Close postings that keep disappearing from successful scrapes.
    if (opts.scrapeSucceeded) {
      const openRows = db
        .prepare("SELECT * FROM jobs WHERE company = ? AND status = 'open'")
        .all(company) as JobRow[];
      const bumpMiss = db.prepare("UPDATE jobs SET miss_count = miss_count + 1, last_checked=? WHERE id = ?");
      const close = db.prepare(
        "UPDATE jobs SET status='closed', closed_at=?, last_checked=? WHERE id = ?"
      );
      for (const row of openRows) {
        if (seenUrls.has(row.url)) continue;
        if (row.miss_count + 1 >= opts.missesBeforeClosed) {
          close.run(now, now, row.id);
        } else {
          bumpMiss.run(now, row.id);
        }
      }
    }
  });
  txn();

  return events;
}

function dedupe(jobs: ScrapedJob[]): ScrapedJob[] {
  const map = new Map<string, ScrapedJob>();
  for (const j of jobs) {
    if (!map.has(j.url)) map.set(j.url, j);
  }
  return [...map.values()];
}

/** Data for the daily summary. */
export interface SummaryData {
  companiesChecked: number;
  newToday: { company: string; title: string }[];
  stillOpen: number;
  closedToday: number;
}

export function buildSummaryData(
  db: Database.Database,
  companiesChecked: number,
  timezone: string,
  now: Date = new Date()
): SummaryData {
  const todayLocal = now.toLocaleDateString("en-CA", { timeZone: timezone });

  const all = db.prepare("SELECT * FROM jobs").all() as JobRow[];
  const localDay = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone }) : "";

  const newToday = all
    .filter((r) => localDay(r.first_seen) === todayLocal)
    .map((r) => ({ company: r.company, title: r.title }));
  const stillOpen = all.filter((r) => r.status === "open").length;
  const closedToday = all.filter(
    (r) => r.status === "closed" && localDay(r.closed_at) === todayLocal
  ).length;

  return { companiesChecked, newToday, stillOpen, closedToday };
}
