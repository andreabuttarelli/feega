# ElevenLabs music: clear error on 402

Every music generation in production (25/25, 2026-10-08 → 10-16) failed with
`ElevenLabs 402: Music API is not available for free users. Please upgrade to a paid plan`.
The code was correct (endpoint `/v1/music`, `music_v1`, `music_length_ms`); feega's ElevenLabs
account is on the free plan, which excludes the Music API. The raw message told customers to
upgrade *their* plan, which they cannot fix.

`readableError` now maps HTTP 402 (a plan/quota on our key, never the user's) to a message that
says the provider plan blocks it and nothing was generated. Mapping is a status→message table.

Not fixed by code: music works only after upgrading the ElevenLabs account to a paid plan.
