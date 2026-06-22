import pc from "picocolors";
import type { RunSummary } from "../types.js";

export function reportConsole(s: RunSummary): void {
  for (const r of s.results) {
    const head = r.pass ? pc.green("✓ PASS") : pc.red("✗ FAIL");
    console.log(`${head} ${pc.dim(r.suite + " ›")} ${r.name} ${pc.dim(`(${r.latencyMs}ms)`)}`);
    if (r.error) console.log(`    ${pc.red("error:")} ${r.error}`);
    for (const a of r.assertions) {
      if (!a.pass) console.log(`    ${pc.red("·")} ${pc.dim(a.type)} — ${a.message}`);
    }
  }
  const line = `${s.passed}/${s.total} passed`;
  console.log("\n" + (s.failed === 0 ? pc.green(pc.bold(line)) : pc.red(pc.bold(line))) +
    pc.dim(`  ·  ~$${s.costUsd.toFixed(4)}${s.mock ? "  ·  MOCK MODE (no API key)" : ""}`));
}
