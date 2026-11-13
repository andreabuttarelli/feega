# feega

```bash
npx feega my-board.feega
```

Starts feega's local mode on http://localhost:5173 and saves the canvas to `my-board.feega` in the current directory. Needs Node 22+. Each start checks for a newer app and downloads it into `~/.feega/app/<version>/`; offline it uses the newest cached one.

Run it inside a project with a `dev` script and it asks once to import the folder: every static page of its router (up to 20) lands on the canvas as editable frames; dynamic pages are skipped and listed, and with no router found only the home page is imported. `--import` imports without asking, `--no-import` never asks.

`--routes <list|all>` picks pages (`/,/about`, default `all`) and `--app <path>` picks the app in a monorepo; without it a terminal asks.

Options: `--port <n>`, `--no-open`, `--import`, `--no-import`, `--routes`, `--app`. `FEEGA_APP_BUNDLE=<path or url>` uses another bundle.

AI keys: put them in the environment or in a `.env` in the folder you run `npx feega` from. Kie.ai, OpenRouter, the text LLM, Higgsfield, Wiro and ElevenLabs are supported; see the local mode docs for the variables.

## Telemetry

On start, `npx feega` sends one anonymous event to PostHog (EU): `npx_feega_started`, plus `npx_feega_active_day` on the first start of each day. Each carries the feega version, OS, CPU architecture, Node version and a random install id stored in `~/.feega/telemetry-id`. No IP or location is kept, and no canvas content, file names or paths are sent. The first run prints a one-line notice.

Turn it off with `FEEGA_TELEMETRY=0` or `DO_NOT_TRACK=1`. It is also off when `CI` is set.
