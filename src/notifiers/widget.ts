import * as fs from "fs";
import * as path from "path";
import type Database from "better-sqlite3";
import { loadConfig, projectPath } from "../config";
import { ChangeEvent } from "../database/diff";
import type { JobRow } from "../database/db";
import { log, logError } from "../utils/logger";

/**
 * The "mac widget" notifier: writes status.json — the live feed that both
 * the glass dashboard (Cowork artifact) and the Übersicht desktop widget read.
 * When running on GitHub Actions the file is committed back to the repo, so
 * the widgets can poll the raw.githubusercontent.com URL.
 */

export interface WidgetFeed {
  generatedAt: string;
  timezone: string;
  companiesMonitored: number;
  counts: { open: number; new24h: number; closed24h: number; summer2027: number };
  recentEvents: {
    type: string;
    company: string;
    title: string;
    location: string;
    url: string;
    firstSeen: string;
    is2027: boolean;
    at: string;
  }[];
  openJobs: {
    company: string;
    title: string;
    location: string;
    url: string;
    firstSeen: string;
    is2027: boolean;
  }[];
  companies: { name: string; openCount: number; lastChecked: string | null }[];
}

const eventBuffer: (ChangeEvent & { at: string })[] = [];

export function recordWidgetEvent(event: ChangeEvent): void {
  eventBuffer.push({ ...event, at: new Date().toISOString() });
}

export function writeWidgetFeed(db: Database.Database): void {
  const cfg = loadConfig();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  const all = db.prepare("SELECT * FROM jobs").all() as JobRow[];
  const open = all.filter((r) => r.status === "open");

  // Merge this run's events with previously persisted ones so the feed
  // keeps history across runs.
  const previous = readPreviousEvents(cfg.widget.feedOutputPaths[0]);
  const merged = [
    ...eventBuffer.map((e) => ({
      type: e.type,
      company: e.job.company,
      title: e.job.title,
      location: e.job.location,
      url: e.job.url,
      firstSeen: e.job.first_seen,
      is2027: !!e.job.is_2027,
      at: e.at,
    })),
    ...previous,
  ]
    .filter((e, i, arr) => arr.findIndex((x) => x.url === e.url && x.type === e.type && x.at === e.at) === i)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, cfg.widget.maxRecentEvents);

  const companies = cfg.companies
    .filter((c) => c.enabled)
    .map((c) => {
      const rows = all.filter((r) => r.company === c.name);
      const lastChecked = rows.length
        ? rows.reduce((m, r) => (r.last_checked > m ? r.last_checked : m), rows[0].last_checked)
        : null;
      return {
        name: c.name,
        openCount: rows.filter((r) => r.status === "open").length,
        lastChecked,
      };
    });

  const feed: WidgetFeed = {
    generatedAt: now.toISOString(),
    timezone: cfg.schedule.timezone,
    companiesMonitored: companies.length,
    counts: {
      open: open.length,
      new24h: all.filter((r) => r.first_seen >= dayAgo).length,
      closed24h: all.filter((r) => r.status === "closed" && (r.closed_at || "") >= dayAgo).length,
      summer2027: open.filter((r) => r.is_2027).length,
    },
    recentEvents: merged,
    openJobs: open
      .sort((a, b) => (a.first_seen < b.first_seen ? 1 : -1))
      .map((r) => ({
        company: r.company,
        title: r.title,
        location: r.location,
        url: r.url,
        firstSeen: r.first_seen,
        is2027: !!r.is_2027,
      })),
    companies,
  };

  for (const rel of cfg.widget.feedOutputPaths) {
    try {
      const out = path.isAbsolute(rel) ? rel : projectPath(rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(feed, null, 2));
    } catch (err) {
      logError(`Widget feed write failed for ${rel}`, err);
    }
  }
  log("Widget feed updated.");
}

function readPreviousEvents(rel: string): WidgetFeed["recentEvents"] {
  try {
    const p = path.isAbsolute(rel) ? rel : projectPath(rel);
    const data = JSON.parse(fs.readFileSync(p, "utf-8")) as WidgetFeed;
    return data.recentEvents || [];
  } catch {
    return [];
  }
}
