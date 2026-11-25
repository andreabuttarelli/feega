# Changelog

## 0.3.0

The Feega desktop app: signed for macOS, with a first-run tour, new projects from templates, automatic updates with an in-app notice, and builds for Windows and Linux. Notifications when a chat agent finishes or asks for permission. Edits to nested CSS rules in plain stylesheets are written to the source. A ShaderGradient community plugin. Typography controls get full-width rows. Fixed `npx feega` attaching to its own editor port.

## 0.2.19

Focus mode edits every kind of prop, applies them to the page, reads real Svelte and Astro values, says why it shows a snapshot, and opens at 100% on a grey canvas with zoom and a light/dark switch. A Classes panel edits plain CSS classes globally. The AI tab installs agent connectors once, adds more agents with their logos, sends the page you are on, and lets the agent take screenshots. The toolbar docks to an edge; notices have a close button. Fixed a duplicate body row in Layers and page styles in projects without a global stylesheet.

## 0.2.18

Focus mode opens one component in its own tab and mounts the real component in React, Vue, Svelte, Next.js, Nuxt and Astro, with Layers listing only its subtree. An AI tab chats with local coding agents (ACP): model and effort pickers, chats saved and run in parallel. Agent edits made straight on disk are listed. Send feedback in the Feega menu Help. Pixel icons and a support karma badge. Fixed stale Astro CSS after a first style edit.

## 0.2.17

Local MCP tools let Claude Code, Cursor and Codex read the element you selected and your changes. An agents step in onboarding sets them up. Copy for agent in Layers copies an element for your agent. Fixed a race in the launcher copy.

## 0.2.16

A Library item you insert is selected right away, ready to edit. The breakpoint trigger is styled like the other dropdowns.

## 0.2.15

An impact label in Properties says before you edit whether an edit stays on the element, changes a shared component (and in how many files) or has an unknown impact, with a diff to Apply first for the unknown ones.

Detach one instance of a shared component from the bar or the right-click menus. Spacing, size and radius snap to your theme; typed values are written exactly. Tailwind edits write into `cn()`, `clsx()`, `cva()`, template literals, Vue `:class` and Svelte `class={...}`, with valid variants for arbitrary widths and Tailwind v4 breakpoints.

npx feega ships the Library and starts with a clean session. Optional Support Feega checklist at the end of onboarding. Usage telemetry adds funnel and account events and stays off in CI. Fixes: the outline hides when its element is gone, the type size row wraps in a narrow panel, empty arbitrary values are never written.

## 0.2.14

Insert Pro library templates for Feega Cloud users. Attribute options and colour variables in Properties. New glass button template.

## 0.2.12

Right-click a layer to add a child or wrap it with a container. Drag elements from the Add menu onto Layers or the preview. Copy for agent stays reachable in a narrow Properties panel.

## 0.2.11

Onboarding shows once per device, shared by VS Code, npx feega and the desktop app.

## 0.2.0

New Feega: design in your codebase. Click any element of your running app, edit it like in Figma, and the change is written to your code.

Replaces the previous Feega canvas extension.
