# Code import: a run plan for far more repositories

Before, code import booted a repository one way: `package.json` at the root, the `dev` script,
port flags for Next and Vite only, the package manager from the lockfile with yarn forced to v1,
no Node version, and in a monorepo the root `dev` (usually `turbo run dev`) started everything.
The local folder path passed `--host --port --strictPort` to every framework, which breaks
anything that is not Vite.

Now one pure module, `src/lib/server/code-import/run-plan.ts`, plans the boot from the file
list and the `package.json` texts, and both the sandbox runner and the local folder spawn what it
says. Two tables carry the exceptions: `FRAMEWORKS` (Next, SvelteKit, Nuxt, Astro, React Router 7 /
Remix on Vite, Gatsby, Angular, CRA, Vite, generic) and `MANAGERS` (npm, pnpm, yarn 1, yarn
Berry, bun). Flags were checked against each framework's CLI documentation, not by booting.

Decisions:

- `packageManager` is honoured through `npx -y <pm>@<version>`, not corepack: Node 25+ dropped
  corepack, and the Node 26 image would lose it.
- The Node line is picked after the files are read, so the sandbox boots on the default image and
  reboots once when the plan wants Node 22 or 26. Pre-reading the tree through the GitHub API was
  rejected: a second code path for private repos and uploads.
- A monorepo app runs from its own folder after a root install, rather than `--filter`: the same
  for every package manager.
- Several apps and none chosen is a refusal (`choose_app`, 409) carrying the list; the dialog,
  CLI (`--app`) and MCP (`app`) pass the pick back. The app is stored on the frame's code origin
  so a pull boots the same app.
- `tree/<ref>/<path>` is split against the real branch list (connected account, else the public
  API), longest branch first.

Not verified: no repository was booted. Each framework row is owed a real-boot check.
