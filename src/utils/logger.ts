import * as fs from "fs";
import * as path from "path";
import { loadConfig, loadSecrets, projectPath } from "../config";

/**
 * Logger that mirrors the requested log style:
 *   07:00  Checking Google...
 *   07:03  New Internship Found.
 *   07:03  SMS Sent.
 * Writes to console and to logs/YYYY-MM-DD.log (in the configured timezone).
 */

function tz(): string {
  try {
    return loadConfig().schedule.timezone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

function nowParts(): { hm: string; date: string; full: string } {
  const d = new Date();
  const timeZone = tz();
  const hm = d.toLocaleTimeString("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = d.toLocaleDateString("en-CA", { timeZone }); // YYYY-MM-DD
  const full = d.toLocaleTimeString("en-US", { timeZone, hour12: false });
  return { hm, date, full };
}

function logDirPath(): string {
  const dir = loadSecrets().logDir;
  return path.isAbsolute(dir) ? dir : projectPath(dir);
}

function writeLine(line: string): void {
  const { date } = nowParts();
  const dir = logDirPath();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${date}.log`), line + "\n");
  } catch {
    /* logging must never crash the monitor */
  }
}

export function log(message: string): void {
  const { hm } = nowParts();
  const line = `${hm}  ${message}`;
  console.log(line);
  writeLine(line);
}

export function logError(message: string, err?: unknown): void {
  const detail =
    err instanceof Error ? `${err.message}` : err !== undefined ? String(err) : "";
  const suffix = detail ? ` (${detail})` : "";
  const { hm } = nowParts();
  const line = `${hm}  ERROR: ${message}${suffix}`;
  console.error(line);
  writeLine(line);
}
