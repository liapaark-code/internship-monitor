import { createHash } from "crypto";

/** Stable content hash used to detect changes to a posting. */
export function jobHash(parts: {
  company: string;
  title: string;
  location: string;
  url: string;
  status: string;
}): string {
  const raw = [parts.company, parts.title, parts.location, parts.url, parts.status]
    .map((s) => (s || "").trim().toLowerCase())
    .join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
