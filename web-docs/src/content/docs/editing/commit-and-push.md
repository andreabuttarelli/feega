---
title: Commit and push
description: Commit the files Feega edited and push them to GitHub from the Changes tab.
sidebar:
  order: 13
---

The **Changes** tab has a commit area above the list of edits. It runs the `git` already installed on your machine in your project folder. No AI is involved.

## What you see

- The current branch, and how many commits it is ahead of or behind its upstream.
- A commit message, prefilled from your edits, for example `Update padding and font size in Hero`. Change it freely.
- The files that will be committed. By default these are the files Feega edited. Choose **All changes** to include every changed or new file in the repository.

## Buttons

| Button | What it does |
|---|---|
| **Commit** | Commits the listed files. Other changes, staged or not, stay as they are. |
| **Commit & push** | Commits, then pushes. A branch without an upstream is pushed to `origin` and tracks it from then on. |
| **Push** | Pushes the commits that are ahead. |
| **Pull** | Runs `git pull --ff-only`. It shows when the branch is behind or a push was rejected. |

Feega never force pushes.

## When it cannot go on

| Message | What to do |
|---|---|
| Git is not installed | Install git and make sure it is on your `PATH`. |
| Not a git repository | Run `git init` in a terminal. Feega does not create repositories. |
| Nothing to commit | Edit something, or switch to **All changes**. |
| No remote | Add one with `git remote add origin <url>`. |
| The remote has commits you do not have | Press **Pull**, then push again. |
| Branches have diverged | Run `git pull --rebase` in a terminal. Feega only fast-forwards. |
| Git could not sign in | Sign in to git or GitHub in a terminal, for example with `gh auth login`, then try again. |
| Git does not know who you are | Set `user.name` and `user.email` with `git config --global`. |

Feega never asks for, reads or stores credentials. Pushes use your own git setup: credential helper, SSH keys or `gh`. Git is told not to prompt, so a missing sign-in fails with a message instead of hanging.
