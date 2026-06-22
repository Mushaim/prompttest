#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import pc from "picocolors";
import { run } from "./runner.js";
import { generateSuite } from "./gen.js";
import { reportConsole } from "./report/console.js";
import { reportMarkdown } from "./report/markdown.js";
import { reportJson } from "./report/json.js";
import { saveBaseline, compareBaseline } from "./baseline.js";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const has = (args: string[], name: string) => args.includes(`--${name}`);

const HELP = `
prompttest — test your LLM prompts like code

Usage:
  prompttest [run] [path]        Run *.prompttest.yaml under path (default: ".")
  prompttest gen                 Generate a test suite from a prompt + plain-English spec
  prompttest init                Create a sample test file

Run flags:
  --reporter console|markdown|json   Output format (default: console)
  --out <file>                       Write the report to a file
  --concurrency <n>                  Parallel tests (default: 4)
  --save-baseline                    Save current results as the baseline
  --compare-baseline                 Fail if any test regressed vs the baseline

gen flags:
  --prompt <file>     File containing the prompt (with {{variables}})   [required]
  --spec "<text>"     Behavior spec, or --spec-file <file>              [required]
  --out <file>        Where to write the YAML (default: generated.prompttest.yaml)
  --model <id>        Model the suite should test (default: claude-haiku-4-5)

Env:
  ANTHROPIC_API_KEY   Your key. Without it (or with PROMPTTEST_MOCK=1), runs in mock mode.
`;

async function main() {
  const argv = process.argv.slice(2);
  if (has(argv, "help") || argv[0] === "-h" || argv[0] === "--help") { console.log(HELP); return; }

  const cmd = ["run", "gen", "init"].includes(argv[0]) ? argv[0] : "run";
  const rest = cmd === argv[0] ? argv.slice(1) : argv;

  if (cmd === "init") {
    const sample = `provider: anthropic
model: claude-haiku-4-5
prompt: |
  Summarize the following text in one sentence:
  {{input}}
tests:
  - name: concise summary
    vars: { input: "The cat sat on the mat. It was sunny. The cat was happy." }
    assert:
      - { type: contains-any, value: ["cat"] }
      - { type: max-words, value: 30 }
      - { type: llm-judge, rubric: "A single concise sentence capturing the main idea." }
`;
    writeFileSync("example.prompttest.yaml", sample);
    console.log(pc.green("Created example.prompttest.yaml — edit it, then run `prompttest`."));
    return;
  }

  if (cmd === "gen") {
    const promptFile = flag(rest, "prompt");
    const spec = flag(rest, "spec") ?? (flag(rest, "spec-file") ? readFileSync(flag(rest, "spec-file")!, "utf8") : undefined);
    if (!promptFile || !spec) { console.error(pc.red("gen requires --prompt <file> and --spec \"...\" (or --spec-file <file>)")); process.exit(2); }
    const prompt = readFileSync(promptFile, "utf8");
    const out = flag(rest, "out") ?? "generated.prompttest.yaml";
    console.log(pc.dim("Generating test suite…"));
    const yaml = await generateSuite({ prompt, spec, model: flag(rest, "model") });
    writeFileSync(out, yaml);
    console.log(pc.green(`Wrote ${out}`) + pc.dim(" — review/edit it, then run `prompttest`."));
    return;
  }

  // run
  const target = rest.find((a) => !a.startsWith("--")) ?? ".";
  const concurrency = Number(flag(rest, "concurrency") ?? 4);
  const reporter = flag(rest, "reporter") ?? "console";
  let summary;
  try {
    summary = await run(target, concurrency);
  } catch (e) {
    console.error(pc.red((e as Error).message));
    process.exit(2);
  }

  const rendered = reporter === "markdown" ? reportMarkdown(summary) : reporter === "json" ? reportJson(summary) : null;
  if (rendered !== null) console.log(rendered); else reportConsole(summary);
  const outFile = flag(rest, "out");
  if (outFile) writeFileSync(outFile, rendered ?? reportJson(summary));

  if (has(rest, "save-baseline")) { saveBaseline(summary); console.log(pc.dim("Saved baseline → .prompttest/baseline.json")); }
  let regressed = false;
  if (has(rest, "compare-baseline")) {
    const r = compareBaseline(summary);
    if (r.length) { regressed = true; console.log(pc.red(`\n${r.length} regression(s) vs baseline:`)); r.forEach((k) => console.log(pc.red("  ✗ " + k))); }
    else console.log(pc.green("\nNo regressions vs baseline."));
  }

  process.exit(summary.failed > 0 || regressed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
