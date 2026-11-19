# Dashboard becomes a Feega Cloud placeholder; GitHub Sponsors

Before: `/app` was the prompt composer plus the recents list and a create-canvas button.

Now: a greeting with the first name (`flags.name` from bootstrap), one line about the upcoming
Feega Cloud, one line pointing at the VS Code extension docs. Strings in `app.dashboard.*`.
Project and canvas routes, actions and data are untouched, only unlinked from the home. E2E
specs open canvases by URL.

Product direction: the MVP is the VS Code extension; the web app is a dashboard for now.

Sponsors: `.github/FUNDING.yml`, a README badge and a footer link on the landing. `inspect/` is not
on dev, so its README and Help menu are not touched. The owner must enable the Sponsors profile on
GitHub.
