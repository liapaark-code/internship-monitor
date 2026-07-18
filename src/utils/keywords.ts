import { loadConfig } from "../config";

export interface MatchResult {
  matches: boolean;
  is2027: boolean;
}

/**
 * Loose mode (default): title must contain a ROLE keyword AND a PROGRAM
 * keyword (intern/internship/student/university/2027...), and no exclude
 * keyword. Postings that explicitly mention 2027 are tagged.
 * Strict mode: additionally requires a 2027 season tag.
 */
export function matchTitle(title: string): MatchResult {
  const cfg = loadConfig().filtering;
  const t = ` ${title.toLowerCase()} `;

  const hasAny = (list: string[]) => list.some((k) => t.includes(k.toLowerCase()));

  const role = hasAny(cfg.roleKeywords);
  const program = hasAny(cfg.programKeywords);
  const excluded = hasAny(cfg.excludeKeywords);
  const is2027 = hasAny(cfg.seasonTags);

  let matches = role && program && !excluded;
  if (cfg.mode === "strict") matches = matches && is2027;

  return { matches, is2027 };
}
