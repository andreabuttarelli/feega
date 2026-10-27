# Production builds run on GitHub Actions

Vercel billed build CPU minutes for every production build. The repo is public, so
GitHub Actions minutes are free: `.github/workflows/deploy.yml` now builds each
project on a push to `main` (`vercel build --prod`) and uploads the output
(`vercel deploy --prebuilt --prod`). Vercel's own Git deploys are off
(`git.deploymentEnabled: false`) for the app, the MCP server and web-docs.

A project deploys only when the paths it ships changed in the push; `workflow_dispatch`
deploys all three. Needs the `VERCEL_TOKEN` repo secret.
