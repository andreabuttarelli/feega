---
title: Install on macOS
description: Download the feega desktop app, open it the first time, and check the download.
sidebar:
  order: 1
---

The macOS app is feega itself: sign in and you get your orgs, projects, billing and AI, as on
the web. It can also open a `.feega` file in [local mode](/getting-started/local-mode/), with no
account. It is **not signed with an Apple Developer ID**, so macOS
asks you to confirm it once. This page walks through that.

## 1. Download

Open the [latest release](https://github.com/andreabuttarelli/feega/releases/latest)
and download the file for your Mac:

| Mac | File |
|---|---|
| Apple silicon (M1 and later) | `feega-<version>-mac-arm64.dmg` |
| Intel | `feega-<version>-mac-x64.dmg` |

Not sure? Apple menu → **About This Mac**: "Chip Apple M…" is Apple silicon, "Processor Intel" is Intel.
A `.zip` of the same app sits next to each `.dmg` if you prefer it.

## 2. Check the download (optional, recommended)

Each release publishes `SHA256SUMS.txt`, and the release version is the same as the `feega` npm package. In Terminal:

```bash
cd ~/Downloads
shasum -a 256 feega-*-mac-*.dmg
```

The printed hash must match the line for the same file in `SHA256SUMS.txt`. If it does not, delete
the file and download it again.

## 3. Drag to Applications

Double-click the `.dmg`, drag **Feega** onto **Applications**, then eject the disk image.

## 4. Open it the first time

### macOS 15 Sequoia and later (including Tahoe)

1. Double-click **Feega** in Applications. macOS says it "Not Opened" because Apple could not
   verify it. Click **Done** (not *Move to Trash*).
2. Open **System Settings → Privacy & Security** and scroll down to **Security**. You will see
   *"Feega" was blocked to protect your Mac.*
3. Click **Open Anyway**, then confirm with your password or Touch ID.
4. Click **Open Anyway** once more in the dialog that follows.

The button appears only for about an hour after step 1. If it is gone, open the app again first.

### macOS 14 Sonoma and earlier

Right-click (or Control-click) **Feega** in Applications → **Open**, then **Open** in the dialog.

You do this once. Afterwards Feega opens like any other app.

### Terminal alternative

Removing the download flag skips the dialogs entirely:

```bash
xattr -dr com.apple.quarantine /Applications/Feega.app
```

Run it before the first open. If it prints `Operation not permitted`, macOS is protecting the app
after a blocked launch: give Terminal access in **System Settings → Privacy & Security → App
Management**, or use the Open Anyway steps above.

## "Feega is damaged and can't be opened"

This message means macOS found the app's signature broken, usually because the download was cut
short or the app was copied in a way that changed its files. It is not a feega account issue.

1. Move Feega to the Trash.
2. Download the `.dmg` again and [check its hash](#2-check-the-download-optional-recommended).
3. Drag it to Applications again and repeat step 4.

If the hash matches and the message still appears, run the Terminal command above and open the app.

## Signing in

- Email and password sign in inside the app.
- **Continue with Google** or **GitHub** opens your browser for the provider, then returns to
  the app on its own (it asks once to open Feega). You stay signed in across restarts.
- **Sign out** is in the ☰ menu, as on the web. **Feega → Settings…** (⌘,) opens the settings
  of the project you are in.
- Links to other sites open in your browser. Exports (MP4, PNG) ask where to save.
- Offline, the app shows a retry screen and reconnects when the network returns.

## Local files

- **File → Open Local File…** (⌘O) or double-click a `.feega` file opens it in local mode: no
  account, every change saved to the file. **File → New Local Canvas…** and **Save As…** work on
  `.feega` files; dropping a `.feega` file on the window opens it too.
- **Import code → Folder** takes a project folder on your Mac (it needs a `package.json` and a
  `dev` script, with Node and Google Chrome installed). Edits on the canvas are written back to its files.
- AI in local mode needs your own provider keys: put a `.env` with them, as in
  [local mode](/getting-started/local-mode/), in the same folder as the `.feega` file.
- **File → Back to feega** returns to your account.

## Updates

The app checks GitHub for a newer release when it starts and every 4 hours. When there is one, it
offers **Download**, which opens the release page. Download the new `.dmg` and drag Feega to
Applications to replace the old one; your account and `.feega` files are untouched. Unsigned apps cannot
replace themselves on macOS, so updates are this one drag.

## Why it is unsigned

Signing and notarising require a paid Apple Developer account, and this build is published
without one. The app is built from the public source in this repository by a GitHub Actions
workflow, and the release lists the SHA-256 of every file it attaches, so you can check that what
you downloaded is what the workflow built. macOS still sees an *ad-hoc* signature, which is why it
warns about an unidentified developer instead of refusing the app.
