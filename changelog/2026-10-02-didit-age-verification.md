# Didit verifies age for uncensored mode

Before: the `AgeVerifier` port had only `manual_admin`, on in dev with
`UNCENSORED_DEV_MANUAL_VERIFICATION`. In production no verifier existed, so the
uncensored workspace stayed "Age verification coming soon".

Now:

- `uncensored-workspace/didit.ts`: Didit adapter (`/v3/session/`,
  `/decision/`, `/delete/`). Configured only when `DIDIT_API_KEY`,
  `DIDIT_WEBHOOK_SECRET`, `DIDIT_WORKFLOW_ID` are all set; otherwise
  `configuredVerifier()` falls back to dev manual (dev only) or `null`, which
  keeps the lock closed.
- The port's `check` became `start(userId, returnUrl)`: an instant verdict
  (manual) or a redirect (Didit). `vendor_data` is our user ID.
- Two ways a verdict lands, both through `settleDidit`:
  - return page `/p/[id]/uncensored/verified`: ignores the `status` query
    param, reads the decision server side and refuses a session whose
    `vendor_data` is not the signed-in user;
  - webhook `/api/webhooks/didit`: HMAC-SHA256 of the raw body
    (`X-Signature`), `X-Timestamp` within 300 s, 401 otherwise, 503 without
    keys.
- Idempotency: `user_age_verifications.provider_session_id` with a unique
  index (migration `20261002150000_age_verification_provider_session.sql`,
  applied); upsert with `ignoreDuplicates`, so callback + webhook + Didit
  retries leave one row.
- After a final verdict (Approved / Declined / Abandoned / Expired) we call
  Didit delete with `privacy_erasure` and `retain_face_embeddings: false`. A
  failed erase is logged, not retried: the webhook path usually repeats it.
  `In Review` / `Resubmitted` store nothing and erase nothing.

Didit console setup (not code): workflow with Age Estimation, document fallback
only for the borderline band; webhook destination on `status.updated` pointing
at `/api/webhooks/didit`.

Discarded: `X-Signature-V2` (canonical JSON) — SvelteKit gives the raw body, so
the raw-bytes signature is exact and simpler. Trusting the redirect's `status`
— unsigned. Storing declined outcomes — the table only admits `adult`.

Not run against a live Didit sandbox: no key available.
