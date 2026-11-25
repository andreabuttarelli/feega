---
title: Start a new project
description: Create a project from the desktop app with a framework and a template.
sidebar:
  order: 6
---

The [desktop app](/getting-started/desktop/) can create a project for you. Open it and press **New project**, or the plus in the tab bar and then **New project**.

## Options

| Option | Choices |
|---|---|
| Framework | React (Vite), Next.js, SvelteKit, Vue (Vite), Astro, Nuxt |
| Template | Blank, Landing, Portfolio, Dashboard |
| Name | Becomes the folder and package name |
| Folder | Where the project folder is created. Defaults to Documents |

Templates are built from free [library](/getting-started/library/) sections. The folder must be new or empty.

## What happens

1. Feega writes the project files.
2. For React (Vite), Next.js, SvelteKit and Vue (Vite) it adds the Feega source-map plugin. Astro and Nuxt need no plugin, Feega starts their dev server.
3. `npm install` runs. Progress shows in the tab.
4. The project opens as a tab with its dev server and the editor.

Installing needs the network and Node.js. If Node.js is missing or too old, the app says so and links to nodejs.org.
