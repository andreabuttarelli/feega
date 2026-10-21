# Faster Vercel build

Production build was ~5.8 min to READY: install 30 s, `typecheck-runtime` 12 s, SSR bundle 51 s, client bundle 93 s, adapter-vercel function tracing 112 s (one trace per distinct function config), upload 32 s.

- `npm run build` is now `vite build`. The undefined-name/arity gate still runs in CI (`ci.yml`, `node scripts/typecheck-runtime.mjs`, also `npm run typecheck:runtime`); running it again on Vercel only added 12 s to a build CI had already gated.
- `installCommand` adds `--prefer-offline --no-audit --no-fund`.
- `build.reportCompressedSize: false`: no gzip pass over every chunk.
- `ignoreCommand` of the app takes pathspecs: a production commit touching only `cli/`, `changelog/`, `docs/`, `apps/`, `imgs/`, `supabase/` skips the build (the app imports none of them; only tests read `cli/`). `cli/mcp` keeps watching `..`.
- The five `maxDuration: 60, memory: 2048` routes (`edit`, `view`, motion `tools`/`frames`/`ops`) drop their config and join the default function, so adapter-vercel traces two function groups instead of three. Fluid compute is on, which sets memory per project; the 60 s cap becomes the default 300 s.

Discarded: Rust/wasm builds are not on the Vercel path (`static/gpu-core` and `static/gpu-text` are committed). `manualChunks`: no build-time gain. Build cache for Vite: Vite has no persistent production transform cache.
