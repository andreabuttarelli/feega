# app_browse: put back the Origin header on form posts

**Before.** In the v4 trailer run app_browse could not sign in to feega's own login: the action
POST answered 403. The server-side Chromium runs with `@sparticuz/chromium` args, including
`--disable-web-security`, and sends no `Origin`; SvelteKit-style CSRF checks refuse that as
cross-site. The first guess (hydration wiping the email) was wrong; its sleep is reverted.

**Now.** The request gate in `browser.ts` adds the page origin to non-GET requests that lack one
(`originHeaders`). Same-origin posts look like a normal browser's again.

Discarded: dropping `--disable-web-security` (the frame pipeline depends on the sparticuz args on
Vercel) and `setExtraHTTPHeaders` (would add Origin to every GET too).
