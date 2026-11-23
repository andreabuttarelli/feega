---
title: Telemetry
description: The anonymous usage counts Feega Inspect and npx feega send, exactly what they contain, and how to turn them off.
sidebar:
  order: 4
---

The Feega extension and `npx feega` send anonymous usage counts. They tell us how many sessions
there are, how many edits are made, how long a session lasts, and on what kind of device.

## What is sent

Each event carries:

| Field | Value |
|---|---|
| Install id | A random UUID, created on first use. Not linked to an account. |
| Session id | A random UUID per opened panel (or per `npx feega` run). |
| Event | `install` (the first run on this machine), `opened` (Feega was opened), `session_start`, `preview_ready` (your page loaded in the preview), `first_edit` (your first edit ever), `edit` (a change was written to your source), `sign_in` or `sign_out` (no email or account id is sent), `session_resume` (you came back after 30 minutes away), `onboarding_started`, `onboarding_step` (which step), `onboarding_finished`, `onboarding_skipped`, `setup_applied`, `setup_failed`, `skill_hint_shown`, `skill_installed`, `library_insert` (free or pro, never which item), `plugin_installed` or `session_end`. |
| Edit kind | On `edit`: text, style, image, attribute, structure, template or other. |
| Context | The detected framework (for example `next` or `sveltekit`) and whether you are signed in to Feega. |
| Session end | Duration in milliseconds and the number of edits. |
| Environment | Feega version, editor (VS Code, Cursor, Windsurf, VSCodium or `npx`), operating system, CPU architecture, device kind (desktop, web, command line). |

The server adds country, region and city from the request. It does not store the IP address.

Events are batched and sent when the session ends and every few minutes. A failed send is dropped
silently and never slows the editor.

## What is never collected

Code, file names and paths, project names, URLs, the content of an edit, your account or email.

## Turn it off

- **Extension:** set `feegaInspect.telemetry` to off in Settings. It is also off whenever VS Code
  telemetry is off (`telemetry.telemetryLevel` set to `off`).
- **`npx feega`:** set `FEEGA_TELEMETRY=0` or `DO_NOT_TRACK=1` in the environment. The
  `feegaInspect.telemetry` entry in `.feega/settings.json` works too.

Turning it off takes effect immediately and discards anything not yet sent.
