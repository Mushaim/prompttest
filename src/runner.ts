import { discover, loadSuite } from "./config.js";
import { callModel, costUsd, isMock } from "./providers/anthropic.js";
import { evaluate } from "./assertions/index.js";
import type { RunSummary, TestResult } from "./types.js";

// Run a list of async tasks with a concurrency cap.
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    let next;
    while ((next = queue.shift()) !== undefined) await fn(next);
  });
  await Promise.all(workers);
}

export async function run(target: string, concurrency = 4): Promise<RunSummary> {
  const files = discover(target);
  if (files.length === 0) throw new Error(`No *.prompttest.yaml files found under "${target}".`);

  const results: TestResult[] = [];
  for (const file of files) {
    const suite = loadSuite(file);
    const label = file.split("/").pop()!;
    await pool(suite.tests, concurrency, async (test) => {
      try {
        const out = await callModel(suite, test);
        const assertions = [];
        for (const a of test.assert) assertions.push(await evaluate(a, out));
        results.push({
          suite: label,
          name: test.name,
          pass: assertions.every((r) => r.pass),
          output: out.text,
          latencyMs: out.latencyMs,
          costUsd: costUsd(out.model, out.inputTokens, out.outputTokens),
          assertions,
        });
      } catch (e) {
        results.push({ suite: label, name: test.name, pass: false, output: "", latencyMs: 0, costUsd: 0, assertions: [], error: (e as Error).message });
      }
    });
  }

  const passed = results.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    costUsd: results.reduce((s, r) => s + r.costUsd, 0),
    ranAt: new Date().toISOString(),
    mock: isMock(),
    results: results.sort((a, b) => a.suite.localeCompare(b.suite) || a.name.localeCompare(b.name)),
  };
}
