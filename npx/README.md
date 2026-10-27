# feega

```bash
npx feega my-board.feega
```

Starts feega's local mode on http://localhost:5173 and saves the canvas to `my-board.feega` in the current directory. Needs Node 22+. Each start checks for a newer app and downloads it into `~/.feega/app/<version>/`; offline it uses the newest cached one.

Options: `--port <n>`, `--no-open`. `FEEGA_APP_BUNDLE=<path or url>` uses another bundle.
