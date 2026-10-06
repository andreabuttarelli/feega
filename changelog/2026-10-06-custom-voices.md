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

**Wiring.** "More voices" in `AudioControls.svelte` opens `VoiceStudio.svelte` (library, design,
clone with `VoiceRecorder.svelte`, my voices) → `voiceAction` in the canvas `+page.svelte` →
`voice_library` / `voice_use_library` / `voice_design` / `voice_save` / `voice_clone` /
`voice_delete` actions in `+page.server.ts` (credit gate on design and clone) → use cases in
`voices/custom-voices.ts` → `voice-store.ts` (`custom_voices`) and `elevenlabs-voices.ts`.
Runs: `runAudioNode` and `speakVoiceover` call `voiceUseRefusal`. Tick: `sweepVoices`.

**Prices.** ElevenLabs bills Voice Design previews as TTS characters of the preview text, so design
is priced at $0.08 (1k characters at the multilingual rate, upper bound). Instant cloning costs no
ElevenLabs credits; $0.10 is our charge for the slot. Library voices added to the account do not use
custom slots (ElevenLabs docs). Slot ceilings per ElevenLabs tier: Starter 10, Creator 30, Pro 160,
Scale/Business 660 — our account's real `voice_limit` is read at runtime from `/v1/user/subscription`.

**Recording.** MediaRecorder with webm/opus, mp4 fallback for Safari (iOS 14.3+). Denied permission,
missing microphone and unsupported browser each have their own message (`voice-recording.ts`).
