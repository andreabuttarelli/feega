# A failed read no longer shows "failed to save"

Production canvas showed "The server failed to save this change" while every
`nodes` PATCH landed (Supabase edge logs: 200). Cause: `audio_voices` answers 503
`elevenlabs_not_configured` (no `ELEVENLABS_API_KEY` on Vercel production), and
`report()` in the canvas page announced every failed action, read-only ones
included, with the save message.

Now `node-save.ts` owns the `READ_ACTIONS` table: `actionKind` decides pending /
clearing, `saveBanner` returns `null` for a read, which is logged to the console
only. Discarded: a per-action `if` in the page.

Also: `settle()` in `video-render-queue.ts` wrote `completed_at`, a column the
live `video_renders` doesn't have (it has `finished_at`): PATCH 400 every tick,
swallowed. Now writes `finished_at` and logs the error. The live table also
lacks `media_url`, which the brand-free path writes: migration
`20261001120000_video_renders_media_url.sql` adds it (apply by hand).
