# A trapped GPU core recovers instead of poisoning the canvas

CI run 43353901102 (inspector audit, rect, "Colour alpha slider/drag", software GPU on xvfb)
threw `recursive use of an object detected which would lead to unsafe aliasing in rust`, then
every later row failed.

Cause: `gpu-core` builds with `panic = "abort"`. A Rust panic inside a `&mut self` method traps
(`WebAssembly.RuntimeError`) before wasm-bindgen releases the object's borrow flag. Every later
call on that `WebCore` then reports "recursive use" — not real re-entry (no `&mut self` method is
async or calls back into JS that reaches the engine). `paint()` caught the first trap and
reattached, but calls outside its `try` (thumb `poster`, `dropGroup` in a `finally`) kept hitting
the poisoned object and threw uncaught.

Fix: `overBytes` guards every wasm call. A trap or a stuck-borrow error marks the core poisoned
and drops the wasm module (`dropCore`); the caller still gets that first error. From then on
`lost()` answers true, so `paint()` attaches a fresh core, `poster` rejects, every other call is a
no-op.

Not found: the panic that traps on the software GPU. A local swiftshader run hit a different
failure (device lost, no WebGL), so the root panic is still unidentified.
