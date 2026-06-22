// Core types shared across prompttest.

export type AssertionType =
  | "contains" | "not-contains" | "contains-any" | "contains-all"
  | "regex" | "equals" | "iequals"
  | "is-json" | "json-schema"
  | "max-words" | "max-tokens" | "latency-under" | "cost-under"
  | "llm-judge";

export interface Assertion {
  type: AssertionType;
  value?: unknown;          // string | string[] | number | object, depending on type
  rubric?: string;          // for llm-judge
}

export interface TestCase {
  name: string;
  vars?: Record<string, string>;
  assert: Assertion[];
}

export interface Suite {
  file: string;
  provider: string;         // "anthropic" (default/only in v1)
  model: string;
  prompt: string;           // may contain {{var}} placeholders
  system?: string;
  maxTokens?: number;
  tests: TestCase[];
}

export interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
}

export interface AssertionResult {
  type: AssertionType;
  pass: boolean;
  message: string;
}

export interface TestResult {
  suite: string;
  name: string;
  pass: boolean;
  output: string;
  latencyMs: number;
  costUsd: number;
  assertions: AssertionResult[];
  error?: string;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  costUsd: number;
  ranAt: string;
  mock: boolean;
  results: TestResult[];
}
