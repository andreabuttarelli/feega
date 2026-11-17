# Local ACP chat reuses the cloud composer

`AcpChatPanel` had its own textarea and a text `Send` button, so the local chat looked unrelated
to the cloud one. It now renders `ChatComposer` and `ChatMessage` from `brand-agent/`: one
component per concern, so the two chats cannot drift.

- `ChatComposer` gained an optional `placeholder` (default unchanged).
- The model picker slot is the composer's `controls` snippet; locally it holds an empty
  `data-testid="acp-model-slot"` span for the ACP model dropdown to replace. Credits and the
  cloud model menu are not rendered.
- `AcpChat.stop()` aborts the turn's request; an abort adds no error line. Enter-to-send,
  Shift+Enter, auto-grow and the stop button come from the composer.
- User and agent lines use `ChatMessage` (markdown, streaming caret, thinking bar while the
  first chunk is pending).

Not carried over: attachments and canvas selection chips. The ACP endpoint takes text only, so
showing them would be a control that does nothing.
