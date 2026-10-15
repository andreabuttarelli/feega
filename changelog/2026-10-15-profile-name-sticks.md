# A saved profile name sticks

`ensureProfile` ran on every project layout load and upserted `name` and `avatar_url` from the
auth metadata, overwriting what the user saved in Profile (for most users: back to null). It now
creates the row once and only fills `name`/`avatar_url` while they are empty; a complete profile
is a read, no write, per page load. Guarded by `profiles.test.ts` and
`tests/e2e/settings-profile.spec.ts` (failed on dev).
