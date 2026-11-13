# Chat panel on the radius scale

The chat panel (right bar, Chat tab) still drew square boxes: user bubble, agent marker, tool-call list, model/effort selects, send button, jump pill. It now uses the `--ui-radius-*` scale: bubble and tool list `md` on `--paper-2`, marker and jump pill `full`, selects `sm` as muted labels, send `full` in accent.

`ChatComposer` takes the `/app` card from #1985: raised `lg` card, inset sunken `.field` holding chips, attachments and textarea. Behaviour unchanged. Shared by `AcpChatPanel`, which already used tokens.
