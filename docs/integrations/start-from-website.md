# Start from your website — link contract for the marketing site

Send visitors to:

```
https://oh.feega.app/app?start_url=<encodeURIComponent(url)>
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
   which creates a project named after the host (`www.` dropped) with a canvas, and redirects to
   `/p/<projectId>/c/<canvasId>?start_url=…` straight away.
3. The canvas opens and imports the page with the `import_url` engine (sections, text, auto
   layout, images, variables and styles), showing progress. A failed import names the reason and
   keeps the field to retry or try another URL.

The import uses no AI model. No brand is created: the project stays brand-less until the user
picks one.

## Example (Framer form)

```js
const url = input.value.trim();
const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
location.href = `https://oh.feega.app/app?start_url=${encodeURIComponent(full)}`;
```
