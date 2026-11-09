# Display lists reach the wasm core as bytes

Profiling the landings benchmark (`BENCH_CASE=landings`) put `passStringToWasm0` at the top of
fit-to-all and pan: a display list sent with `put_group`/`append_group` crossed into wasm as a
`&str`, and wasm-bindgen copies a string with a JavaScript loop, one `charCodeAt` per character.
An imported page's tablet view is one 13 MB group, so a single put was hundreds of ms at CPU 4x.

The seven JSON entry points of `WebCore`/`WebGlCore` (`draw`, `put_group`, `append_group`,
`patch_group`, `patch_uses`, `set_overlay`, `set_live_overlay`) now take `&[u8]`; `overBytes` in
`core-web.ts` encodes with the native `TextEncoder` and wasm-bindgen copies with one `set`. Same
bytes parsed, so pixels are unchanged. The native-canvas bridge keeps strings.

Discarded for now: splitting a huge group across parts (its opacity and mask make it one layer),
and a worker for card layout (the profile does not show it).
