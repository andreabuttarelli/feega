# Embed and share links play the whole sequence

The embed bundle (publish, share link, downloadable bundle) is built in
`bundleInput` (src/lib/server/motion/agent-embed.ts) from the saved head
only, so a combined video published its scene references and no scene
content. It now resolves each scene from that scene's own head, scoped
to the org, before bundling. The published embed is a snapshot: editing
a scene after publishing needs a republish, same as editing the parent.
