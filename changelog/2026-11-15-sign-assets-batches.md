# Sign assets in batches

A project with ~577 assets made `orgsHolding` send one `in()` filter of
~80 KB in a GET URL; PostgREST refused it, `signAssetPaths` threw, and the
motion sources route answered 500. Because `motionSources` started the
asset read before awaiting the heads, the rejection was also unhandled
and took the dev server down.

Paths now go in batches of ~6000 characters, the thrown error carries the
server's message, and the early asset promise has a catch.
