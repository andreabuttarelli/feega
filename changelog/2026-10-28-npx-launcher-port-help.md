# npx feega: free port, --help, --version

`npx feega` always bound 127.0.0.1:5173 and opened `http://localhost:5173`. With `vite dev` on `::1:5173`, the browser resolved localhost to the dev server (cloud login), not local mode. Now the launcher binds port 0 on 127.0.0.1 and takes the OS-chosen port, and prints/opens `http://127.0.0.1:<port>`. `scripts/local.mjs` sets ORIGIN to the same host (takes effect with the next app release).

`--help`/`-h` and `--version` added. Any other `-` option errors instead of becoming a filename. Rejected: only changing the printed host (port clash remains).
