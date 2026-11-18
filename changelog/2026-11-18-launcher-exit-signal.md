# Say how the app server ended

From VS Code the user sometimes saw "Feega stopped (exit 0)" right after a folder import. The
launcher forwarded the app server's exit with `process.exit(code ?? 0)`, so a server killed by a
signal (code `null`) looked like a clean exit, and the log said nothing about who stopped it.

`exitOf` (npx/launcher.mjs) now prints "the app server was stopped by SIGTERM" (or the exit
code) and exits 1 for a signal. Three runs of `npx feega --import` on `landing/` from a
terminal did not reproduce the stop; the next occurrence will name the signal.
