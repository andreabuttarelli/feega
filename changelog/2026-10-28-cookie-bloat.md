# Session cookies of other Supabase projects no longer pile up

Supabase SSR names the session cookie `sb-<ref>-auth-token(.N)`, with `ref` the first label of the Supabase host. Cookies on `localhost` are shared across ports, so every dev server pointing at a different project (cloud, branch, local) added its own 3-4 chunks and never removed them: Vite answered 431 once the header passed its limit.

The server now deletes session cookies of any ref other than its own on each request (`stale-session-cookies.ts`). `npm run dev` also raises Node's header limit to 64 KB so an already bloated profile still reaches the page that cleans it.

Discarded: namespacing cookies per port (more names, same growth). Local mode sets no cookies.
