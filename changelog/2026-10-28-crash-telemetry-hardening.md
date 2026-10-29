# Crash telemetry hardening

`/api/v1/telemetry/crash` was open to anyone and logged every call.

- Needs a session (401 otherwise). Max 5 reports per user per day (429).
- Per day, first 20 reports kept, then 1 in 10. Counters live in memory per
  server instance: best effort, no table. Discarded: a table for a probe.
- Client sends only records written mid-gesture (`gestureFrames > 0`), so
  background tab evictions are not reported. The record is already cleared
  on read, so one send per crash.
- Sentry fingerprint `['webcontent-crash-suspected', device]`: one issue per
  device class.
