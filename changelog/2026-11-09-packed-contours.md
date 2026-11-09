# Packed contours in gpu-core's display list decode

`parse_packed` reads contours from a side float buffer; 5–8x faster than
`serde_json` on real frames (ADR 0034). Not wired to wasm or JS yet.
`examples/parse_cost.rs` and `parse_packed_cost.rs` measure both.
