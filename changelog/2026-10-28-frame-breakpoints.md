# Frame breakpoints: model, resolve, agent tools

A frame needs views at several widths (Desktop 1440, Tablet 810, Phone 390) where a change at
one width applies there and below. Before, a frame had one size; reflow came only from auto
layout and constraints when it was resized.

- `doc.breakpoints` + `clip.overrides[breakpointId][key]`, key from one whitelist table
  (`breakpoints/model.ts`). The base view is the doc, never overridden.
- `resolveAt` cascades widest first and returns a plain doc; `mediaQueries` exposes the same
  data for codegen as max-width steps. Codegen untouched.
- Agent tools: `add_breakpoint`, `remove_breakpoint`, `set_breakpoint_override` (`stack: true`
  writes explicit direction/fill overrides).
- No automatic reflow: a new view inherits everything.
- Canvas side-by-side views and inspector indicator: next PR.
- ADR 0022 records the rejected alternatives.
