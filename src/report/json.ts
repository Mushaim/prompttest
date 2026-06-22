import type { RunSummary } from "../types.js";
export function reportJson(s: RunSummary): string {
  return JSON.stringify(s, null, 2);
}
