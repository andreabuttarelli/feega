# The sandbox dev server answers only the import that started it

During a code import the sandbox exposes the origin proxy on a public `https://….vercel.run` URL.
Until now anyone with that URL reached the dev server through it — Vite's `/@fs`, the sources —
for up to six minutes; only the random subdomain protected it.

`sandboxRunner` now draws a random key per run (`importKey`, 24 bytes), starts `ORIGIN_PROXY` with
it and probes the proxy with it; `RunningApp.key` carries it. The proxy answers 403 to any HTTP
request and refuses any websocket upgrade without the cookie `feega_import_key=<key>`, and strips
that cookie before the dev server sees the request. `importRepoAt` restores the cookie
(`importKeyCookie`) in every capture tab, scoped to the sandbox host.

A cookie and not a header: Puppeteer's extra HTTP headers go to every origin the page loads
(fonts, CDNs) and are not sent on websocket upgrades; a host-scoped cookie rides on both and
leaks nowhere. Folder imports (loopback dev server, no proxy) are unchanged.

Not exercised: a live sandbox run (paid). Covered by the proxy spawned against a local target
and by the capture wiring test.
