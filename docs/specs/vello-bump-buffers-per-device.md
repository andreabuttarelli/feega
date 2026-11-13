# vello's bump buffers, sized per device — handoff note

Status: proposal, not started. Owner: whoever owns `packages/gpu-core` (engine work runs on
another machine; this note exists so the finding is not lost).

## What they cost

On the WebGPU core, vello allocates its bump buffers once per renderer, at fixed sizes
(`packages/gpu-core/vendor/vello_encoding/src/config.rs`, `BufferSizes::new`):

| buffer | elements | bytes |
|---|---|---|
| lines | 2^21 × 24 B | 48 MB |
| segments | 2^21 × 24 B | 48 MB |
| tiles | 2^22 × 8 B | 32 MB |
| ptcl | 2^23 × 4 B | 32 MB |
| seg_counts | 2^21 × 8 B | 16 MB |
| **total** | | **176 MB** |

Measured in Chrome WebGPU emulating the owner's iPhone state: 224 MB of live GPU buffers, 176 of
them these. The iOS simulator runs the WebGL core, so none of this shows in the simulator
footprint figures of the phone-memory work; a WebGPU iPhone pays it on top.

## How overflow is handled today

`engine.rs` sets `LINES` and `SEGMENTS` to the same 2^21 and reports `fullness()` =
max(estimated lines / LINES, estimated segments / SEGMENTS), from vello's CPU `bump_estimate`
before dispatch. `tiles.rs::split_render` halves a tile render whose fullness is over 1 (up to
`MAX_SPLITS`), and keeps the halves when together they hold 1.75× the parent
(`SHARED_BY_HALVES`) — history in #2018, #2037, #2042. The estimate reports 0 for tiles and
ptcl, so an overflow there is neither measured nor split: it is silent (blank or garbled tile).

## Proposal

1. Instrument first, read-only: expose the max `fullness` per frame in `render_tally`, run the
   landings pan and zoom on the phone profile (393×852, DPR 3, resolution 2), and record the
   distribution.
2. Make `LINES`/`SEGMENTS` (and vello's `lines`, `segments`, `seg_counts`) a value passed at
   attach from the device budget table (`src/lib/canvas/gpu/memory-budget.ts`), not constants.
   - phone 2^20: saves 56 MB; 2^19: saves 84 MB.
   - cost: a render whose fullness lands between the new and the old capacity is split into
     halves (one more plan + draw each). If p99 fullness at phone resolution is under 0.5,
     2^20 costs no split at all.
3. Leave `tiles` and `ptcl` at their sizes until they have an estimate; shrinking them without
   one trades memory for silent corruption.

Desktop keeps today's sizes (its row in the table).
