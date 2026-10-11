# Trailer v7 blockers

The v7 feega trailer run failed on four defects.

- **app_browse login**: a fixed 2.5 s wait after submit; oh.feega.app leaves /login at ~5 s, so the
  login was reported failed. Now polls the URL for up to 15 s. The two 30 s timeouts that followed
  were the shared local Chromium already holding the session cookie: /login redirected to /app, the
  email field never appeared and puppeteer's locator waited 30 s. signIn now skips the form when the
  browser is already off the sign-in page, and says "no email field" instead of timing out.
- **describe_frames gate**: shots had view_frames but not describe_frames, so one look locked every
  edit; the sound round (no vision tools) inherited the pending look. Each role now declares `looks`
  in studio-roster.ts; the gate applies only when the round's role describes frames.
- **52.6 s cut from a 15 s script**: 14 on-screen lines, each its own title card, and the gate
  demanding all of them; the fixer stretched the canvas to fit. write_script now refuses more lines
  than the length holds (2 s per line, +20%), set_canvas refuses a duration outside the script ±20%,
  and the gate blocks a video outside that range.
- **20 flickers**: every kinetic-title opened on 0.12 s of black and punched words in on a fast
  stagger. Fixed in dev by #398 (smoother entries, real-export e2e check); this change keeps it.
