import { z } from "zod";
import type { Assertion, AssertionResult, ProviderResult } from "../types.js";
import { judge } from "../judge.js";
import { costUsd, isMock } from "../providers/anthropic.js";

const asStr = (v: unknown) => String(v ?? "");
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [String(v ?? "")]);
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Evaluate a single assertion against the model output. */
export async function evaluate(a: Assertion, out: ProviderResult): Promise<AssertionResult> {
  const text = out.text;
  const lc = text.toLowerCase();
  const ok = (pass: boolean, message: string): AssertionResult => ({ type: a.type, pass, message });

  // Mock mode = pipeline smoke test only (no real model output to evaluate).
  if (isMock()) return ok(true, "skipped (mock mode)");

  switch (a.type) {
    case "contains":
      return ok(text.includes(asStr(a.value)), `contains "${asStr(a.value)}"`);
    case "not-contains":
      return ok(!text.includes(asStr(a.value)), `does not contain "${asStr(a.value)}"`);
    case "contains-any": {
      const arr = asArr(a.value);
      return ok(arr.some((v) => lc.includes(v.toLowerCase())), `contains any of [${arr.join(", ")}]`);
    }
    case "contains-all": {
      const arr = asArr(a.value);
      const missing = arr.filter((v) => !lc.includes(v.toLowerCase()));
      return ok(missing.length === 0, missing.length ? `missing: [${missing.join(", ")}]` : `contains all`);
    }
    case "regex": {
      let pat = asStr(a.value);
      let flags = "";
      const inline = pat.match(/^\(\?([a-z]+)\)/); // support (?i)… inline flags (JS doesn't natively)
      if (inline) { flags = inline[1]; pat = pat.slice(inline[0].length); }
      try {
        return ok(new RegExp(pat, flags).test(text), `matches /${pat}/${flags}`);
      } catch (e) {
        return ok(false, `invalid regex: ${(e as Error).message}`);
      }
    }
    case "equals":
      return ok(text.trim() === asStr(a.value).trim(), `equals expected`);
    case "iequals":
      return ok(text.trim().toLowerCase() === asStr(a.value).trim().toLowerCase(), `equals (case-insensitive)`);
    case "is-json":
      try { JSON.parse(text); return ok(true, "is valid JSON"); }
      catch { return ok(false, "output is not valid JSON"); }
    case "json-schema": {
      let obj: unknown;
      try { obj = JSON.parse(text); } catch { return ok(false, "output is not valid JSON"); }
      try {
        const schema = jsonSchemaToZod(a.value as Record<string, unknown>);
        const r = schema.safeParse(obj);
        return ok(r.success, r.success ? "matches schema" : r.error.issues.map((i) => i.message).join("; "));
      } catch (e) { return ok(false, `bad schema: ${(e as Error).message}`); }
    }
    case "max-words": {
      const n = wordCount(text);
      return ok(n <= Number(a.value), `${n} words (max ${a.value})`);
    }
    case "max-tokens":
      return ok(out.outputTokens <= Number(a.value), `${out.outputTokens} output tokens (max ${a.value})`);
    case "latency-under":
      return ok(out.latencyMs <= Number(a.value), `${out.latencyMs}ms (max ${a.value}ms)`);
    case "cost-under": {
      const c = costUsd(out.model, out.inputTokens, out.outputTokens);
      return ok(c <= Number(a.value), `$${c.toFixed(5)} (max $${a.value})`);
    }
    case "llm-judge": {
      const { pass, reason } = await judge(text, a.rubric ?? asStr(a.value));
      return ok(pass, `judge: ${reason}`);
    }
    default:
      return ok(false, `unknown assertion type "${(a as Assertion).type}"`);
  }
}

// Tiny JSON-schema → zod for the common {type:object, properties, required} shape.
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const t = schema.type as string | undefined;
  if (t === "object" || schema.properties) {
    const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required ?? []) as string[];
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(props)) {
      let zt = jsonSchemaToZod(v);
      if (!required.includes(k)) zt = zt.optional();
      shape[k] = zt;
    }
    return z.object(shape).passthrough();
  }
  if (t === "array") return z.array(schema.items ? jsonSchemaToZod(schema.items as Record<string, unknown>) : z.unknown());
  if (t === "string") return z.string();
  if (t === "number" || t === "integer") return z.number();
  if (t === "boolean") return z.boolean();
  return z.unknown();
}
