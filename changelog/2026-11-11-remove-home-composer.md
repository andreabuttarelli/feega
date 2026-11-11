# Home prompt box removed

The product no longer centres on in-app AI: external agents drive the canvas through MCP and the CLI.
The `/app` home therefore drops the brief composer: textarea, suggestion chips, attachments, progress.

Removed: the `video` page action (created a canvas and handed the brief to the canvas chat), its
`attachProjectId` and `templates` load fields, `src/lib/motion/video-brief.ts`, `brief-composer.ts`,
`brief-progress.ts` and their tests. The home `import` button went too: it only fed the composer's
attachments. `import .feega`, new canvas and recents stay.

Kept: `handoffPath`, `ChatUploads` and `loadAttachments` (canvas chat uses them), `composerHeight`.
No CLI command or MCP tool existed for the home composer. The onboarding tour's "Make a video" link
now opens `/app`.
