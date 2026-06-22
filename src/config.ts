import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { Suite } from "./types.js";

const assertionSchema = z.object({
  type: z.enum([
    "contains", "not-contains", "contains-any", "contains-all",
    "regex", "equals", "iequals", "is-json", "json-schema",
    "max-words", "max-tokens", "latency-under", "cost-under", "llm-judge",
  ]),
  value: z.unknown().optional(),
  rubric: z.string().optional(),
});

const suiteSchema = z.object({
  provider: z.string().default("anthropic"),
  model: z.string().default("claude-haiku-4-5"),
  prompt: z.string(),
  system: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  tests: z.array(z.object({
    name: z.string(),
    vars: z.record(z.string()).optional(),
    assert: z.array(assertionSchema).min(1),
  })).min(1),
});

const SUFFIX = ".prompttest.yaml";

/** Recursively find *.prompttest.yaml under a path (file or dir). */
export function discover(target: string): string[] {
  const p = resolve(target);
  let st;
  try { st = statSync(p); } catch { return []; }
  if (st.isFile()) return p.endsWith(SUFFIX) || p.endsWith(".yaml") || p.endsWith(".yml") ? [p] : [];
  const out: string[] = [];
  for (const entry of readdirSync(p)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(p, entry);
    if (statSync(full).isDirectory()) out.push(...discover(full));
    else if (entry.endsWith(SUFFIX)) out.push(full);
  }
  return out.sort();
}

export function loadSuite(file: string): Suite {
  const raw = parse(readFileSync(file, "utf8"));
  const parsed = suiteSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid test file ${file}:\n${issues}`);
  }
  return { file, ...parsed.data };
}
