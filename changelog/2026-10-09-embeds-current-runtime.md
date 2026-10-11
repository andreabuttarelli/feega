# Embeds load the runtime by reference

**Why.** A published embed stored the whole composed page, engine included. Fixes never reached
it: fd37d96f still ran the pre-#335 particle renderer (~70% CPU in per-particle radial
gradients, 29 fps desktop, 7–14 fps on a Pixel 7). Its 3D "night" look also blocked the first
frame on a 1.46 MB HDR from jsDelivr.

**What changed.**

- Publishing (agent `publishEmbed`, editor upload) now stores the *source*: doc, tokens, inlined
  assets, settings, title, as `<script type="application/feega-embed+json">` in the same
  `embeds/<nodeId>.html` object. `/e/[id]` composes it on read (`hostedPage`) with the code of
  the current deploy.
- `RuntimeDelivery.Hosted` makes `composeHtml` load engine, particle renderer, live runtime,
  shader fx and the bundled custom libraries from `/motion-runtime/<chunk>.<hash>.js`
  (content-hashed, immutable, shared by every embed). `Inline` (default: editor, export,
  downloadable file) is unchanged in behaviour.
- Legacy pages (stored before this change) carry no doc, so they cannot be recomposed. On read
  `upgradePlayer` now also swaps their frozen particle renderer for the current chunk and their
  jsDelivr 1k HDR for ours, without blocking the first frame.
- Env maps: `static/motion-env/r181/*_256.hdr` (131 KB each, built by `scripts/env-maps.mjs`
  from the three.js r181 1k files). Live pages (`Target.Screen`) light with `RoomEnvironment`
  first and swap the HDR in when it lands (`EnvLoad.Swap`); exports (`Target.Video`) still wait.

**Discarded.** Externalising every `.toString()` emitter (three, shapes, stage…): composing on
read already delivers their fixes; only the big shared blobs gained from caching. Rebuilding
legacy embeds from `nodes.data` on read: the public route would need the service role.

**Known edge.** The page is cached 60 s; during a deploy a cached page can reference a chunk hash
the new deploy no longer serves (404) for up to that minute.
