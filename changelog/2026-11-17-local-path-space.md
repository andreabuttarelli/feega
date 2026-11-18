# Local mode starts from a path with a space

`scripts/local.mjs` and `scripts/node-server.mjs` decided whether they were the entry point by
comparing `import.meta.url` with `` `file://${process.argv[1]}` ``. `import.meta.url` encodes a
space as `%20` and resolves symlinks; the template did neither. Under `~/My Projects/...` the
check was false, `run()` never fired and the process exited 0 with no output. Now both compare
against `pathToFileURL(realpathSync(argv[1]))`.

The launcher (`npx/bin/feega.mjs`) polled the URL forever and forwarded the server's exit code,
so a server that died before listening looked like a clean exit. `untilReady` now races the
probe against the server's exit and throws `the app server exited (code N) before it started`;
`main` prints it and exits 1. Signals are forwarded only once the server serves.

Found by an end-to-end run on a clone of traidue.com. Tests: `scripts/entry-path-space.test.ts`
runs both scripts from a copied folder named `with space`; `untilReady` in
`npx/launcher.test.mjs`.
