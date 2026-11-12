# Canvas: `?debug` flight recorder, saved server-side while the page lives

On iPhone and iPad the canvas page dies as soon as a pan or zoom starts. No device here
reproduces it, and the existing telemetry (`canvas_perf`, the crash sample in localStorage) sends
on `pagehide` or on the *next* load: a tab killed by WebKit sends neither in time. What was
missing was a record that is already on the server when the tab dies.

## What it does

`?debug` (or `?debug=1`) on a canvas URL turns it on for the tab (sessionStorage, so it survives
the reload iOS does after a crash); `?debug=0` turns it off. A badge at the bottom right reads
`debug recording · <session>`, and `· <previous> crashed` when the previous session of the tab
ended without `pagehide`. Nobody else records anything.

Lines (`seq`, `t_ms` from `performance.now()`, `kind`, `props`):

- `start`: user agent, platform, touch points, screen, DPR, device memory, cores, visual
  viewport, app and core version, the previous session with its last seq and whether it ended
  cleanly.
- `adapter` (WebGPU vendor/architecture/device, `maxTextureDimension2D`, `maxBufferSize`,
  `maxStorageBufferBindingSize`), `webgl` (version, max texture/renderbuffer, renderer), `backend`,
  `backend-switch`, `gpu-lost`, `device-lost` (reason, message), `gpu-error` (uncaptured),
  `context-lost`/`context-restored`, `core-off` (reason).
- `sample` every 250 ms when a value changed, at least every 2 s: camera x/y/zoom (NaN/Infinity
  kept as strings), camera state, frames in doc / held / waiting / put / pictured, backing-store
  size, tile cache, texture bytes and count, picture/scratch/wasm bytes, GPU lag, touches, pinch
  scale, wheel count, JS heap (Chromium only), frames painted since the last line with the worst
  frame, the longest gap between painted frames, tiles and draws, and `lag` (how late the timer
  fired: a main-thread stall), and the recorder's own cost since the last sample (`selfMs`, of
  which `readMs` for reading the engine counters).
- `gesture` start/end (touch count, pinch scale, wheel, pointer), `texture` made/destroyed over
  4 MB, `frame` (asked/built/drawn/sharp/images per frame id), `startup` marks, `sources` (frames,
  bytes, ms, status), `asset` over 256 KB or failed (host, bytes, status — never the path),
  `long-task`, `error` and `rejection` (message, stack), `visibility`, `pagehide`/`pageshow`
  (`persisted`), `resize`, `orientation`.

No document content, no layer text, no asset URLs beyond host and size.

## How it gets out

Lines go into a bounded buffer (600; past it the oldest go, and the gap shows in `seq`). Every
300 ms the buffer is posted with `fetch(…, { keepalive: true })` in chunks of 60 lines; a
gesture start, an error, a lost device or context posts at once, in the same event handler;
`visibilitychange` to hidden and `pagehide` use `sendBeacon`. No retries. The recorder reads
counters that already exist (`crashes.sample`, `__gpuCanvas.frames`, performance entries) on
its own timer: nothing is added to the frame loop. Events per kind are capped at 300 per session
(samples and gestures excepted).

Measured in headed Chromium, iPhone 13 emulation with touch, the same pinch+pan gesture three
times each way on the zoom fixture: no difference at 1x (p50 8.3 ms, p95 16.6 ms both ways); at
4x throttle the canvas is still loading and run order moves the numbers more than the flag does.
The recorder's own time is 3.6 ms per second at 1x (p50 0.7 ms per tick, max 8.8 ms). Killing the renderer mid-gesture
(`Page.crash`) left every line up to ~120 ms before the kill on the server, no seq missing.

## Server

`POST /api/v1/telemetry/canvas-debug` → `recordDebugBatch` (`src/lib/server/canvas-debug/debug-lines.ts`)
→ `writeDebugRows` (`debug-log-repo.ts`) → `canvas_debug_logs`. Signed-in user only; 64 KB per
request, 200 lines per batch, 50 000 lines per session, 600 requests per user per minute;
strings cut at 1000 chars, props three levels deep. `org_id`/`canvas_id` come from the canvas row
read with the user's own client (RLS): a canvas the user cannot open is stored as null. Writes go
through the service role (declared in `service-role-uses.ts`); the table grants nothing to anon or
authenticated. In local mode the rows are appended as JSON lines to `<file>.feega.debug.jsonl`.

`database.types.ts` gets the table by hand in the generated format: the migration is not applied
yet. Regenerate with `npm run db:types` once it is.

## Apply (by hand)

`supabase/migrations/20261112200000_canvas_debug_logs.sql` — table, `(session, seq)` index,
`created_at` index, RLS on, view `canvas_debug_sessions`.

## Read

Recent sessions:

```sql
select session, device, backend, first_at, last_at, lines, lost_lines, ended_cleanly,
       previous_session, previous_crashed, user_id, canvas_id
from public.canvas_debug_sessions
order by last_at desc
limit 20;
```

One session, in order (paste the output into `node scripts/debug-timeline.mjs <file>` or its stdin;
it reads CSV, a JSON array or JSON lines, and marks the last 30 lines with `>>`):

```sql
select session, seq, t_ms, kind, props, created_at
from public.canvas_debug_logs
where session = '<session>'
order by seq;
```

Retention: `delete from public.canvas_debug_logs where created_at < now() - interval '14 days';`

## Not done

Videos playing/decoding and images decoding are not counted (no existing counter to read, and
adding one means per-frame work). No platform here exposes a memory-pressure event, so none is
recorded.
