# Self-hosting

Run feega on your own machine or server: the infinite canvas, design and motion editing, image
export, and the agent and MCP surface. Nothing is credit-gated.

For one canvas on your machine, no account and no database, skip all of this:
`npx feega my-canvas.feega` (Node 22+) starts local mode and saves to that file. See
[local mode](../web-docs/src/content/docs/getting-started/local-mode.md).

For the full multi-user app, two ways in, both end at a demo login and a canvas with one frame on it:

| | Needs | One command |
|---|---|---|
| **Docker** | Docker (or OrbStack) | `cd infra/compose && docker compose up` |
| **Supabase CLI** | Node 22+, Docker (the CLI runs Supabase in it) | `supabase start`, then `npm ci && npm run setup && npm run dev` |

Both were run from a clean clone; timings are at the end.

## What works with no keys

With only the required environment (below), you get:

- sign in, organisations, projects, canvases
- frames, shapes, text, vector tools, animation and the timeline
- exporting a frame as PNG/JPG/WebP/SVG/PDF
- realtime presence and edits between browsers
- the CLI and the MCP server against your instance

What needs a key, and what it says when the key is missing:

| Feature | Env to add |
|---|---|
| The chat agent, text generation, prompt enhancement | `LLM_API_KEY` |
| Image, video, audio, 3D generation | `OPENROUTER_API_KEY`, `WIRO_API_KEY` + `WIRO_API_SECRET`, `KIE_API_KEY`, `HIGGSFIELD_API_KEY_ID` + `HIGGSFIELD_API_KEY_SECRET` |
| Web search and browsing in the agent | `EXA_API_KEY`, `BROWSERLESS_API_KEY` |
| Paid plans | `STRIPE_SECRET_KEY` (not needed, see Billing) |
| Email | `RESEND_API_KEY` |

A feature without its key answers with a line such as `Add LLM_API_KEY to .env to enable the AI agent
and text generation.` instead of failing. [`.env.example`](../.env.example) lists every optional key
grouped by feature.

## Docker

```bash
git clone https://github.com/andreabuttarelli/feega && cd feega/infra/compose
docker compose up
```

It starts Postgres, Auth, REST, Realtime, Storage and the API gateway, applies the schema, seeds the
demo data and starts the app. The `migrate` service prints the login when it finishes:

```
Log in at http://localhost:3000/login
  email:    demo@feega.local
  password: feega-demo-2026
```

- The first run builds the app image: about 3 to 4 minutes on a laptop, plus the image pulls. Later
  runs start in under a minute.
- Every port is bound to `127.0.0.1`. `infra/compose/.env` holds **public demo secrets**; replace all
  of them before anything else can reach the stack (the file says which).
- Studio (table editor): `docker compose --profile studio up`, then http://localhost:54323.
- The app's own keys (`LLM_API_KEY`, ...) go in `infra/compose/.env` too; the compose file passes the
  ones it lists to the container.
- If the first start fails, `docker compose down -v` before trying again. A half-initialised database
  volume keeps its broken state and every later start fails on it.
- On macOS, clone outside `~/Documents`, `~/Desktop` and `~/Downloads`, or give Docker/OrbStack access
  to that folder in System Settings. A bind mount from a protected folder blocks the database
  container at startup with no error.

Image export (PNG, PDF, ...) draws on the server with headless Chromium; the app image ships one.

## Supabase CLI

```bash
git clone https://github.com/andreabuttarelli/feega && cd feega
supabase start      # Postgres, Auth, Storage, Realtime on :54321
npm ci
npm run setup       # writes .env from the running stack, applies the schema, seeds the demo
npm run dev         # http://localhost:5173
```

`npm run setup` is idempotent. It creates `.env` from `.env.example`, fills the Supabase URL and keys
from `supabase status`, generates `APP_SECRET`, sets `BILLING_PROVIDER=open`, runs `db:migrate` and
`db:seed`, and prints the login. If `supabase` is not running it says which keys are missing.

If port 5173 is taken, `npm run dev -- --port 5301` and set `PUBLIC_APP_URL=http://localhost:5301` in
`.env`: the app builds absolute links from that value, and form posts are checked against it.

Image export needs Chrome or Chromium on the machine running the app (found automatically on macOS and
Linux, or set `CHROMIUM_PATH`). Without one, export says the server renderer is not available.

### Your own Supabase project

