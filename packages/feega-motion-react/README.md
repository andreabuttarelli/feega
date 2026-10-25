# @feega/motion-react

Embed a [feega](https://feega.app) motion video in a React app. A plain video is drawn inline,
in your page, by feega's GPU engine (gpu-core: WebGPU, WebGL fallback), loaded from `origin`. A
video that reads live input (pointer, tilt, keys, variables) runs in the hosted player in an
iframe, so it behaves exactly as on the web. Props, callbacks and the ref are the same either way.

```bash
npm i @feega/motion-react
```

```tsx
import { FeegaMotion } from '@feega/motion-react';

<FeegaMotion id="<video id>" origin="https://oh.feega.app" />
```

The video fills its parent. A video set to "scroll scrubs the timeline" builds its own scroll
story (the saved number of screens, pinned while you scroll), as the web embed does.

| Prop | |
|---|---|
| `id` | the published video id |
| `origin` | where feega serves embeds; defaults to `https://oh.feega.app` |
| `fit` | `'cover'` (default) or `'contain'` |
| `scrollLength` | screens of scroll story; default from the video, `0` for none |
| `scrollContainer` | a ref to the element that scrolls, when it is not the page |
| `vars` | runtime variables, e.g. `{ speed: 2, label: 'Hi' }`: only changed values are posted, the iframe never remounts |
| `onReady(info)` | `{ width, height, duration, playback, loop, vars, values }`: `vars` is the schema (name, kind, default, min/max or options) |
| `onVarsChange(values)` | the values the player kept after an update (clamped, unknown names dropped) |
| `onTimeUpdate(time, duration)`, `onEnded()`, `onError(message)` | |
| `onLinkClick(url)` | given: you open links; absent: the player opens them in a new tab |
| `ref` | `play()`, `pause()`, `seek(seconds)`, `setVars(values)` |

SSR-safe (Next.js app and pages router, Remix): nothing touches `window` until mounted, and the
module is marked `'use client'`. The server renders an empty stage; the player appears once mounted. React 18 and 19. No dependencies.

Protocol: [`docs/embed-protocol.md`](../../docs/embed-protocol.md).

## Example

```bash
cd example && npm install && npm run dev
# another origin: http://localhost:5173/?origin=http://127.0.0.1:5391
# runtime variables driven by React controls: http://localhost:5173/vars.html?id=<video id>
```

## Publish

```bash
npm run build      # dist/esm, dist/cjs, .d.ts
npm publish --access public
```
