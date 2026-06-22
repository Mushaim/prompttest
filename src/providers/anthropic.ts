import Anthropic from "@anthropic-ai/sdk";
import { render } from "../render.js";
import type { ProviderResult, Suite, TestCase } from "../types.js";

// $ per 1M tokens (input, output). Used for cost assertions/estimates.
const PRICING: Record<string, [number, number]> = {
  "claude-haiku-4-5": [1, 5],
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-4-8": [5, 25],
};

export function costUsd(model: string, inTok: number, outTok: number): number {
  const [pin, pout] = PRICING[model] ?? PRICING["claude-haiku-4-5"];
  return (inTok * pin + outTok * pout) / 1_000_000;
}

export function isMock(): boolean {
  return process.env.PROMPTTEST_MOCK === "1" || !process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Run one test case's prompt through the model (or a deterministic mock). */
export async function callModel(suite: Suite, test: TestCase): Promise<ProviderResult> {
  const prompt = render(suite.prompt, test.vars ?? {});
  const system = suite.system ? render(suite.system, test.vars ?? {}) : undefined;
  const maxTokens = suite.maxTokens ?? 1024;
  const start = Date.now();

  if (isMock()) {
    // Deterministic echo so the pipeline (and example assertions on input keywords) run keyless.
    const text = `[mock] ${prompt.slice(0, 400)}`.trim();
    return { text, inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(text.length / 4), latencyMs: Date.now() - start, model: suite.model };
  }

  const res = await getClient().messages.create({
    model: suite.model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
  return {
    text,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    latencyMs: Date.now() - start,
    model: suite.model,
  };
}
