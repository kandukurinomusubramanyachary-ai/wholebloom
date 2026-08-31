# Safety

Safety is deterministic and runs before intent/model routing. `src/safety/safetyRouter.js` has prioritized rules for:

- self-harm
- pregnancy emergency
- severe bleeding
- fainting
- chest pain
- severe pelvic pain
- urgent medical symptoms
- medication changes/dosage requests
- diagnosis requests

Each rule carries a priority and required behavior. Overlapping urgent rules are retained in internal rule matches; the legacy aggregate shape is preserved for existing callers.

Urgent categories use a deterministic response immediately. This prevents a provider outage, prompt failure, or unsafe generation from delaying the action recommendation. Non-urgent diagnosis and medication boundaries may be phrased by a provider, but always have a deterministic fallback.

The response guard checks generated text for:

- prompt/provider artifacts or instruction leakage
- unsafe diagnosis claims
- medication dosage or treatment-change instructions
- repeated output and excessive boilerplate
- more than one question
- missing action language in urgent safety replies

Certain diagnosis certainty claims are locally downgraded. Medication dosage/change instructions are fatal and replaced with a boundary-safe response. Routine messages never trigger a second LLM rewrite.

## False positives

Rules use contextual phrases rather than isolated words, so “I nearly died laughing” is not an emergency. “Bleeding” alone is not automatically urgent. The adversarial test suite should continue to grow with Bloom's reviewed examples.

This is a safety layer, not a medical device certification. It requires clinical review, regional emergency-resource policy, monitoring, and incident response before public launch.
