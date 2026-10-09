# Embeds published from the editor get the current player

`/e/<id>` upgrades a stored page on read (cover fit, libs from `/motion-libs`) and `/e/<id>.json`
answers its settings — but only if `storedPlayer` recognised the page. It looked for
`<script>(function playerMain`: the editor (`InteractiveExport.svelte`) builds the page in the
browser from a minified bundle, where the function is `vi`. Every editor-published embed
(e.g. `fd37d96f…`) stayed on the old letterboxed player, CDN libs, and a 404 settings call;
agent-published ones (Saturn `c76b6d3b…`, server code, unminified) were upgraded.

Now the page is recognised by the player call's config (`})({"html":`), which minification keeps.

The loader also created the iframe only after `/e/<id>.json` answered: one serial round trip
before the page request. The iframe is now appended first; settings only decide sizing and
scrub wiring. Since the frame may load before settings arrive, host and gesture messages are
also sent once immediately.

Not done: a 3D scene with an HDRI preset blocks its first frame on a 1.4 MB `.hdr` from
jsDelivr (~9 s on slow 4G). Needs a smaller hosted HDRI or a non-blocking environment in live mode.
