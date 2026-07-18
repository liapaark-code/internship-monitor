import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ quiet: true });

export interface WorkdayConfig {
  host: string;
  tenant: string;
  site: string;
}

export interface CompanyConfig {
  name: string;
  scraper: string;
  enabled: boolean;
  urls: string[];
  pinnedUrls?: string[];
  searchTexts?: string[];
  workday?: WorkdayConfig;
}

export interface AppConfig {
  schedule: { checkCron: string; summaryCron: string; timezone: string };
  filtering: {
    mode: "loose" | "strict";
    roleKeywords: string[];
    programKeywords: string[];
    seasonTags: string[];
    excludeKeywords: string[];
  };
  notifications: {
    sms: boolean;
    discord: boolean;
    widget: boolean;
    notifyOnlyRoleMatches: boolean;
  };
  scraping: {
    maxRetries: number;
    baseDelayMs: number;
    navigationTimeoutMs: number;
    respectRobotsTxt: boolean;
    missesBeforeClosed: number;
    userAgent: string;
  };
  widget: { feedOutputPaths: string[]; maxRecentEvents: number };
  companies: CompanyConfig[];
}

export interface Secrets {
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  notifyPhone: string;
  discordWebhook: string;
  databasePath: string;
  logDir: string;
  dryRun: boolean;
}

const ROOT = path.resolve(__dirname, "..", "..");

export function projectPath(...parts: string[]): string {
  return path.join(ROOT, ...parts);
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  const file = projectPath("config", "config.json");
  const raw = fs.readFileSync(file, "utf-8");
  cachedConfig = JSON.parse(raw) as AppConfig;
  return cachedConfig;
}

export function loadSecrets(): Secrets {
  return {
    twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
    twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
    twilioFrom: process.env.TWILIO_FROM_NUMBER || "",
    notifyPhone: process.env.NOTIFY_PHONE_NUMBER || "",
    discordWebhook: process.env.DISCORD_WEBHOOK_URL || "",
    databasePath: process.env.DATABASE_PATH || "data/internships.db",
    logDir: process.env.LOG_DIR || "logs",
    dryRun: (process.env.DRY_RUN || "").toLowerCase() === "true",
  };
}
