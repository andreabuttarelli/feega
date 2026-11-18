---
title: Settings
description: Account, workspace and brand settings live in the dashboard; project settings live on the canvas.
sidebar:
  order: 5
---

Settings are split by what they belong to.

| Where | Open it from | Sections |
| --- | --- | --- |
| **Dashboard Settings** (`/app/settings`) | **Settings** in the account menu | Profile, Appearance, API keys, Models, Fonts, Billing limits, Content. **Team** opens the team page. |
| **Brands** (`/app/settings/brands`) | the **Brands** group of the dashboard Settings sidebar | The list of your workspace's brands and **Create brand**. Each brand has Brand (logo, kit, fonts), Products, Video and Delete. |
| **Project settings** (`/p/<project>/settings`) | the Settings rail of a canvas | Project (name, which brand it uses, **Edit this brand**) and the spend limits of that project. |

- A brand belongs to the workspace and can be used by several projects. A project links to one
  brand from its Project settings, or creates one there; every other brand setting is edited in
  the dashboard.
- **Billing limits** are split too: the cap per workspace member is set in the dashboard, the member
  and total caps of one project are set in that project.
- Old links such as `/p/<project>/settings/profile` redirect to the dashboard. Old brand links such
  as `/p/<project>/settings/video` open the same section of the project's brand, or the brand list
  when the project has none.
- Viewers can edit their own profile and appearance; everything else is read-only for them.
