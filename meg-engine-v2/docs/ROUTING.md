# Routing

Meg does not pay for an LLM classifier on every turn. `classifyIntentDetailed` is deterministic and returns:

```json
{
  "intent": "cycle_question",
  "complexity": "high",
  "confidence": 0.91,
  "reasons": ["multiple health signals", "temporal or numeric data"]
}
```

`routeRequest` adds `route` and `preferredProviders`. Reasons remain internal and are never returned to normal clients.

## Intent signals

- `emotional`: feelings, overwhelm, anxiety, sadness, venting
- `casual`: greetings, thanks, short social turns, unknown low-signal text
- `simple_health`: basic definitions such as “What is PCOS?”
- `complex_health`: multi-signal or explanatory health questions
- `doctor_prep`: doctor, appointment, report, lab, or question checklist requests
- `cycle_question`: periods, cycle timing, ovulation, late or irregular cycles
- `diet_question`: food, cravings, meals, sugar, weight
- `symptom_question`: isolated symptom questions
- `safety`: deterministic safety categories

Dates, numeric values, multiple symptoms, mode overrides, and explanation language increase complexity. Safety is checked first and always wins.

## Logical routes

- `FAST`: emotional, casual, simple health, diet, short follow-ups
- `SMART`: complex health and cycle reasoning
- `DOCTOR`: appointment preparation
- `SAFETY`: urgent or boundary-sensitive safety paths
- `LOCAL`: explicit local mode

Run the 200-case deterministic suite with:

```bash
npm run benchmark
```

The benchmark reports per-category intent and route accuracy. Its cases are fixtures, not a clinical truth set; they must be reviewed and expanded with Bloom conversations before claiming a 95% production accuracy target.
