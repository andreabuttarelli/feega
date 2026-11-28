---
title: Desktop app (beta)
description: Install the Feega desktop app on macOS, Windows or Linux, and what it does.
sidebar:
  order: 4
---

The desktop app runs Feega without an editor. Open a project folder and Feega starts its dev server and the editor in a tab.

It is a beta. The macOS build is signed and notarized. The Windows build is not signed yet. Download any build from the [download page](https://www.feega.app/download).

## Install from the terminal

```bash
curl -fsSL https://www.feega.app/install | sh
```

The script downloads the right build for your Mac (Apple silicon or Intel), replaces `/Applications/Feega.app` (or `~/Applications/Feega.app` if `/Applications` is not writable), and opens it. A running Feega is quit first.

On Linux the script saves the AppImage as `~/.local/bin/feega`.

## Install on macOS

Download the dmg for your Mac from the [download page](https://www.feega.app/download):

- Apple silicon: `Feega-mac-arm64.dmg`
- Intel: `Feega-mac-x64.dmg`

Open it and drag Feega to Applications.

## Install on Windows

Download `Feega-win-x64.exe` from the [download page](https://www.feega.app/download) and run it. Windows may show "Windows protected your PC": click **More info**, then **Run anyway**.

## Install on Linux

Download `Feega-linux-x64.AppImage` from the [download page](https://www.feega.app/download), then:

```bash
chmod +x Feega-linux-x64.AppImage && ./Feega-linux-x64.AppImage
```

## Using it

- **Welcome tour.** The first launch shows the same short tour as the editor. Sign-in is optional, and **skip** or Esc closes it. Replay it from Settings.
- **Start screen.** With no tab open you see **New project**, **Open folder** and your recent projects. No account is required. See [Start a new project](/getting-started/new-project/).
- **Node.js.** The app needs Node.js 20 or newer and npm. At launch it reads your shell's `PATH`, so tools from Homebrew, nvm or similar are found. If Node.js is missing it shows an **Install Node.js** link and **Check again**.
- **AI agents.** The AI chat starts the agents installed on your machine, and downloads their adapters into the app's data folder.
- **Tabs per folder.** Add a folder with the plus button. Each folder gets its own tab with its own dev server and editor.
- **Monorepos.** If a folder holds several apps, the tab asks which one to open.
- **Sign in.** Sign in from the account chip to use your Feega account, or continue without one.
- **Updates.** When a new version is downloaded, a panel says "Feega <version> is ready". Press **restart now**, or **later** to hide it until the next launch. The "update ready · restart" button stays in the tab bar. With automatic updates off, the panel offers **update** instead. If an update fails, a small row offers **retry**.
- **Settings.** Open them with Cmd+, or from **Settings** in the Feega menu:

| Setting | Meaning |
|---|---|
| Editor port | Auto, or a custom port for the first editor. More tabs take the next free one. |
| Open last projects on launch | Reopen the folders that were open when you quit. |
| Feega Cloud (beta) | Off by default. Also in the Feega menu. Applies to editors opened after you change it. |
| Onboarding | **Show again** replays the welcome tour. |

The same page lists the editor settings under General, Dev server, AI agents and Notifications. They are the settings of the Feega menu, stored once for every project opened in the desktop app, so a change here or in the editor is the same value. **Anonymous usage counts** is one of them. See [Privacy](/more/privacy/).
