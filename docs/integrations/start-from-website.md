# Start from your website — link contract for the marketing site

Send visitors to:

```
https://oh.feega.app/?start_url=<encodeURIComponent(url)>
```

| | |
|---|---|
| Parameter | `start_url` |
| Encoding | percent-encoded once (`encodeURIComponent`) |
| Scheme | `http` or `https`; a bare domain or scheme-less URL (`stripe.com`, `www.stripe.com/pricing`, surrounding spaces) gets `https://` prepended |
| Length | at most 2000 characters, decoded |
| Refused | `javascript:`, `data:`, other schemes, credentials in the URL, `localhost`, `*.local`, `*.internal`, IP literals in private ranges, single-label hosts. The import re-checks DNS against private addresses before opening the page. |
| Also accepted on | `/login`, `/app` (same parameter) |

A refused value is ignored: the visitor lands as if no parameter was given, and the server logs a warning with the reason.

## What happens

1. Signed out → `/login?start_url=…` with sign-up shown first. The URL is also kept in an
   httpOnly, SameSite=Lax cookie (`feega_start_url`, 30 minutes), cleared once used.
2. Any sign-in (email + password, sign-up, Google, GitHub, Apple, password reset) → `/start`,
   a loading page with real steps:
   - "Reading stripe.com…" — a new project named after the host (`www.` dropped), with a canvas;
   - "Importing the page…" — the top of the page (first ~1800 px) as a frame;
   - "Analysing your brand: colours, fonts, logo, voice…" — a `brands` row (reused if the org
     already has a brand for that domain), attached to the project, and a brand-kit frame
     (swatches, font names, logo) next to the page;
   - "Opening your canvas…".
3. A failed step is named and the rest continues. Failed import → the canvas opens and retries
   it, with a "Try another URL" field. Failed brand analysis → "Try again" or "Open canvas".

The page import uses no AI model. The brand analysis does (OpenRouter, billed to the org's
credits); a workspace without credits sees the brand step fail and keeps the imported page.

## Example (Framer form)

```js
const url = input.value.trim();
const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
location.href = `https://oh.feega.app/?start_url=${encodeURIComponent(full)}`;
```
