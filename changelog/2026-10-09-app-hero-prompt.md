# /app hero: a centred prompt composer with attachments

**Before:** "make a video." with a one-line input and a "Make it" button near the top; the
template chips submitted straight away; no attachments.

**Now:** the hero fills the first viewport (`100svh` minus the shell's top chrome, per
breakpoint) and centres title, composer, three rotating example chips and a helper line. The
composer is a chat-style textarea: auto-grow (`composerHeight`), Enter submits, Shift+Enter
newline (`composerKey` in `src/lib/motion/brief-composer.ts`), circular send button. Chips fill
the box instead of submitting.

**Attachments**, reusing #324 end to end: `ChatUploads` signs and uploads into the project
`toolScope` resolves (exposed as `attachProjectId` by the load; the form posts it back so the
video lands in the same project). The `video` action re-loads the ids with `loadAttachments`
(drops anything not in that project) and appends `attach=<ids>` to the editor URL. The editor
load resolves them; `briefPrefill` hands text + attachments to `ChatPanel`, whose queued send
now carries attachments, so the first turn persists them on `chat_messages.attachments` and the
model gets text/image parts. Files alone are a valid brief.

Discarded: a staging path re-registered on node creation — the project already exists before
upload, so it added a step for nothing. Autofocus only with a fine pointer, so a phone doesn't
open the keyboard over the hero on load.

Verified live: PDF + PNG attached on /app, editor opened, first message carried both, agent
answered using the logo and the PDF.
