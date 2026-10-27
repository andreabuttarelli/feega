---
title: Uploaded fonts
description: Upload a font once per organization and use it in every frame, code frame and export.
sidebar:
  order: 13
---

A font uploaded to an organization is usable by every member, on every canvas: in frame text, in code frames and in exported videos and images.

| Where | How |
|---|---|
| App | **Settings → Fonts** lists, previews, uploads and deletes. The font picker of a text element shows them under **Uploaded**, each in its own face, with **Upload font…** at the bottom. |
| CLI | `feega fonts` lists; `feega fonts upload <file>` uploads; `feega fonts delete <family>` deletes a family; `--org <id>` if you belong to several |
| MCP | `org_fonts`: without arguments it lists; `upload` takes a local file path; `delete` takes a family name. The `query` tool also reads the `org_fonts` table |
| API | `GET` `POST` `DELETE` `/api/v1/org/fonts` |

- **Files.** TTF, OTF, WOFF or WOFF2, up to 10MB each. The type is read from the file's bytes, not its name: a file that is not a font is refused.
- **Families.** The family, weight and italic are read from the font's own name table. Several files with the same family (Regular, Bold, Italic) make one family with several styles.
- **Where it renders.** Frame text on the canvas, the frame editor, video and image export, and code frames, where every uploaded font is declared with `@font-face` before your code runs: use it with `font-family: "Family"` or a Tailwind arbitrary value.
- **Deleting.** Deleting a family removes it for everyone. Text using it falls back to a system font and the font picker warns that the file is gone; nothing breaks.
- **Local mode.** In a `.feega` file opened with `npm run local`, uploaded fonts are saved inside the file and come back when it is reopened.

Upload only fonts your licence allows.
