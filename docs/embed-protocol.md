# Embed protocol, version 1 (1.1: runtime variables)

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
| `GET /e/<id>.json` | `{ width, height, playback, scrollLength, vars }`, CORS open |

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
| `vars` | `{ name: value }`, partial | runtime variables; see below |

## Player → host: `{ type: 'feega:player', v: 1, event, ... }`

| `event` | Fields | When |
|---|---|---|
| `size` | `width`, `height`, `aspect` | at once, before loading: the player is listening |
| `ready` | `width`, `height`, `duration`, `playback`, `loop`, `vars` (schema), `values` | the video can play |
| `timeupdate` | `time`, `duration` | playback time moved |
| `ended` | — | the end was reached |
| `link` | `url` (http/https only) | the video asked to open a link and the host claimed links |
| `error` | `message` | playback failed |
| `vars` | `values` (all current values) | a `vars` update changed something |

A host sends its first messages (`links`, `reducedMotion`, progress) on `size`.

## Runtime variables (1.1)

A video declares named, typed variables in the editor (Interactive preview → variables) or through
the agent (`declare_var`, `bind_var`). Each has a default. The host sets them from its own code
and the video changes on the next frame, without reloading.

| `kind` | Schema fields | Value | Read by |
|---|---|---|---|
| `number` | `default`, `min`, `max` | number, clamped to `min..max` | expressions as `vars.<name>` |
| `boolean` | `default` | `true`/`false` | expressions as `1`/`0` |
| `enum` | `default`, `options` | one of `options` | expressions as the option index |
| `color` | `default` | `#rrggbb` | colour of a bound Title/Text/Kicker/Caption (or Caption background) |
| `string` | `default` | text, up to 500 characters | text of a bound Title/Text/Kicker/Caption |

Custom live components read every value as `input.vars.<name>`.

- **Host → player**: `{ type: 'feega:host', vars: { speed: 2 } }`. Partial: only the names sent
  change. Unknown names, wrong types, unknown options and bad colours are dropped; numbers are
  clamped.
- **Player → host**: `ready` carries `vars` (the schema: `name`, `kind`, `default`, and
  `min`/`max` or `options`) and `values`, so a host can build controls. After every update that
  changed something the player emits `vars` with all current `values`.
- **Renders**: video exports and the editor preview use the defaults. `composeHtml({ vars })`
  renders other values deterministically.

Hosts:

| Host | Set | Hear |
|---|---|---|
| `<feega-motion>` (`/embed.js`) | `vars='{"speed":2}'` attribute (watched), `el.setVars({...})` | `ready` and `vars-changed` DOM events (`detail`) |
| React | `<FeegaMotion vars={{ speed }} />` (posts only changed values, same iframe), `ref.setVars` | `onReady(info.vars, info.values)`, `onVarsChange` |
| Flutter | `FeegaMotion(vars: {...})` (diffed on rebuild), `controller.setVars` | `onReady` (`info.vars`), `onVarsChange` |

Values sent before the player listens are held and sent on `size`. Examples:
`docs/examples/runtime-vars.html` (plain HTML) and `packages/feega-motion-react/example/vars.html`.

## Links

A composition asks for a link by posting `{ type: 'feega:link', url }` to the player. The player
accepts it only from its own composition frame and only for `http(s)`. With no host claim it opens
the URL in a new tab; with `links: 'host'` it emits `link` and the host decides (React:
`onLinkClick`; Flutter: `onLinkClick`, or the external browser by default). No composition emits
`feega:link` yet: the route exists so hosts are ready when one does.

## Versioning

`v` changes only on a breaking change. New optional fields and events do not bump it; hosts
ignore what they do not know. 1.1 (runtime variables) added `vars` both ways and the `vars`
event; `v` stays `1`.
