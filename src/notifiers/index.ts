import { loadConfig } from "../config";
import { ChangeEvent } from "../database/diff";
import { sendDiscord, sendDiscordText } from "./discord";
import { sendSms, sendSmsText } from "./sms";
import { recordWidgetEvent } from "./widget";

/** Fan a change event out to every enabled channel. */
export async function notifyEvent(event: ChangeEvent): Promise<void> {
  const cfg = loadConfig().notifications;
  if (cfg.sms) await sendSms(event);
  if (cfg.discord) await sendDiscord(event);
  if (cfg.widget) recordWidgetEvent(event);
}

export async function notifySummary(text: string): Promise<void> {
  const cfg = loadConfig().notifications;
  if (cfg.sms) await sendSmsText(text);
  if (cfg.discord) await sendDiscordText(text);
}

export { writeWidgetFeed } from "./widget";
