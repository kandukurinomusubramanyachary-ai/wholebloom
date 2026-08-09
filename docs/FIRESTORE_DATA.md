# Bloom Firestore data and privacy model

This document describes the Firestore paths used by the current Bloom application and the protections present in `firestore.rules`. It contains no production identifiers or user data.

## Ownership boundary

All signed-in Bloom application records live below `/users/{uid}`. Access requires Firebase Authentication and `request.auth.uid == uid`. An unauthenticated client cannot read or write these records, and one signed-in user cannot access another user's paths.

The rule on `/users/{uid}` does not implicitly grant access to subcollections. Each active subcollection has its own owner check. Deletes are also owner-only.

## Active Firestore paths

| Data | Firestore path | Document identity | Current rule behaviour |
| --- | --- | --- | --- |
| Root profile | `/users/{uid}` | One document per Firebase UID | Owner read/write. The current client persists the profile payload, converts its display `name` to `firstName`, and adds `updatedAt`. This root document is not field-allowlisted by the current rules. |
| Cycle logs | `/users/{uid}/cycleLogs/{startDate}` | The document ID is the local `YYYY-MM-DD` period start date | Owner read/delete; owner create/update only when the cycle-log schema is valid. The stored `date` and `startDate` must match. |
| Check-ins | `/users/{uid}/checkIns/{date}` | The document ID is the local `YYYY-MM-DD` check-in date | Owner read/delete; owner create/update only when the check-in schema is valid. |
| Diet profile | `/users/{uid}/dietProfile/main` | The only writable profile ID is `main` | Owner read/delete; owner create/update only for `main` and a valid Diet profile. |
| Meal logs | `/users/{uid}/mealLogs/{mealId}` | The record `id` must equal `{mealId}` | Owner read/delete; owner create/update only for a valid meal log. |
| Meal reflections | `/users/{uid}/mealReflections/{mealId}` | The document ID is the related meal ID; `mealId` and `mealLogId` must both identify that meal | Owner read/delete; owner create/update only for a valid reflection. |
| Diet observations | `/users/{uid}/dietObservations/{observationId}` | The record `id` must equal `{observationId}` | Owner read/delete; owner create/update only for a valid non-causal observation. |
| Meg conversations | `/users/{uid}/megConversations/{conversationId}` | Conversation ID supplied by the Meg service | Owner read/write. The current rules do not field-allowlist conversation documents. |
| Meg messages | `/users/{uid}/megConversations/{conversationId}/messages/{messageId}` | Message ID supplied by the Meg service | Owner read/write. The current rules do not field-allowlist message documents. |

## Stored shapes and validation

The lists below are the fields accepted by the current schema rules. Optional fields may be omitted or `null` only where the helper used by the rule explicitly permits `null`.

### Cycle logs

Allowed fields are `id`, `date`, `startDate`, `endDate`, `flow`, `source`, `createdAt`, and `updatedAt`.

- `date`, `startDate`, and `updatedAt` are required; `date` must equal `startDate`.
- Date strings must have the `YYYY-MM-DD` shape. The rule checks shape, not calendar semantics.
- `flow`, when present, is limited to `none`, `spotting`, `light`, `medium`, or `heavy`.
- `source`, when present, is limited to `manual` or `checkin`.
- IDs and strings have bounded lengths; `updatedAt` must be a Firestore timestamp.

### Check-ins

Allowed fields are `id`, `date`, `flow`, `symptoms`, `symptomSeverity`, `mood`, `energy`, `sleep`, `sleepDuration`, `sleepQuality`, `pain`, `cravings`, `water`, `stress`, `movement`, `movementNote`, `medicationTaken`, `medicationName`, `medication`, `notes`, `cycleDay`, `createdAt`, and `updatedAt`.

- `date` and `updatedAt` are required.
- List and map sizes are capped, including at most 40 symptoms and 40 symptom-severity entries.
- Numeric values are bounded: energy, pain, and stress are 0–10; sleep values are 0–24; water is 0–50; cycle day is 1–500.
- Notes are limited to 4,000 characters; movement text is limited to 500 characters; medication and other short strings have smaller limits.
- Flow uses the same fixed values as cycle logs. Unknown fields are rejected.

### Diet profile

Allowed fields are `eatingPreference`, `allergies`, `intolerances`, `dislikedFoods`, `religiousExclusions`, `culturalExclusions`, `cookingSetup`, `timeAvailable`, `budget`, `goals`, `recentIngredients`, `favouriteIngredients`, `favoriteIngredients`, `savedSuggestions`, `dismissedObservationIds`, `deletedMealIds`, `createdAt`, and `updatedAt`.

- Preference strings are bounded.
- Allergy, intolerance, dislike, religious-exclusion, and cultural-exclusion lists are capped at 30 entries each.
- Goals, recent ingredients, favourite/favorite ingredients, and saved suggestions are capped at 20 entries each.
- Dismissed observation IDs are capped at 50, and deleted-meal tombstones are capped at 100.
- `updatedAt` is required and must be a Firestore timestamp. Unknown fields are rejected.

### Meal logs

