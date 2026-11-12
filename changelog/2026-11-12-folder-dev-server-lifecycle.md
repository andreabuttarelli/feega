# Folder import: the project's dev server no longer outlives feega

**Before.** A folder import started the project's dev server (`npm run dev` and friends) with a
plain `spawn` and kept it in a module map for reuse. Nothing ever stopped it: not the end of the
import, not feega's own exit. `child.kill()` only ran when the server never answered, and it
reached the npm wrapper, not the `vite` it had spawned. Worse, the live child handle kept the
feega process from exiting on SIGTERM, so the desktop app escalated to SIGKILL and the whole
tree was orphaned. Three traidue `vite dev` processes were found running after feega stopped.

**Now.** `dev-children.ts` spawns the server as the leader of its own process group and stops
the whole group (`kill(-pid)`, SIGTERM then SIGKILL after 2 s: a Vite busy optimising
dependencies ignored SIGTERM for over a minute in the traidue run): on the end of the import (shared, counted per folder, so two
imports of one folder share one server and the last one stops it), on `exit`, and on
SIGINT/SIGTERM/SIGHUP (SIGKILL there: nothing waits for a timer at exit). The signal handler only re-raises when it is the sole listener, so
servers that close themselves (`scripts/node-server.mjs`, used by `npm run local` and the
desktop app) still decide when to exit. The registry lives on `globalThis`, so a Vite reload of
feega's own server module neither forgets running children nor registers handlers twice.

A kill -9 of feega runs no handler. Each child is recorded as `<pid>.json` in
`$TMPDIR/feega-dev-children` with its own start time and its owner's; the first spawn of the
next run kills a recorded group only if its owner is gone and the pid still has the recorded
start time. A dev server the user started is never recorded, so never touched.

**Discarded.** Keeping the server warm between imports: Pull does not use it (it reads files),
and a warm server is what leaked. A restart per import costs the dev server's startup.
Windows has no process groups; untouched.
