# NSFW mode renamed to uncensored mode

"NSFW" implied porn. The models are uncensored; the purpose is not pornographic. Renamed end
to end; moderation behaviour unchanged.

- Code: `ProjectMode.Uncensored` (`'uncensored'`), `src/lib/uncensored-lock.ts` (was
  `nsfw-access.ts`), `src/lib/server/uncensored-workspace/` (was `server/nsfw/`), route
  `/p/[projectId]/uncensored` (was `/nsfw`), refusal codes `uncensored_*`, storage folder
  `uncensored/`, env `UNCENSORED_DEV_MANUAL_VERIFICATION` (was `NSFW_DEV_MANUAL_VERIFICATION`).
- Copy: "Uncensored mode — models without built-in content filters, for adults (18+). Our
  safety rules still apply." Settings and calendar copy no longer say "adult content".
- Legal docs (TERMS, ACCEPTABLE-USE, PRIVACY, AI-TRANSPARENCY, SUBPROCESSORS, checklist) renamed.
- Schema, in two steps because deploys don't run migrations:
  - `20260930160000_uncensored_mode_enum_value.sql` + `20260930160100_uncensored_mode_rename.sql`
    (applied 2026-09-30, before merge): adds enum value `uncensored`, `project_is_uncensored`,
    `assets.uncensored_project`, triggers/functions renamed, billing scope and feature flag
    `uncensored_mode`. Old code keeps working: `nsfw` enum value and `assets.nsfw` still exist,
    flag absent reads as off, no project was ever `nsfw`.
  - `20260930160200_uncensored_mode_drop_nsfw.sql` (apply AFTER this deploy is live): drops
    `assets.nsfw` and recreates `project_mode` as `standard|uncensored`.
- Discarded: `alter type ... rename value` in one step — old code filtering `mode = 'nsfw'`
  would error between apply and deploy.
