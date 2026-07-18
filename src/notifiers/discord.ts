import { loadConfig, loadSecrets } from "../config";
import { ChangeEvent } from "../database/diff";
import { log, logError } from "../utils/logger";
import { withRetry } from "../utils/retry";

const COLORS: Record<string, number> = {
  new: 0x2ecc71, // green
  reopened: 0x3498db, // blue
  title_changed: 0xf1c40f, // yellow
};

export async function sendDiscord(event: ChangeEvent): Promise<boolean> {
  const { discordWebhook } = loadSecrets();
  if (!discordWebhook) {
    log("Discord DRY-RUN (no webhook configured).");
    return true;
  }
  const tz = loadConfig().schedule.timezone;
  const { job } = event;
  const headline =
    event.type === "reopened"
      ? "🔓 Internship REOPENED"
      : event.type === "title_changed"
      ? "✏️ Posting title changed"
      : "🎉 New Product Design Internship!";

  const payload = {
    embeds: [
      {
        title: `${headline} — ${job.company}`,
        description: `**${job.title}**${job.is_2027 ? " `Summer 2027`" : ""}${
          event.previousTitle ? `\n~~${event.previousTitle}~~` : ""
        }`,
        url: job.url,
        color: COLORS[event.type] ?? 0x95a5a6,
        fields: [
          { name: "Location", value: job.location || "See posting", inline: true },
          {
            name: "First Seen",
            value: new Date(job.first_seen).toLocaleDateString("en-US", {
              timeZone: tz,
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
            inline: true,
          },
        ],
      },
    ],
  };

  try {
    await withRetry(
      async () => {
        const res = await fetch(discordWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
      },
      { retries: 2, baseDelayMs: 1500, label: "Discord" }
    );
    log("Discord Sent.");
    return true;
  } catch (err) {
    logError("Discord failed", err);
    return false;
  }
}

export async function sendDiscordText(content: string): Promise<boolean> {
  const { discordWebhook } = loadSecrets();
  if (!discordWebhook) {
    log("Discord DRY-RUN (no webhook configured).");
    return true;
  }
  try {
    await withRetry(
      async () => {
        const res = await fetch(discordWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "```\n" + content + "\n```" }),
        });
        if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
      },
      { retries: 2, baseDelayMs: 1500, label: "Discord" }
    );
    log("Discord Sent.");
    return true;
  } catch (err) {
    logError("Discord failed", err);
    return false;
  }
}
