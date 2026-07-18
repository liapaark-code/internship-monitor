import { log } from "./logger";

/**
 * Minimal robots.txt checker (User-agent: * rules only).
 * Fails OPEN (allows) if robots.txt can't be fetched or parsed —
 * we log the failure instead of blocking the whole run.
 * Results are cached per-host for the process lifetime.
 */

const cache = new Map<string, { disallow: string[]; allow: string[] }>();

async function fetchRules(origin: string): Promise<{ disallow: string[]; allow: string[] }> {
  const cached = cache.get(origin);
  if (cached) return cached;

  const rules = { disallow: [] as string[], allow: [] as string[] };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${origin}/robots.txt`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      let applies = false;
      for (const rawLine of text.split("\n")) {
        const line = rawLine.split("#")[0].trim();
        if (!line) continue;
        const [keyRaw, ...rest] = line.split(":");
        const key = keyRaw.trim().toLowerCase();
        const value = rest.join(":").trim();
        if (key === "user-agent") {
          applies = value === "*";
        } else if (applies && key === "disallow" && value) {
          rules.disallow.push(value);
        } else if (applies && key === "allow" && value) {
          rules.allow.push(value);
        }
      }
    }
  } catch {
    log(`robots.txt unavailable for ${origin}; proceeding politely.`);
  }
  cache.set(origin, rules);
  return rules;
}

function matches(pathname: string, rule: string): boolean {
  // Support trailing * wildcards and $ anchors loosely.
  const cleaned = rule.replace(/\$$/, "");
  if (cleaned.includes("*")) {
    const re = new RegExp(
      "^" + cleaned.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")
    );
    return re.test(pathname);
  }
  return pathname.startsWith(cleaned);
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const rules = await fetchRules(parsed.origin);
  const pathname = parsed.pathname + parsed.search;

  // Longest-match wins (Google-style): find most specific allow/disallow.
  let best: { type: "allow" | "disallow"; len: number } | null = null;
  for (const r of rules.allow) {
    if (matches(pathname, r) && (!best || r.length > best.len)) {
      best = { type: "allow", len: r.length };
    }
  }
  for (const r of rules.disallow) {
    if (matches(pathname, r) && (!best || r.length > best.len)) {
      best = { type: "disallow", len: r.length };
    }
  }
  return !best || best.type === "allow";
}
