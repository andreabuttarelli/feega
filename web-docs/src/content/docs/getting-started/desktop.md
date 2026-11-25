---
title: Desktop app (beta)
description: Install the Feega desktop app on macOS with one terminal command or the dmg, and what it does.
sidebar:
  order: 4
---

The desktop app runs Feega without an editor. Open a project folder and Feega starts its dev server and the editor in a tab.

It is a beta. The app is not signed with an Apple developer certificate yet, so macOS treats it as software from an unidentified developer. The two install methods below deal with that.

## Install from the terminal

```bash
curl -fsSL https://www.feega.app/install | sh
```

The script downloads the right build for your Mac (Apple silicon or Intel), replaces `/Applications/Feega.app` (or `~/Applications/Feega.app` if `/Applications` is not writable), and opens it. A running Feega is quit first.

Files downloaded with `curl` carry no quarantine flag, so macOS does not block the app.

On Linux the script saves the AppImage as `~/.local/bin/feega`.

## Install from the dmg

Download the dmg for your Mac from the [download page](https://www.feega.app/download):

- Apple silicon: `Feega-mac-arm64.dmg`
- Intel: `Feega-mac-x64.dmg`

Open it and drag Feega to Applications. A browser download is quarantined, so macOS refuses the first launch. Open **System Settings → Privacy & Security**, scroll to the message about Feega and press **Open Anyway**. You only do this once.

## Using it

- **Welcome tour.** The first launch shows the same short tour as the editor. Sign-in is optional, and **skip** or Esc closes it. Replay it from Settings.
- **Start screen.** With no tab open you see **New project**, **Open folder** and your recent projects. No account is required. See [Start a new project](/getting-started/new-project/).
- **Node.js.** The app needs Node.js 20 or newer and npm. At launch it reads your shell's `PATH`, so tools from Homebrew, nvm or similar are found. If Node.js is missing it shows an **Install Node.js** link and **Check again**.
- **AI agents.** The AI chat starts the agents installed on your machine, and downloads their adapters into the app's data folder.
- **Tabs per folder.** Add a folder with the plus button. Each folder gets its own tab with its own dev server and editor.
- **Monorepos.** If a folder holds several apps, the tab asks which one to open.
- **Sign in.** Sign in from the account chip to use your Feega account, or continue without one.
- **Settings.** Open them with Cmd+, :

| Setting | Meaning |
|---|---|
| Editor port | Auto, or a custom port for the first editor. More tabs take the next free one. |
| Open last projects on launch | Reopen the folders that were open when you quit. |
| Feega Cloud (beta) | Off by default. Also in the Feega menu. Applies to editors opened after you change it. |
| Onboarding | **Show again** replays the welcome tour. |
| Anonymous usage data | Counts only, never your code. Off starts the editor with `FEEGA_TELEMETRY=0`. See [Privacy](/more/privacy/). |
