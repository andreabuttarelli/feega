# Compress frame sources explicitly

The load bench showed `motion/sources` sending 11 MB of plain JSON per
cold open of the landings canvas: the node adapter (self-hosting, the
bench) never compresses. Vercel compresses JSON at the edge, but nothing
in the code guaranteed it. `revalidated()` now encodes brotli (quality 4,
fast enough for multi-MB bodies) or gzip when accepted, with
`vary: accept-encoding`; the ETag stays the hash of the plain body.
