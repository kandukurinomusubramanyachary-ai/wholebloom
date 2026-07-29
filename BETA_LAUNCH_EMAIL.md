# Bloom Beta launch email

This is a server-only admin campaign. It is separate from Firebase passwordless
authentication: the launch email opens the Bloom Beta access page and never
contains a Firebase sign-in link.

## Provider and environment

The current provider adapter uses Resend. Configure a verified sending domain
in Resend, keep open/click tracking disabled, and place these values in the
ignored `.env` file:

```dotenv
FIREBASE_PROJECT_ID=bloom-5da0f
BLOOM_BETA_URL=https://your-bloom-beta-domain.example
EMAIL_FROM_NAME=Bloom
EMAIL_FROM_ADDRESS=beta@your-verified-domain.example
EMAIL_PROVIDER_API_KEY=your-server-only-resend-key
```

Firebase Admin uses Application Default Credentials or
`GOOGLE_APPLICATION_CREDENTIALS`. Never use an `EXPO_PUBLIC` variable for
provider or Firebase Admin credentials.

## Safe commands

Read the complete waitlist, print the required summary and masked recipients,
but do not send or modify Firestore:

```powershell
npm run beta-email:dry-run
```

Query only one explicitly supplied waitlist email without sending or modifying
Firestore:

```powershell
npm run beta-email:dry-test -- --email approved@example.com
```

Send to one approved, eligible waitlist email:

```powershell
npm run beta-email:test -- --email approved@example.com --confirm
```

The successful test send is a real campaign delivery and marks matching
waitlist records as sent.

Send the complete eligible production batch:

```powershell
npm run beta-email:production -- --confirm
```

Production sends are sequential with a 600 ms delay by default. Override the
delay with `BETA_EMAIL_BATCH_DELAY_MS` or `--delay-ms`, from 250 to 10000 ms.

## Eligibility and delivery safety

A unique normalized email is eligible only when its email is valid, at least
one matching record has `consent === true`, and no matching record has
`betaEmailSent === true`.

The campaign:

- groups duplicate normalized email addresses;
- acquires a Firestore transaction-based lease before sending;
- uses a stable provider idempotency key containing only an email hash;
- updates all matching consenting records only after provider acceptance;
- stores only a safe failure code when sending fails;
- records no raw provider response, credential or email in the delivery ledger;
- masks recipient addresses in command output.

Successful waitlist records receive:

```text
betaEmailSent: true
betaEmailSentAt: server timestamp
betaEmailProviderId: provider message ID
```

Failed attempts receive:

```text
betaEmailLastError: safe error code
betaEmailLastAttemptAt: server timestamp
```

The private `bloom_beta_email_deliveries` collection supplies cross-process
claim and idempotency state. Provider acceptance is treated as sent; confirmed
inbox delivery would require a separate provider webhook.

## Tests

```powershell
npm run test:beta-email
```
