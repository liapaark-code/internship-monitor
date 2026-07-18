import { loadConfig, loadSecrets } from "../config";
import { ChangeEvent } from "../database/diff";
import { log, logError } from "../utils/logger";
import { withRetry } from "../utils/retry";

function formatDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatSms(event: ChangeEvent): string {
  const tz = loadConfig().schedule.timezone;
  const { job } = event;
  const headline =
    event.type === "reopened"
      ? "Product Design Internship REOPENED!!!!"
      : event.type === "title_changed"
      ? "Internship Posting Updated!"
      : "Product Design Internship Open!!!!";

  const lines = [
    headline,
    "Company:",
    job.company,
    "Title:",
    job.title + (job.is_2027 ? "  [Summer 2027]" : ""),
  ];
  if (event.type === "title_changed" && event.previousTitle) {
    lines.push("Was:", event.previousTitle);
  }
  lines.push(
    "Location:",
    job.location || "See posting",
    "Apply:",
    job.url,
    "First Seen:",
    formatDate(job.first_seen, tz)
  );
  return lines.join("\n");
}

/** Sends the SMS via Twilio; DRY-RUN (logged only) when credentials are missing. */
export async function sendSms(event: ChangeEvent): Promise<boolean> {
  const secrets = loadSecrets();
  const body = formatSms(event);

  const configured =
    secrets.twilioSid && secrets.twilioToken && secrets.twilioFrom && secrets.notifyPhone;

  if (!configured || secrets.dryRun) {
    log("SMS DRY-RUN (no Twilio credentials) — message would be:");
    for (const line of body.split("\n")) log(`  | ${line}`);
    return true;
  }

  try {
    // Lazy import so the module isn't required in dry-run environments.
    const twilio = require("twilio");
    const client = twilio(secrets.twilioSid, secrets.twilioToken);
    await withRetry(
      () =>
        client.messages.create({
          body,
          from: secrets.twilioFrom,
          to: secrets.notifyPhone,
        }),
      { retries: 2, baseDelayMs: 2000, label: "Twilio SMS" }
    );
    log("SMS Sent.");
    return true;
  } catch (err) {
    logError("SMS failed", err);
    return false;
  }
}

export async function sendSmsText(body: string): Promise<boolean> {
  const secrets = loadSecrets();
  const configured =
    secrets.twilioSid && secrets.twilioToken && secrets.twilioFrom && secrets.notifyPhone;
  if (!configured || secrets.dryRun) {
    log("SMS DRY-RUN — daily summary would be:");
    for (const line of body.split("\n")) log(`  | ${line}`);
    return true;
  }
  try {
    const twilio = require("twilio");
    const client = twilio(secrets.twilioSid, secrets.twilioToken);
    await withRetry(
      () =>
        client.messages.create({ body, from: secrets.twilioFrom, to: secrets.notifyPhone }),
      { retries: 2, baseDelayMs: 2000, label: "Twilio SMS" }
    );
    log("SMS Sent.");
    return true;
  } catch (err) {
    logError("SMS failed", err);
    return false;
  }
}
