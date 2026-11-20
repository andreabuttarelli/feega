# Editor sign-in reaches the extension again

The callback page posted the session to `http://localhost:<port>`; browsers that resolve `localhost` to `::1` never reached the extension, which listened on `127.0.0.1` only. The page now tries `127.0.0.1` first, then `localhost`, and sends `targetAddressSpace: 'loopback'` for Chrome's Local Network Access. The extension also listens on `::1` and answers the preflight with `Vary: Origin` and the request origin (app or `www`).

When the fetch still fails, the page offers "Open in VS Code / Cursor / Windsurf / VSCodium": a `<scheme>://andreabuttarelli.feega/signin?...` link handled by the extension's URI handler, which accepts it only for the pending `state`. The session travels in the URI, local to the machine. npx keeps the loopback path only.

Copy and button follow the current product (neutral, no purple). Discarded: a server-side one-time code, which needs a new table and a second round trip for no gain over the pending-state check.
