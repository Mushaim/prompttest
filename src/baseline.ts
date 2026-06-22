import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RunSummary } from "./types.js";

const BASELINE = ".prompttest/baseline.json";

export function saveBaseline(s: RunSummary): void {
  mkdirSync(dirname(BASELINE), { recursive: true });
  const map: Record<string, boolean> = {};
  for (const r of s.results) map[`${r.suite}›${r.name}`] = r.pass;
  writeFileSync(BASELINE, JSON.stringify(map, null, 2));
}

/** Tests that passed in the baseline but fail now = regressions. */
export function compareBaseline(s: RunSummary): string[] {
  if (!existsSync(BASELINE)) return [];
  const base: Record<string, boolean> = JSON.parse(readFileSync(BASELINE, "utf8"));
  const regressions: string[] = [];
  for (const r of s.results) {
    const key = `${r.suite}›${r.name}`;
    if (base[key] === true && !r.pass) regressions.push(key);
  }
  return regressions;
}
