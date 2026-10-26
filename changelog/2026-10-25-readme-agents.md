# README rewritten for humans and agents

Why: the README described the product but not how to run it. An agent had no
command sequence it could execute and check.

Now: "Run it locally" for people, "Run it locally as an agent" with three
commands, a port table and a failure table.

Found while verifying from a clean clone, and fixed:
- The app image build runs vite with an 8 GB heap: 28 minutes on a 7.7 GB
  Docker VM, out of memory when other stacks share it. A workflow
  (`app-image.yml`) now publishes `ghcr.io/andreabuttarelli/feega` on every
  push to `main`; compose pulls it and builds only when the pull fails.
- `migrate` talked to `kong` without depending on it. It now waits for
  `kong` to be healthy.
- With `KONG_HTTP_PORT`/`APP_PORT` changed, the app (in kong's network
  namespace) could not reach the public URLs: login said `fetch failed`, PNG
  export timed out. Kong also listens on the public port; the app listens on
  `APP_PORT`.
- `npm run smoke:selfhost` looked for an Animation button that now appears
  only in Animate mode. It switches mode first; the README uses it as step 3.
