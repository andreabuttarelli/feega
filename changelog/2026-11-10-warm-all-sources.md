# Every frame's source asked in one batch on open

On the user's canvas (remote Supabase, `?loadTimeline`) sources went out in five requests seconds apart (×1 at 3.0 s … ×9 at 8.4 s). `frameSources.warm` only covered frames inside the measured screen (`fillOrder` filters), and the rest were asked as `load` slots (`IN_FLIGHT`) freed up. `toWarm` now warms every frame, on-screen first, also before the screen is measured; building still goes through the `IN_FLIGHT` slots.

The load timeline lists each sources request's start → end, time to first byte and the server phases from `Server-Timing`. `FEEGA_LOCAL_LATENCY_MS` delays local database queries to mimic remote round trips in the bench.
