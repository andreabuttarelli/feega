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

An open-source infinite canvas for design that moves. Frames, vector tools, animation and a
timeline sit on one canvas; generation (text, image, video, audio, 3D) and the agent work on the same
nodes you do, from the sidebar chat, the [CLI / MCP server](cli/), or any MCP client. Use it hosted at
[feega.app](https://feega.app) or run it yourself.

## Features

- Frames, shapes, text, pen and shape tools, auto layout, components
- Keyframe animation and a timeline, exported as PNG, JPG, WebP, SVG, PDF, GIF, MP4
- Generate text, images, video, audio and 3D on the canvas, wired together as nodes
- A chat agent that edits the canvas, plus an MCP server and a `feega` CLI
- Realtime multiplayer, comments, versions, organisations

## Stack

- TypeScript and SvelteKit
- Supabase (Postgres, Auth, Storage, Realtime)
- Node.js 22
- MCP server and CLI in [`cli/`](cli/), with a [quickstart for agents](docs/agents-quickstart.md)

## Run locally

You need Docker (or OrbStack). With only the required settings the canvas, animation and export work;
AI features say which key to add.

```sh
git clone https://github.com/andreabuttarelli/feega && cd feega/infra/compose
docker compose up          # Supabase + schema + demo data + the app, about 5 minutes the first time
```

Open http://localhost:3000 and sign in with `demo@feega.local` / `feega-demo-2026` (printed by the
`migrate` service).

Developing the app instead of running the image:

```sh
supabase start && npm ci && npm run setup && npm run dev    # http://localhost:5173
```

Optional keys (AI providers, Stripe, Sentry, email) are listed by feature in
[`.env.example`](.env.example). Nothing is credit-gated: `BILLING_PROVIDER=open`. Full guide, limits
and timings: [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
before opening a pull request. For security vulnerabilities, follow
[SECURITY.md](./SECURITY.md) instead of filing a public issue.

feega is licensed under the [Apache License 2.0](./LICENSE).

Questions and ideas are welcome in the
[Discord community](https://discord.gg/PUp37DG6vr).
