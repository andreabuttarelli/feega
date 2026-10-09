# analyze_site reads sites that refuse plain requests; agents get `browse`

`analyze_site({url:"https://lovable.dev"})` answered `the site answered 403`: `readSite` made one
request with `feega-Tools/1.0` and `Accept: */*`, and Cloudflare (or any WAF) refused it. The
launch-film path (dashboard URL → film) stopped there.

## The chain (`src/lib/server/web/site-fetch.ts`)

One table of strategies, tried in order, each with its own timeout, all behind the SSRF guard:

| # | source | how | timeout |
|---|---|---|---|
| 1 | `fetch` | `safeFetchUrl` with Chrome headers (UA, Accept, Accept-Language, sec-ch-ua, Sec-Fetch-*) | 13 s |
| 2 | `browser` | Browserless `/stealth` over WebSocket (puppeteer-core `connect`); our Chromium when `BROWSERLESS_API_KEY` is absent. Rendered DOM + computed colours/fonts injected as a `<style>` | 35 s |
| 3 | `exa` | Exa `/contents` (`livecrawl: fallback`), text turned into a page | 20 s |
| 4 | `secondary` | Exa search on the host + `readPage` of up to 3 other sources | 25 s |

A result counts as a page only if no bot-check marker matches (Cloudflare, Vercel checkpoint,
DataDome, PerimeterX, Akamai: one table) and it has text; an empty JS shell is kept as last
resort. The brief now carries `source`, `note` and `tried` (source, ok, error, ms). `secondary`
pages keep their own urls and the note says they are not the site, so quoting stays honest. When
everything fails the tool returns `ok:false` with every reason and advice to continue; the turn
goes on.

Robots: `fetch` reads `robots.txt` and stops only when a group naming `feega` disallows the path.
A `*` disallow is not read as a ban: one page a person asked for is not a crawl.

## Browserless

- Measured on lovable.dev: `/content`, `/chromium` and `/chromium/stealth` return the Cloudflare
  challenge; `/stealth` and `/unblock` pass. `/unblock` on g2.com hung 139 s ignoring `timeout`.
  Chosen: `/stealth` over WebSocket — request interception keeps the SSRF gate on every request,
  the same tab drives `browse`, computed styles come from the same page.
- No `solveCaptchas`, no proxy. Retry with backoff on 429/503 (1 s, 3 s). The key never appears
  in an error.
- Cost: 1 unit per started 30 s, `BROWSERLESS_UNIT_USD = 0.002`; logged in `ai_calls`
  (`provider: browserless`, `provider_credits` = units) and added to the turn cost cap. Exa
  contents is logged as `site-read-exa`.

## `browse(url, steps[])`

For both chatbots (`createWebTools`): navigate, click (selector or text), type, scroll, wait,
extract (markdown/links/images), screenshot. ≤15 steps, ≤60 s, ≤3 screenshots, ≤3 per turn.
Every navigation and request goes through the SSRF gate; downloads denied; typing into or
clicking inside a form with a password or card field is refused. Screenshots reach the model as
images and storage under `web-views/<callId>/browse-<n>.jpg`. Offered when Browserless or the
server Chromium is available.

Discarded: `/function` (code shipped as a string, no interception on our side), BrowserQL (a
second language for the same steps), `/unblock` as default (hangs past its timeout).
