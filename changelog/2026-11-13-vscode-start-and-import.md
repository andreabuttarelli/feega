# VS Code: import that imports, start-up that tells you what it's doing

**Import did nothing.** The extension spawned `npx feega … --import` without `cwd`, so the
launcher ran in VS Code's own cwd (`/`), `folderApp` found no `package.json`, and `importStep`
returned `Skip` silently. Now the spawn runs in the canvas file's folder (`spawnOptions`), and
`--import` without an app is `ImportStep.NoApp`: the launcher exits with the reason. Import
failures after start emit `feega:event import-failed`, shown as a VS Code error.

**Endless spinner.** First run downloads the bundle and runs `npm ci` with no output the panel
could read, against a fixed 180 s deadline. The launcher now emits `step` events
(download, install, start); the panel shows them on the app's splash (mark, wordmark, pride
bar, step label). The deadline is 180 s of silence, not 180 s total. Crash, spawn error or
silence show an error page with the log tail and Retry; the Output channel opens.

Extension 0.1.2.
