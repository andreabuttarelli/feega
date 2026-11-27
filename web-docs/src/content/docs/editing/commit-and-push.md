---
title: Commit and push
description: Commit the files Feega edited and push them to GitHub from the Changes tab.
sidebar:
  order: 13
---

The **Changes** tab has a commit area above the list of edits. It runs the `git` already installed on your machine in your project folder. No AI is involved.

## What you see

The commit area starts collapsed as one row: **Commit 2 changes**, the branch, and a **Commit & push** button. The arrow opens the rest, and Feega remembers whether you left it open. A message that needs action, such as a rejected push, opens it by itself.

Open, it shows:

- A header such as **Commit 2 changes in 1 file**. One commit holds every edit listed under **Included in this commit**, together. Edits are not committed one at a time.
- The current branch, and how many commits it is ahead of or behind its upstream.
- A commit message, prefilled from your edits, for example `Update padding and font size in Hero`. Change it freely.
- A switch between **Feega edits** (the default: the files Feega edited) and **All changes** (every changed or new file in the repository), and the list of files that will be committed.

## Buttons

| Button | What it does |
|---|---|
| **Commit & push** | Commits, then pushes. A branch without an upstream is pushed to `origin` and tracks it from then on. Without a remote this is just **Commit**. |
| **Commit** | Commits the listed files. Other changes, staged or not, stay as they are. |
| **Push** | Shown only when commits are waiting to be pushed. |

Feega never force pushes.

## When something goes wrong

Every message comes with the button that fixes it.

| Message | Button |
|---|---|
| The branch is behind its upstream | **Pull** runs `git pull --ff-only`. |
| The push was rejected | **Pull and push** runs `git pull --ff-only`. If the branches diverged and your working tree is clean, it runs `git pull --rebase` instead, then pushes. On a conflict it runs `git rebase --abort`, leaves everything as it was and offers the agent. |
| Branches have diverged | **Ask your agent to sync** starts your local AI agent in the AI tab with the git state and error, and asks it to resolve it without force pushing. |
| A hook failed, a conflict, or anything else git cannot solve with a safe command | **Fix with your agent**, the same way. Without an installed agent the button takes you to the AI tab to install one. |
| Git could not sign in | **Copy `gh auth login`**. Run it in a terminal, then try again. |
| Git does not know who you are | Type a name and email and press **Save**. They are written to this repository's git config with `git config user.name` and `git config user.email`. |
| Not a git repository | **Copy `git init`**. Feega does not create repositories. |
| No remote | **Copy `git remote add origin <url>`**. |
| Nothing to commit, git not installed | Nothing to press: edit something, or install git. |

Feega never asks for, reads or stores credentials. Pushes use your own git setup: credential helper, SSH keys or `gh`. Git is told not to prompt, so a missing sign-in fails with a message instead of hanging.
