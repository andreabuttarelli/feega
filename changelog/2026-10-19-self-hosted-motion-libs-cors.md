# Self-hosted builds serve motion libraries cross-origin

The frame preview is a sandboxed iframe (origin `null`) that loads `/motion-libs/*` and
`/motion-env/*` with `integrity` + `crossorigin="anonymous"`. Vercel adds
`Access-Control-Allow-Origin: *` from `vercel.json`, Vite dev/preview from `scripts/motion-libs.ts`;
the node adapter served them from sirv without it, so every frame preview failed CORS.

Hooks can't fix it: adapter-node serves static files before `handle` runs. `npm run start` and the
Docker image now run `scripts/node-server.mjs`, which wraps `build/handler.js` and adds the
header for those two routes. Vite uses the same `allowOpaqueFrames`, so the route list lives once.
Lost from adapter-node's `index.js`: socket activation, `SHUTDOWN_TIMEOUT`/`IDLE_TIMEOUT`;
`PORT`/`HOST` still work.
