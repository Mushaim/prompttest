<div align="center">

# prompttest

### Unit tests for your LLM prompts.

Write tests in YAML (or **auto-generate them from a sentence**), run them locally or in CI,
and stop prompts from silently regressing.

[![npm](https://img.shields.io/npm/v/prompttest.svg)](https://www.npmjs.com/package/prompttest)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-43853d.svg)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

---

## The problem

You change one line of a prompt to fix a bug — and quietly break three other things. There were no
tests, so nobody notices until a user does. Application code has tests and CI; **prompts don't.**

`prompttest` fixes that:

- ✅ **Test prompts like code** — assertions + an LLM-as-judge, in plain YAML.
- 🤖 **Generate the tests for you** — describe the behavior in a sentence; it writes the suite. *(This is the part other tools don't have.)*
- 🚦 **Gate your CI** — a GitHub Action runs the tests on every PR, comments the results, and fails the build on a regression.
- 💸 **Cheap & fast** — runs on a small model by default; a full suite costs a fraction of a cent.

---

## Quick start

```bash
npm i -D prompttest
export ANTHROPIC_API_KEY=sk-ant-…

npx prompttest init      # creates example.prompttest.yaml
npx prompttest run       # runs every *.prompttest.yaml
```

```text
✓ PASS  summarizer › concise summary            (848ms)
✓ PASS  summarizer › handles empty input        (698ms)
✓ PASS  classifier › clear positive             (1065ms)
✗ FAIL  classifier › stays on label
    · max-words — 21 words (max 3)
    · llm-judge — Answer is a sentence, not a single label.

4/5 passed  ·  ~$0.0006
```
Exit code is non-zero when anything fails — so it works as a CI gate out of the box.

---

## A test file

`*.prompttest.yaml` — the prompt under test, plus cases and assertions:

```yaml
provider: anthropic
model: claude-haiku-4-5
prompt: |
  Summarize the following text in one sentence:
  {{input}}

tests:
  - name: concise summary
    vars: { input: "The cat sat on the mat on a warm, sunny afternoon." }
    assert:
      - { type: contains-any, value: ["cat"] }
      - { type: max-words, value: 30 }
      - { type: llm-judge, rubric: "A single concise sentence capturing the main idea." }

  - name: handles empty input
    vars: { input: "" }
    assert:
      - { type: llm-judge, rubric: "Says there's nothing to summarize instead of inventing content." }
```

`{{variables}}` in the prompt are filled from each test's `vars`.

---

## ✨ Don't want to write tests? Generate them.

The #1 reason teams skip evals is that writing them is tedious. So describe what the prompt *should* do,
and `prompttest` drafts the whole suite — happy paths, edge cases, and adversarial inputs, with
ready-to-edit assertions and judge rubrics:

```bash
npx prompttest gen \
  --prompt prompt.txt \
  --spec "must return valid JSON with company and amount; handle a line with no amount; amount must be a number"
# → generated.prompttest.yaml  (review it, tweak it, commit it)
```

> Real example: pointed at a naive "extract invoice data as JSON" prompt, the generated suite immediately
> caught that the model returned the amount as a **string** (`"$1,250.00"`) and wrapped the JSON in
> **markdown fences** — bugs a hand-written suite would likely have missed.

---

## Assertions

| Category | Types |
| --- | --- |
| **Text** | `contains` · `not-contains` · `contains-any` · `contains-all` · `regex` (supports `(?i)`) · `equals` · `iequals` |
| **Structure** | `is-json` · `json-schema` |
| **Budgets** | `max-words` · `max-tokens` · `latency-under` · `cost-under` |
| **Semantic** | `llm-judge` — a rubric scored by a model (treats output as untrusted; injection-safe) |

---

## CI in 30 seconds

Copy `.github/workflows/prompttest.yml` into your repo and add `ANTHROPIC_API_KEY` as an Actions secret.
On every PR it runs your prompt tests, **posts a comment** with the results table, and **fails the check**
if anything regressed.

Prefer a local guardrail? Snapshot a baseline and compare:

```bash
npx prompttest run --save-baseline      # record current pass/fail
# …edit a prompt…
npx prompttest run --compare-baseline   # exits non-zero if a previously-passing test now fails
```

---

## No API key? Mock mode

Run with `PROMPTTEST_MOCK=1` (or simply no key) and prompttest executes the full pipeline against a
deterministic stub — a fast, free **smoke test** for CI that doesn't spend tokens. Real assertions need a key.

---

## CLI reference

```text
prompttest [run] [path]              run *.prompttest.yaml under path (default ".")
  --reporter console|markdown|json   output format
  --out <file>                       also write the report to a file
  --concurrency <n>                  parallel tests (default 4)
  --save-baseline | --compare-baseline

prompttest gen --prompt <file> --spec "<text>" | --spec-file <file>
  --out <file>     where to write the YAML       --model <id>   model the suite targets

prompttest init                      scaffold a sample test file
```

---

## How it compares

[`promptfoo`](https://github.com/promptfoo/promptfoo) is the established, feature-rich tool for LLM
evals. `prompttest` is intentionally smaller and opinionated, with one thing it doesn't do:
**generate the eval suite for you from a plain-English spec**, plus zero-config PR gating. If you want a
deep eval platform, use promptfoo; if you want to go from "I have a prompt" to "I have CI-gated tests" in
two minutes, use prompttest.

---

## Roadmap / Contributing

PRs welcome — good first issues:
- Additional providers (OpenAI, Gemini) behind the existing `providers/` interface
- More assertions (`semantic-similarity`, `starts-with`, custom JS)
- An HTML report

```bash
git clone https://github.com/Mushaim/prompttest && cd prompttest
npm install && npm run build
PROMPTTEST_MOCK=1 node dist/cli.js run examples
```

---

MIT © [Mushaim Khan](https://github.com/Mushaim) — *because prompts deserve tests too.*
