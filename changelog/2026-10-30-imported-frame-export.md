# Imported landing pages export again

#1630 banded tall raster exports but was never run in the app. Reproduced on dev with
test@dazero.co: a Linear import (2154×16378) and a 1080×1080 control, every format.

Four defects, found in order:

1. **Local only — every raster export hung 20 s.** The render page loads the motion libraries
   from `PUBLIC_APP_URL`; the local `.env` points at `www.dazero.co`, which no longer answers,
   so `__playerReady` never came (`Waiting failed: 20000ms exceeded`), control frame included.
   Any remote host would be wrong anyway: dev pins library versions production does not serve
   yet (404). With local Chromium the page now answers `/motion-libs/*` from
   `static/motion-libs` of the checkout (`local-libs.ts`). @sparticuz on Vercel is untouched.
2. **Everywhere — non-ASCII frame names.** The export stored its file under the frame name;
   imported frames are named after the page title (`Linear – The system…`) and Supabase
   Storage rejects the en dash: `Invalid key`. The key now goes through `storageName`; the
   download keeps the real name.
3. **Everywhere — PDF of an imported page timed out at 30 s.** Hard masks were written as
   full-frame SVG `<mask>`s; Chrome's printer rasterises each over the whole 2154×16378 frame
   (3 masks ≈ 30 s). A hard mask (outside 0, inside 1, no feather) is now a `clipPath`: 3 s.
4. **The dialog hid the reason.** Through the API twin a 5xx comes back as an `error` answer,
   not `failure`; `exportFailure` read only `data.error`, and the frame's "Export image"
   dialog (`StillExport`, the one the user saw — not the canvas export rows) printed a bare
   "Export failed". Both now show the server's message.

Discarded: threading the request origin into every compose call (six call sites, and Vercel
previews behind protection could not fetch from themselves).
