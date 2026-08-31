# Benchmarking and load testing

## Deterministic benchmark

The repository contains 200 fixtures in `benchmarks/cases.json`, including emotional, PCOS basics, cycle, hormones, diet, cravings, sleep, movement, weight, fertility, symptom combinations, doctor prep, safety, medication boundaries, memory, follow-up, ambiguity, slang, typos, Indian English, and multi-turn cases.

```bash
npm run benchmark
npm run benchmark -- --out /tmp/meg-benchmark.json
```

This measures intent and route accuracy by category. It does not claim factual clinical quality.

## Live provider benchmark

With provider credentials in `.env`:

```bash
npm run benchmark -- --live --provider gemini --out /tmp/gemini.json
```

Live mode reports valid-output rate, TTFT, total latency, output-token estimates, deterministic quality dimensions (specificity, warmth, clarity, conciseness, safety, personality), and human-review placeholders for factual quality/memory relevance. It never prints the test conversation text. Run providers separately to compare them without treating one model as permanently best.

## Load test

Start the service, then run:

```bash
npm run load:test
npm run load:test -- --base-url http://127.0.0.1:8787 --levels 1,10,25,50 --rounds 2
```

The script measures p50/p95/p99 total latency, p50/p95 TTFT, and error rate for each concurrency level. It uses the stable “What is PCOS?” cacheable request, so run a second workload with cache disabled or a non-cacheable message when measuring provider capacity.

## Interpretation

Record environment, provider model IDs, prompt/router versions, and whether Ollama was available. Compare TTFT and completion separately. A local fallback response or cache hit should not be reported as cloud-provider performance.
