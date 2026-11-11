# Remocn components as motion templates

60 of the free Remocn components (MIT, (c) 2026 Remocn; React/Remotion motion library, https://github.com/Remocn/remocn)
are ported to feega custom components and listed as builtin templates `builtin:remocn-<id>`: kinetic text,
counters and charts, UI flows, logo reveals, transitions, generative backgrounds and camera scenes.

How: same mechanism as snapcn. Each port is `packages/motion-core/src/motion/remocn/ports/<id>.ts`, a
`SnapcnPort` (`draw(S, view)` returning `render(frame)`) built on the existing snapcn kit (Remotion-compatible
`spring`/`interpolate`/`Easing`, mulberry32 random); no second kit and no second spring helper. `remocn/catalog.ts`
globs the ports; `src/lib/motion/template/remocn.ts` and `remocn-cards.ts` build templates and cards, reusing the
snapcn field and card helpers. Props are the upstream `config.ts` controls with the same defaults; `speed` and a
Font prop were added where upstream hardcoded them. Visible copy and defaults say feega.

Tests: `remocn/catalog.test.ts` (valid custom component, isolated source, plays frames in jsdom, no empty image,
no upstream brand name) and `template/remocn.test.ts`. Previews generated with `scripts/component-previews.ts`.

Not ported: shader-* and gradient-engine (gsh) components, caption-* (need word timings), anything with
video/audio/images, third-party-branded items (claude-chat, chat-gpt, v0, app-store-listing, x-follow-card,
telegram/imessage flows) and the large product-UI scenes. Ports with an upstream duration that depends on a
prop keep the default duration.

Licence: MIT, notice in THIRD_PARTY_NOTICES.md. No paid tier exists (README: "MIT, free").
