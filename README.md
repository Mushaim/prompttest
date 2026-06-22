# prompttest

**Test your LLM prompts like code.** Write tests in YAML (or auto-generate them from a plain-English
spec), run them in CI, and catch prompt regressions before they ship.

```bash
npx prompttest run            # run every *.prompttest.yaml
```

> Why: you tweak a prompt and *something else silently breaks*, because prompts have no tests.
> prompttest gives prompts a test suite, an LLM-as-judge, and a CI gate — and can **write the tests for you**.

---

## Quick start
```bash
npm i -D prompttest          # or: npx prompttest …
export ANTHROPIC_API_KEY=sk-ant-…
npx prompttest init          # creates example.prompttest.yaml
npx prompttest run           # runs it
```

A test file (`*.prompttest.yaml`):
```yaml
provider: anthropic
model: claude-haiku-4-5
prompt: |
  Summarize the following text in one sentence:
  {{input}}
tests:
  - name: concise summary
    vars: { input: "The cat sat on the mat. It was a sunny afternoon and the cat was happy." }
    assert:
      - { type: contains-any, value: ["cat"] }
      - { type: max-words, value: 30 }
      - { type: llm-judge, rubric: "A single concise sentence capturing the main idea." }
```
```
✓ PASS summarizer.prompttest.yaml › concise summary (848ms)
5/5 passed  ·  ~$0.0004
```

## ✨ Auto-generate the tests (`gen`)
Don't want to hand-write evals? Describe the behavior; prompttest drafts the suite (cases + assertions +
judge rubrics, including edge/adversarial cases) for you to review:
```bash
npx prompttest gen --prompt prompt.txt \
  --spec "must return valid JSON with company and amount; handle a line with no amount; amount must be a number"
# → generated.prompttest.yaml
```
In testing, this immediately surfaced real prompt weaknesses — amounts returned as strings (`"$1,250.00"`),
JSON wrapped in markdown fences — that a hand-written suite would've missed.

## Assertions
`contains` · `not-contains` · `contains-any` · `contains-all` · `regex` (supports `(?i)`) · `equals` ·
`iequals` · `is-json` · `json-schema` · `max-words` · `max-tokens` · `latency-under` · `cost-under` ·
`llm-judge` (rubric → pass/fail, injection-safe).

## CI gating
Drop in `.github/workflows/prompttest.yml` (included). On every PR it runs your prompt tests, **comments
the results**, and **fails the check** if anything broke. Add `ANTHROPIC_API_KEY` as a repo secret.

Track regressions locally too:
```bash
npx prompttest run --save-baseline       # snapshot current pass/fail
# …change a prompt…
npx prompttest run --compare-baseline    # exits non-zero if a passing test now fails
```

## Keyless mode
No API key (or `PROMPTTEST_MOCK=1`) → runs in **mock mode** (deterministic echo, judge auto-passes) so the
pipeline runs in CI smoke checks without spending tokens.

## Flags
```
run [path]   --reporter console|markdown|json   --out <file>
             --concurrency <n>   --save-baseline   --compare-baseline
gen          --prompt <file>   --spec "<text>" | --spec-file <file>   --out <file>   --model <id>
```

## Roadmap / good first issues
- More providers (OpenAI, Gemini) behind the existing provider interface
- More assertion types (semantic-similarity, `starts-with`, custom JS)
- HTML report

MIT © Mushaim Khan · built because prompts deserve tests too.
