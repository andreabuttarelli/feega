<p align="center">
  <img src="static/favicon.svg" width="72" alt="feega" />
</p>

<h1 align="center">feega</h1>

<p align="center">
  <a href="https://github.com/andreabuttarelli/feega/stargazers"><img src="https://img.shields.io/github/stars/andreabuttarelli/feega?style=flat&logo=github&logoColor=white&labelColor=131313&color=c485fe" alt="GitHub stars" /></a>
  <a href="https://discord.gg/PUp37DG6vr"><img src="https://img.shields.io/badge/Discord-community-c485fe?style=flat&logo=discord&logoColor=white&labelColor=131313" alt="Discord" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-c485fe?style=flat&labelColor=131313" alt="Apache-2.0" /></a>
  <a href="https://feega.app"><img src="https://img.shields.io/badge/Get_started-feega.app-c485fe?style=flat&labelColor=131313" alt="Get started on feega.app" /></a>
</p>

![feega](./docs/readme-hero.png)

**feega is an open-source infinite canvas where people and AI agents design, animate and generate
together.** You draw frames, animate them on a timeline and export them; the chat agent, the
[`feega` CLI and MCP server](cli/) work on the same nodes you do. Use it hosted at
[feega.app](https://feega.app) or run the whole thing on your machine.

## What you can do

- **Design**: frames, shapes, text, pen and boolean tools, auto layout, components, paste from Figma
- **Animate**: keyframes and a timeline; export PNG, JPG, WebP, SVG, PDF, GIF, MP4, Lottie
- **Generate**: text, images, video, audio and 3D as canvas nodes wired together
- **Delegate**: a chat agent, an MCP server and a CLI that read and edit the canvas
- **Collaborate**: realtime multiplayer, comments, versions, organisations

## Run it locally

Everything runs on your machine: no hosted service, no account, no key. Design, animation and export
work as they are; AI features say which key to add.

You need Docker (or OrbStack).

```sh
git clone https://github.com/andreabuttarelli/feega && cd feega/infra/compose
docker compose up
```

Open http://localhost:3000 and sign in with `demo@feega.local` / `feega-demo-2026`.

## Run it locally as an agent

The same path, non-interactive, with a check at the end. Run from the repository root.

```sh
docker info > /dev/null                                   # 1. Docker is running, or stop here
(cd infra/compose && docker compose up -d --wait)         # 2. Supabase + schema + demo data + app
npm ci && npx playwright install chromium && npm run smoke:selfhost   # 3. must exit 0
```

Step 2 pulls the prebuilt app image `ghcr.io/andreabuttarelli/feega` and starts in about a minute.
`--wait` returns 0 only after the one-shot `migrate` service exits 0 (schema applied, demo user and
canvas seeded) and the app is healthy. Without that image (a fork, or `APP_IMAGE` pointing at a
tag that does not exist) compose builds it from source instead: about 28 minutes on a 7.7 GB Docker
VM, and it can run out of memory if other containers hold that memory. Give Docker 8 GB or more,
or stop other stacks. To rebuild from your checkout: `docker compose up -d --wait --build`.

Step 3 needs Node 22. It signs in as the demo user, opens the demo canvas, draws a shape, animates
it and exports a PNG; screenshots land in the current directory. If the app is not on port 3000,
set `PUBLIC_APP_URL` to match.

| | |
|---|---|
| App | http://localhost:3000 |
| Supabase API | http://localhost:8000 |
| Postgres | `localhost:5432`, password in `infra/compose/.env` |
| Login | `demo@feega.local` / `feega-demo-2026` |
| Stop / reset | `docker compose down` / `docker compose down -v` |

To work on the code instead of the image, use the Supabase CLI:

```sh
supabase start && npm ci && npm run setup && npm run dev    # http://localhost:5173
```

`npm run setup` is idempotent: it writes `.env` from the running stack, applies the schema and seeds
the demo user. The CLI and MCP server find a dev server on port 5173 by themselves; for the Docker
app set `PUBLIC_APP_URL=http://localhost:3000`. Connecting an agent:
[`docs/agents-quickstart.md`](docs/agents-quickstart.md).

When something fails:

| Signal | Fix |
|---|---|
| First `docker compose up` failed, every later one fails too | `docker compose down -v`, then start again |
| macOS: the database container hangs with no error | clone outside `~/Documents`, `~/Desktop`, `~/Downloads`, or grant Docker access to that folder |
| Port 3000, 8000 or 5432 taken | in `infra/compose/.env` set `APP_PORT`, `KONG_HTTP_PORT`, `POSTGRES_PORT`, and the URLs that carry them (`PUBLIC_APP_URL`, `SITE_URL`, `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL` ending in `/auth/v1`); for the dev server or `npm run dev -- --port 5301` with `PUBLIC_APP_URL` set to match |
| AI feature answers "Add … to .env" | add that key; the list by feature is in [`.env.example`](.env.example) |

Nothing is credit-gated (`BILLING_PROVIDER=open`). Full guide, limits and timings:
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Stack

TypeScript, SvelteKit, Supabase (Postgres, Auth, Storage, Realtime), Node.js 22, a WebGPU canvas
with a WebGL fallback.

## Run it locally as an agent

`infra/compose` starts in local mode (`FEEGA_LOCAL_MODE=1`): one canvas, no login, no token. Open
http://localhost:3000 and you are on it; the CLI and MCP server work without `feega login`:

```sh
PUBLIC_APP_URL=http://localhost:3000 feega projects
```

Any other project id gets a 403. The app refuses to start in this mode unless `PUBLIC_APP_URL` is
localhost. Details: [local mode](web-docs/src/content/docs/self-hosting/local-mode.md).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
before opening a pull request. For security vulnerabilities, follow
[SECURITY.md](./SECURITY.md) instead of filing a public issue.

feega is licensed under the [Apache License 2.0](./LICENSE).

Questions and ideas are welcome in the
[Discord community](https://discord.gg/PUp37DG6vr).
