# Agent picker as a tile grid

The picker listed agents as rows with version, status badge, install command and Copy button. It is
now a grid of tiles: real mark, name, one dot when the agent is not ready. Not installed and
needs-npx tiles are dimmed and disabled with a tooltip; needs-login says "Sign in from your
terminal". Install and login commands, Copy and version are gone from the UI (`install`, `login`
and `version` stay in the API).

`AGENT_STATUS` rows now carry `tip` and `rank` instead of `label` and `copy`; `readyFirst` orders
the tiles. Marks live in `src/lib/acp/agent-marks.ts` as inline path data drawn with
`currentColor`, so both themes work: lobehub icons (MIT) for 13 agents, Augment's and Factory's
own favicons for Auggie and Droid, Feega's lobes for the cloud tile. No agent falls back to a
monogram. Considered: `static/agents/*.svg` files; rejected, an `<img>` cannot take `currentColor`.
