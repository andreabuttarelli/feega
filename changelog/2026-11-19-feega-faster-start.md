# Feega editor: faster start

- `portsServing` (listener.ts) finds every listening port whose process cwd is under the app, any port, skipping Feega's own pids. Before: only the framework default port, never Vite.
- Vite/SvelteKit attach only when the served page carries `data-feega-src`; a plain `vite dev` has no source tags, so Feega still starts its own (logs why). Mapping without tags is item "Open from URL".
- `keptServers`: closing the panel parks a Feega-started server for 10 min; reopen adopts it. Window close (`deactivate`) stops all. npx stops on exit as before.
- Ready poll 500 → 100 ms. Timeline line `feega timeline (...)` in the dev-server log.
- Dev mode restarts the extension host only when `extension.cjs` content hash changes.
- Vite cache dir untouched (default).

Measured (startDev to ready / first page): landing 1027/1845 → 634/1510 ms; next-tailwind 1024/2574 → 641/2618 ms; attach to a running tagged server 845/858 ms; parked reopen ≈ 0.
