# Custom voices (ElevenLabs)

**Why.** TTS refused to run without a picked voice, and only premade voices existed.

**What.**
- Default voice (George, premade) in `voiceIdOf`.
- `/v2/voices` is filtered to `premade`: on one shared ElevenLabs account it also returned every
  other workspace's custom voices.
- `custom_voices` (org-scoped, RLS) maps an org to ElevenLabs `voice_id`; clone rows must carry a
  consent basis and attestation time (CHECK constraint). `voice_owned_elsewhere()` lets a run refuse
  another org's voice id.
- Rules in one place, `src/lib/canvas/voices.ts`: clone refusals table, slots per plan capped by the
  account's real `voice_limit - voice_slots_used`, creation price.
- Use cases in `src/lib/server/voices/custom-voices.ts`: design, save, clone (samples deleted at the
  provider right after; sweep retries), delete (provider first), orphan sweep by the `feega_org`
  label for orgs/accounts deleted by cascade.

**Discarded.** Professional cloning: requires the speaker's own captcha verification on the
account owner's ElevenLabs session, hours of training, and a per-account PVC limit shared by every
org. Not deliverable per end user.

**Not done in this PR.** See PR body.
