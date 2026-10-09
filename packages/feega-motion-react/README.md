# @feega/motion-react

Embed an interactive [feega](https://feega.app) motion video in a React app. It runs the same
hosted player as the web embed, so pointer, tilt, keys, taps and scroll scrubbing behave exactly
as on the web.

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
| `onReady(info)` | `{ width, height, duration, playback, loop }` |
| `onTimeUpdate(time, duration)`, `onEnded()`, `onError(message)` | |
| `onLinkClick(url)` | given: you open links; absent: the player opens them in a new tab |
| `ref` | `play()`, `pause()`, `seek(seconds)` |

SSR-safe (Next.js app and pages router, Remix): nothing touches `window` until mounted, and the
module is marked `'use client'`. React 18 and 19. No dependencies.

Protocol: [`docs/embed-protocol.md`](../../docs/embed-protocol.md).

## Example

```bash
cd example && npm install && npm run dev
# another origin: http://localhost:5173/?origin=http://127.0.0.1:5391
```

## Publish

```bash
npm run build      # dist/esm, dist/cjs, .d.ts
npm publish --access public
```