Allowed fields are `id`, `mealId`, `timestamp`, `date`, `name`, `mealType`, `ingredients`, `selectedSuggestionType`, `suggestionType`, `suggestionSource`, `source`, `hungerBefore`, `symptoms`, `notes`, `cycleContextReference`, `creationPlatform`, `schemaVersion`, `protein`, `fibre`, `produce`, `skipped`, `favourite`, `favorite`, `tags`, `observation`, `fullness`, `energyAfter`, `photoUri`, `afterMealReflection`, `reflection`, `reflectionUpdatedAt`, `createdAt`, and `updatedAt`.

- `id`, `date`, `name`, and `updatedAt` are required. The ID is capped at 160 characters, the name at 240, and the record ID must match the Firestore document ID.
- Ingredients are capped at 60 entries, symptoms at 40, and tags at 30.
- Hunger is bounded to 0–10, schema version to 1–20, and notes to 4,000 characters.
- Boolean balance/favourite/skipped flags, bounded reflection/context maps, bounded strings, and timestamps are type-checked. Unknown fields are rejected.

### Meal reflections

Allowed fields are `id`, `mealId`, `mealLogId`, `outcome`, `outcomes`, `recordedAt`, `createdAt`, and `updatedAt`.

- `id`, `mealId`, `mealLogId`, `outcome`, and `updatedAt` are required.
- `mealLogId` must equal `mealId`, and `mealId` must equal the reflection document ID.
- IDs and outcome strings are bounded; the outcomes list is capped at 10 entries. Unknown fields are rejected.

### Diet observations

Allowed fields are `id`, `text`, `status`, `outcome`, `ingredient`, `sampleSize`, `minimumSampleSize`, `matchingCount`, `sourceMealIds`, `isCausal`, `dismissed`, `createdAt`, and `updatedAt`.

- `id`, `isCausal`, and `updatedAt` are required. The record ID must match the document ID.
- `isCausal` must be `false`; Bloom stores these as descriptive observations, not causal claims.
- Sample counts are bounded, source meal IDs are capped at 100, and text/string lengths are capped. Unknown fields are rejected.

### Root profile and Meg

The root profile, Meg conversation, and Meg message paths currently enforce authentication and ownership but not field-level schemas. The active client reads the Meg message fields `role`, `text` (or legacy `content`), `createdAt`, `feedback`, `safety`, and `source`, and conversation metadata including `title`, `mode`/`supportMode`, `language`, timestamps, and `messageCount`. This describes client consumption; it is not a rules allowlist.

## UID-scoped device storage and local-first behaviour

Bloom's AsyncStorage records use versioned, UID-scoped keys of the form `@bloom_user:v1:{encodedUid}:{recordKey}`. A signed-in UID is required before a scoped key can be read or written. The app resets its in-memory state when the authenticated UID changes and clears the active storage scope on cleanup, preventing one account's device mirror from being reused by another account.

- Diet is local-first. Meals and the Diet profile inside settings are immediately usable from UID-scoped device storage, then merged with the same UID's Firestore records in the background.
- Merge decisions use record timestamps. A hydration revision and active-UID check prevent a late cloud read from overwriting a newer local Diet edit or data from a newly selected account.
- `deletedMealIds` is the implemented meal-deletion tombstone list. It is retained in the local Diet profile and synced to `/users/{uid}/dietProfile/main`; hydration filters matching local and remote meals and attempts the remote deletions again. This prevents an offline-deleted meal from reappearing after sync.
- Dismissed Diet observations are represented by `dismissedObservationIds` in the Diet profile and by the observation document's `dismissed` flag.
- Meg conversations have a UID-scoped local queue/mirror so pending or failed delivery state can survive a restart. Firestore/the Meg service remains the account source of truth; local and remote conversations are merged only within the active UID scope.
- Malformed local JSON is removed and treated as missing instead of being loaded into application state. Legacy UID-scoped keys are migrated to the versioned key on read.

## Waitlist separation

`/bloom_waitlist/{document}` is outside the signed-in `/users/{uid}` model and was not migrated or linked to a Bloom account by this data hardening work. Its rules remain unchanged:

- A public client may create only the existing waitlist shape: `firstName`, a syntactically valid `email`, `optionalContact`, `answers`, affirmative `consent`, `interestScore`, `interestLevel`, `source`, and `createdAt` equal to the server request time.
- Clients, including signed-in app users, cannot read, update, or delete waitlist documents.
- A narrow server-side eligibility helper remains in the repository, but the current Node app does not mount `/api/beta/check-email`, and the Beta access screen is not part of the active navigation. The automated suite verifies this disconnected state. If that flow is deliberately restored later, the helper uses a Firebase Admin equality query for one normalized email and returns only eligibility; the frontend never downloads the collection. A waitlist match is not Firebase Authentication, does not grant Firestore access, and does not create or open a Bloom user account.

## Deployment and verification status

- `firestore.rules` was edited locally as part of this hardening work.
- The rules have **not** been deployed to Firebase.
- The Firestore emulator test suite is **BLOCKED** in this environment because Java is absent (`spawn java ENOENT`). This is not reported as a passing rules test.
- Before release, install a supported Java runtime, run the Firestore emulator tests, review the results, and deploy the reviewed rules through the intended Firebase release process.
