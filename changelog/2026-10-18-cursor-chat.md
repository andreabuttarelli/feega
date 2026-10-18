# Cursor chat

Press `/` on the canvas (outside any text field) and a pill opens next to
the pointer (`CursorChat.svelte`). What you type rides the presence tick
as `chat` (max `CHAT_MAX` = 120 chars, schema-checked); peers see it in
place of your name tag beside your cursor (`PeerLayer`). Escape, Enter or
leaving the field clears it. Nothing is stored. `/` had no shortcut on
the canvas; the handler ignores keys typed into inputs and editors.

e2e (`canvas-cursors.spec.ts`): typed text appears in the other tab and
disappears after Escape.
