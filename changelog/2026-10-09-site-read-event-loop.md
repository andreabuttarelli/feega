# Reading a site no longer freezes the server

`analyze_site` on stripe.com froze the whole Node process: `actionColours` (`site-brief.ts`)
matched CSS rules with `/([^{}]+)\{([^{}]*)\}/g` over HTML + CSS. On a long brace-free run that
ends in `}` the regex restarts at every position: quadratic, >120 s on stripe's 760 KB home. The
40 s site deadline is a timer, so it never fired; production motion turns hit the 300 s timeout.

- `cssRules` splits on `}` and takes the selector before the last `{`: same rules, linear. Stripe
  home now reads in ~20 ms.
- Test: readSite on 94 KB of prose must never hold the loop over 200 ms (was 5.2 s).
- Discarded: worker thread / size cap — the cost was the regex, not the page size.
