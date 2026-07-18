import type Database from "better-sqlite3";
import { loadConfig } from "./config";
import { buildSummaryData } from "./database/diff";

export function buildSummaryText(db: Database.Database): string {
  const cfg = loadConfig();
  const companies = cfg.companies.filter((c) => c.enabled).length;
  const data = buildSummaryData(db, companies, cfg.schedule.timezone);

  const lines: string[] = [
    "Internship Monitor Daily Summary",
    "Checked:",
    `${data.companiesChecked} companies`,
    "New jobs:",
    `${data.newToday.length}`,
  ];
  for (const j of data.newToday) {
    lines.push(j.company, j.title);
  }
  lines.push("Still Open:", `${data.stillOpen}`, "Closed Today:", `${data.closedToday}`);
  return lines.join("\n");
}
