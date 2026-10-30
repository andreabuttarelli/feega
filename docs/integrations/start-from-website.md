# Start from your website — link contract for the marketing site

Send visitors to:

```
https://oh.feega.app/?start_url=<encodeURIComponent(url)>
```

| | |
|---|---|
| Parameter | `start_url` |
| Encoding | percent-encoded once (`encodeURIComponent`) |
| Scheme | `http` or `https` only |
| Length | at most 2000 characters, decoded |
| Refused | `javascript:`, `data:`, other schemes, credentials in the URL, `localhost`, `*.local`, `*.internal`, IP literals in private ranges, single-label hosts. The import re-checks DNS against private addresses before opening the page. |
| Also accepted on | `/login`, `/app` (same parameter) |

A refused value is ignored silently: the visitor lands as if no parameter was given.

## What happens

1. Signed out → `/login?start_url=…` with sign-up shown first. The URL is also kept in an
   httpOnly, SameSite=Lax cookie (`feega_start_url`, 30 minutes).
2. Any sign-in (email + password, sign-up, Google, GitHub, Apple, password reset) → a new project
   named after the host (`www.` dropped), e.g. `stripe.com`, opened on its canvas.
3. The canvas imports the top of the page (first ~1800 px) and shows "Importing stripe.com…".
   On failure: a message and a "Try another URL" field. The value is used once.

No AI model runs: the import is a headless browser reading the page.

## Example (Framer form)

```js
const url = input.value.trim();
const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
location.href = `https://oh.feega.app/?start_url=${encodeURIComponent(full)}`;
```
