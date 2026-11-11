# Native addon: apply the vendored vello patch

#1996 added a `glyphless` feature to gpu-core's wasm `vello` dependency, served by `[patch.crates-io]` pointing at `packages/gpu-core/vendor/vello`. Cargo ignores patches of a non-root crate, so `apps/desktop/native` (its own root) resolved crates.io vello, found no `glyphless`, and `cargo build --locked` failed on every `desktop-native` run.

The addon now carries the same patch. Lockfile refreshed. Engine behaviour unchanged.
