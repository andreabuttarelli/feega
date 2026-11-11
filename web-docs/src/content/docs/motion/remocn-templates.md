---
title: Remocn templates
description: Sixty free Remocn animations, ported to feega as motion templates.
sidebar:
  order: 13
---

Sixty components of [Remocn](https://github.com/Remocn/remocn) (MIT) are built-in motion templates: kinetic
text, counters and charts, UI flows, logo reveals, transitions, generative backgrounds and camera scenes. Each
plays at the original size, frame rate and length, with the same springs and easings.

## From the editor

1. Open a motion frame and open **Templates**.
2. Search for the name (for example *Soft blur in*, *Animated bar chart*, *Signup flow*).
3. Insert it and edit its fields in the Properties panel: text, colours, font, theme and timing.

## From an agent, MCP or CLI

The motion agent lists them with `list_templates` and places one with `add_template`. Ids start with
`builtin:remocn-`, for example `builtin:remocn-soft-blur-in`.

```bash
feega motion ask <nodeId> "add the remocn soft blur in saying 'Think different.'"
```

## Ids

`ai-prompt-flow`, `anamorphic-flare`, `animated-bar-chart`, `animated-line-chart`, `bounce-logo`, `checkout-flow`, `confetti`, `contribution-heatmap`, `dolly-zoom`, `echo-stack`, `exploded-view`, `fade-through`, `flow-field`, `focus-blur-resolve`, `glass-code-block`, `impact-shake`, `infinite-marquee`, `iris-wipe`, `isometric-build`, `kinetic-center-build`, `life-grid`, `liquid-fill`, `logo-enter`, `long-shadow`, `marker-highlight`, `mask-reveal-up`, `matrix-decode`, `neon-sign`, `number-wheel`, `onboarding-stepper-flow`, `orbit-lock`, `parallax-depth`, `pendulum-wave`, `per-character-rise`, `phyllotaxis`, `rgb-glitch-text`, `rolling-number`, `rolodex-flip`, `settings-toggle-flow`, `share-donut`, `shared-axis-z`, `shimmer-sweep`, `signup-flow`, `slide-doors`, `slot-machine-roll`, `soft-blur-in`, `sparkline-thread`, `spotlight`, `spring-scale-in`, `squeeze-in`, `staggered-fade-up`, `strikethrough-replace`, `string-art`, `synthwave`, `terminal-simulator`, `topo-lines`, `tracking-in`, `type-wall`, `venetian-blinds`, `zoom-blur`

Licence notice: `THIRD_PARTY_NOTICES.md`.