Create a project, then fill the three Supabase values and `DATABASE_URL` (the direct Postgres
connection) in `.env`, and run `npm run setup`. The baseline needs the `pgcrypto`, `uuid-ossp` and
`vector` extensions, and `pg_jsonschema` when your plan offers it (without it the JSON shape checks are
skipped and the app still works).

## Required environment

| Variable | Why |
|---|---|
| `PUBLIC_SUPABASE_URL` | Your Supabase API. The browser and the server use the same address. |
| `PUBLIC_SUPABASE_ANON_KEY` | Public key. Must be your project's. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never sent to the client. |
| `PUBLIC_APP_URL` | The origin the app is served from, no trailing slash. |
| `APP_SECRET` | Signs tokens and seals stored secrets. `openssl rand -hex 32`. |
| `DATABASE_URL` | Only `npm run setup`, `db:migrate` and `db:seed` read it. |

Everything else is optional and grouped by feature in `.env.example`.

## Billing

`BILLING_PROVIDER=open` is the self-host default (`.env.example`, `npm run setup` and the compose file
all set it). It removes credit and quota metering: nothing is gated, and the credit chip in the UI is
informational. Leave it as is. Without it the app tries the hosted billing module, which is not part of
this repository, falls back to open and logs that it did.

## The schema

`supabase/baseline/` is the whole current schema as ordered SQL files: tables, constraints, functions,
indexes, triggers, row-level security, storage buckets and policies, realtime publication, grants and
the two reference tables. `npm run db:migrate` applies it to an empty database, then any migration in
`supabase/migrations/` or `supabase/canvas-migrations/` dated after the baseline
(`20261024090000`). What ran is recorded in `app_schema_migrations`; re-running applies only what is
new. The 386 older files in `supabase/migrations/` describe the previous product and are not applied.

Row-level security is on for every table. The service-role key bypasses it and is read only in
`src/lib/server/`.

## Models and generation

The model picker reads the `ai_models` table, which a cron fills from the providers. After adding keys,
fill it once by hand (under `npm run dev` the endpoint needs no secret):

```bash
curl http://localhost:5173/api/v1/ai-models/sync
```

Video and long image generations finish in the background: something has to call the cron endpoints
listed under `crons` in `vercel.json` with `Authorization: Bearer $CRON_SECRET`. A production build
refuses them without `CRON_SECRET`; `npm run dev` skips the check, which is safe on localhost only.

## Production build

```bash
npm run build:node && npm run start    # port 3000, reads .env
```

or the compose app image, which is the same build. Put your own TLS reverse proxy in front, set
`PUBLIC_APP_URL` and `ORIGIN` to the public origin, and replace every demo secret.

## Security

- The service-role key never reaches the client.
- Telemetry (Sentry, PostHog, Clarity, Seline, Meta Pixel) is off until you set your own key. Use your
  own projects.
- The demo user's password is public. Change `SEED_DEMO_PASSWORD` before you seed anything reachable.
- Do not commit `.env`.

## Limits today

- The model catalogue starts empty (see Models and generation); there is no seed of provider models.
- Server-side video rendering (agent and API MP4 output) defaults to the hosted render farm,
  `REMOTE_RENDER_URL`. Browser-side work and image export do not use it. Point it at your own or leave
  it unused.
- The docs reference no hosted-only services: social publishing, ads and calendar are gone from the
  product; some of their tables remain in the schema and are unused.
- The schema is a snapshot of production. Until migrations are written against it, an upgrade that
  adds a table ships as a new dated file under `supabase/migrations/`.

## Timings

Measured from a clean clone on a laptop (Apple silicon, images cached after the first pull):

| Step | Docker | Supabase CLI |
|---|---|---|
| Start Supabase | included below | 30 s |
| `npm ci` | in the image build | 14 s |
| `npm run setup` | in `migrate` | 1.5 s |
| App ready | 4.5 min first run (image build), 30 s after | `npm run dev` in ~2 s, first page compile ~10 s |
| Login, frame, shape, animation, PNG export (`npm run smoke:selfhost`) | 29 s | 26 s |

Add image pulls on a cold machine.

## Check it works

```bash
npm run smoke:selfhost    # logs in as the demo user, creates a frame, draws a shape,
                          # animates it, exports a PNG, and fails loudly if any step breaks
```

Set `PUBLIC_APP_URL` to where the app runs (`http://localhost:3000` for compose).
