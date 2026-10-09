# Embed protocol, version 1

Every host runs the **same player**: the page served at `/e/<id>`. A host never reimplements it;
it only frames it and talks to it with the messages below. The web loader (`/embed.js`), the
React SDK (`packages/feega-motion-react`) and the Flutter SDK (`packages/feega_motion_flutter`)
are three hosts of this one protocol.

```
 host (web page / React / Flutter)                player (/e/<id>)
 ─────────────────────────────────                ────────────────
   iframe or WebView  ── feega:host ──────────▶   playerMain (player.ts)
                      ◀── feega:player ───────    hyperframes player → composition
```

Source of truth: `src/lib/motion/interactive/{host,protocol,player}.ts`.
`src/lib/motion/interactive/protocol.test.ts` fails if either SDK drifts from it.

## Endpoints

| URL | What |
|---|---|
| `GET /e/<id>?fit=cover\|contain` | the player page; fills its frame |
| `GET /e/<id>.json` | `{ width, height, playback, scrollLength }`, CORS open |

`playback` is `autoplay`, `in-view`, `scrub` or `paused`. A `scrub` video is driven by host
progress; a host builds a scroll story `scrollLength` viewports tall with the player pinned in it.

## Transport

- **Host → player**: `postMessage(message, '*')` to the player window. A WebView host runs
  `window.postMessage(message, '*')` inside the page.
- **Player → host**: `parent.postMessage(message, '*')` when framed, and
  `window.FeegaHost.postMessage(JSON.stringify(message))` when a native bridge named `FeegaHost`
  exists (Flutter `JavaScriptChannel`).

Hosts must check the message comes from their own player (`event.source`) and ignore unknown
`type`, `v` or `event` values.

## Host → player: `{ type: 'feega:host', ... }`

Every field is optional; send only what changed.

| Field | Type | Effect |
|---|---|---|
| `progress` | `0..1` | scrub position; seeks a `scrub` video, feeds the `scroll` input |
| `scroll` | `0..1` | legacy whole-page scroll, read when `progress` is absent |
| `visible` | `boolean` | an `in-view` video plays when true, pauses when false |
| `gesture` | `true` | the host cannot measure scroll: the player scrubs on wheel and drag |
| `command` | `'play' \| 'pause' \| 'seek'` | playback; held until ready if sent earlier |
| `time` | seconds | target of `seek` |
| `fit` | `'cover' \| 'contain'` | re-fit without reloading |
| `links` | `'host'` | the host opens links; the player reports them instead of opening |
| `reducedMotion` | `boolean` | when true an `autoplay` video does not start by itself |
| `pointer` | `{ x, y, down }`, x/y `0..1` of the video | pointer input from a host that owns touches |
| `tilt` | `{ x, y }`, `-1..1` | device tilt from native sensors |

## Player → host: `{ type: 'feega:player', v: 1, event, ... }`

| `event` | Fields | When |
|---|---|---|
| `size` | `width`, `height`, `aspect` | at once, before loading: the player is listening |
| `ready` | `width`, `height`, `duration`, `playback`, `loop` | the video can play |
| `timeupdate` | `time`, `duration` | playback time moved |
| `ended` | — | the end was reached |
| `link` | `url` (http/https only) | the video asked to open a link and the host claimed links |
| `error` | `message` | playback failed |

A host sends its first messages (`links`, `reducedMotion`, progress) on `size`.

## Links

A composition asks for a link by posting `{ type: 'feega:link', url }` to the player. The player
accepts it only from its own composition frame and only for `http(s)`. With no host claim it opens
the URL in a new tab; with `links: 'host'` it emits `link` and the host decides (React:
`onLinkClick`; Flutter: `onLinkClick`, or the external browser by default). No composition emits
`feega:link` yet: the route exists so hosts are ready when one does.

## Versioning

`v` changes only on a breaking change. New optional fields and events do not bump it; hosts
ignore what they do not know.
