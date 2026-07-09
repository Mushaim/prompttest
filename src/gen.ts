import Anthropic from "@anthropic-ai/sdk";
import { stringify } from "yaml";

// THE DIFFERENTIATOR: turn a plain-English behavior spec + a prompt into a ready-to-edit
// YAML eval suite (representative cases + assertions + judge rubrics, incl. negative cases).
export async function generateSuite(opts: { prompt: string; spec: string; model?: string }): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("gen needs ANTHROPIC_API_KEY.");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    tools: [{
      name: "emit_suite",
      description: "Emit a prompttest test suite (test cases with assertions) for the given prompt and behavior spec.",
      input_schema: {
        type: "object",
        properties: {
          tests: {
            type: "array",
            description: "5-8 test cases including edge cases and at least one negative/should-handle-gracefully case.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "short descriptive test name" },
                vars: { type: "object", description: "values for the {{placeholders}} in the prompt", additionalProperties: { type: "string" } },
                assert: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["contains","not-contains","contains-any","contains-all","regex","is-json","max-words","llm-judge"] },
                      value: { description: "string or array, depending on type" },
                      rubric: { type: "string", description: "for llm-judge: what 'pass' means" },
                    },
                    required: ["type"],
                  },
                },
              },
              required: ["name", "assert"],
            },
          },
        },
        required: ["tests"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_suite" },
    messages: [{
      role: "user",
      content:
        `Write a thorough but concise test suite for this LLM prompt. Cover the happy path, edge cases, and ` +
        `at least one case where the input is empty/garbage/adversarial (the prompt should handle it gracefully). ` +
        `Prefer llm-judge with a clear rubric for qualitative checks, and deterministic assertions (contains, ` +
        `max-words, regex, is-json) where possible.\n\n` +
        `PROMPT (note the {{variables}}):\n"""\n${opts.prompt}\n"""\n\nBEHAVIOR SPEC:\n${opts.spec}`,
    }],
  });

  const tool = res.content.find((b) => b.type === "tool_use") as { input?: { tests: unknown[] } } | undefined;
  if (!tool?.input?.tests) throw new Error("gen: model returned no tests");

  const suite = {
    provider: "anthropic",
    model: opts.model ?? "claude-haiku-4-5",
    prompt: opts.prompt,
    tests: tool.input.tests,
  };
  return stringify(suite, { lineWidth: 0 });
}
