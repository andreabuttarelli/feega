---
title: Telemetry
description: The anonymous usage counts Feega Inspect and npx feega send, exactly what they contain, and how to turn them off.
sidebar:
  order: 4
---

The Feega extension and `npx feega` send anonymous usage events. They tell us which features are
used, where people drop off, which agents and frameworks matter, and what breaks. Nothing is tied
to an account: signed-out use is counted the same way as signed-in use.

## What every event carries

| Field | Value |
|---|---|
| `install_id` | A random UUID created on first use. Not linked to an account. |
| `session_id` | A random UUID per opened panel (or per `npx feega` run). |
| `event` | One of the events listed below. |
| `ext_version` | Feega version. |
| `editor` | The host: `vscode`, `cursor`, `windsurf`, `vscodium`, `other` (another VS Code fork) or `npx`. |
| `os`, `arch` | Operating system family and CPU architecture. |
| `device` | `desktop`, `web` or `cli`. |
| `signed_in` | Whether an account is signed in. A boolean, never the account. |
| `framework`, `styling` | The detected framework and styling approach, as a fixed list of names. |

The server adds country, region and city from the request. It does not store the IP address.

## Events

| Event | When | Extra fields |
|---|---|---|
| `install` | First run on a machine. | |
| `opened` (the editor panel opened), `session_start`, `session_resume`, `session_end` | A session starts, resumes after 30 minutes away, ends. | `session_end`: `duration_ms`, `edit_count`, `diff_count`, `lines_added`, `lines_removed`, `files_count` |
| `project_detected` | A project is recognised. | `framework`, `styling` |
| `preview_ready` | The preview loaded. | |
| `element_selected` | An element was selected. | |
| `edit` | A change was written to your source. | `edit_kind`, `target`, `prop_category`, `file_ext`, `lines_added`, `lines_removed`, `files_count`, `breakpoint`, `state`, `source`, `agent`, `impact` |
| `first_edit` | The first change on this machine. | |
| `edit_reverted` | A change was undone or reverted. | `source`, `agent` |
| `breakpoint_switch`, `state_switch` | You switched breakpoint or state. | `breakpoint`, `state` |
| `library_insert` | A library item was inserted. | `library_item`, `tier` |
| `copy_for_agent` | You copied a change for an agent. | |
| `focus_opened` | Focus mode opened. | `variant` (`focus`) |
| `ai_chat_created` | A chat was created. | `chat_count`, `live_count` (numbers only, never text) |
| `ai_agent_chosen`, `ai_session_started`, `ai_session_ended` | An agent was chosen; an AI session started or ended. | `agent`; on end: `message_count`, `tool_count`, `duration_ms` |
| `ai_message_sent`, `ai_first_response` | A message was sent; the first reply arrived. | `agent`; first response: `duration_ms` |
| `ai_tool_call`, `ai_permission`, `ai_cancel`, `ai_session_error` | Agent activity. | `agent`; permission: `outcome` (`allow` or `reject`); error: `error_class` |
| `onboarding_started`, `onboarding_step`, `onboarding_finished`, `onboarding_skipped` | Onboarding progress. | `step` (`welcome`, `agent`, `agents`, `sign_in`, `support`), `outcome` (`viewed`, `completed`, `skipped`), `choice` (`mcp`, when the MCP setup command is copied) |
| `sign_in_prompted`, `sign_in`, `sign_out` | Account prompts and changes. | |
| `share_action`, `cloud_action` | Share and Feega Cloud use. | `action` |
| `mcp_tool_call` | An MCP tool was called. | `tool` (the tool name only) |
| `setup_applied`, `setup_failed`, `skill_hint_shown`, `skill_installed`, `plugin_installed` | Project setup and skills. | `error_class` on failure |
| `support_action` | A support link was used. | `item` |
| `error_host`, `error_webview` | An unhandled exception. | `error_class`, `area` |

## Field values

All values are fixed lists or short identifiers, never free text.

| Field | Values |
|---|---|
| `edit_kind` | `text`, `style`, `image`, `attribute`, `structure`, `template`, `other` |
| `target` | `tailwind_class`, `scoped_css`, `inline_style`, `text`, `markup`, `library_insert`, `detach` |
| `prop_category` | `spacing`, `typography`, `color`, `layout`, `size`, `border`, `effect`, `text_content` |
| `file_ext` | The extension only: `tsx`, `jsx`, `ts`, `js`, `vue`, `svelte`, `astro`, `html`, `css`, `scss`, `sass`, `less`, `md`, `mdx`, `other` |
| `breakpoint` | `base`, `sm`, `md`, `lg`, `xl`, `2xl`, `custom` |
| `state` | `default`, `hover`, `focus`, `active`, `disabled`, `dark`, `other` |
| `source` | `manual`, `ai`, `revert` |
| `impact` | `local`, `shared`, `global` |
| `styling` | `tailwind`, `css_modules`, `scss`, `styled_components`, `plain_css`, `inline`, `other` |
| `area` | `host`, `webview`, `ai`, `edit`, `preview`, `library`, `cloud`, `mcp`, `other` |
| `item` | `star`, `follow_x`, `discord`, `coffee`, `share` |
| `tier` | `free`, `pro` |
| `framework` | `sveltekit`, `nuxt`, `astro`, `react-router`, `next`, `gatsby`, `angular`, `cra`, `vite`, `generic` |
| `agent`, `library_item`, `tool`, `error_class`, `action` | A short identifier of letters, digits and `_ . : -`. A path or a sentence is rejected by the server. |
| `lines_added`, `lines_removed`, `files_count`, `diff_count`, `message_count`, `tool_count` | Numbers only. |

Events are batched, sent every few minutes and when the session ends. A failed send is dropped
silently and never slows the editor.

## What is never collected

Code, class names, property values, text, file names and paths (only the extension of a changed file), project names, URLs, prompts and agent replies, your account or email.

## Turn it off

- **Extension:** set `feegaInspect.telemetry` to off in Settings. It is also off whenever VS Code
  telemetry is off (`telemetry.telemetryLevel` set to `off`).
- **`npx feega`:** set `FEEGA_TELEMETRY=0` or `DO_NOT_TRACK=1` in the environment. The
  `feegaInspect.telemetry` entry in `.feega/settings.json` works too.

Turning it off takes effect immediately and discards anything not yet sent.
