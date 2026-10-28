---
title: Voices
description: Find a voice in the library, design one, clone your own, and manage your organization's voices.
sidebar:
  order: 8
---

Text to speech and the voice changer use a voice. The **Voice** menu of a Generate audio node lists the default ElevenLabs voices plus your organization's own voices. Other organizations' voices are never listed.

Custom voices (added from the library, designed or cloned) belong to your organization and use a voice slot.

| Plan | Custom voice slots |
|---|---|
| No plan, Go | 3 |
| Starter | 5 |
| Pro | 10 |

## Open the voice studio

In a Generate audio node set to Text to speech or Voice changer, press **More voices**. It shows the slots left. Four tabs:

### Library

1. Type a search and/or filter by language, gender, accent and use case.
2. Press the play button to hear a voice.
3. Press **Use**. The voice is added to your organization and selected in the node.

### Design

1. Describe the voice in at least 20 characters. Example: *A warm, calm woman in her forties with a light Italian accent.*
2. Press **Generate previews** and listen.
3. Type a name and press **Save** on the preview you like. Cost: $0.08 (about 10 credits).

### Clone

Instant clone from a recording of your own voice, or of a speaker who explicitly agreed. The tab is hidden in uncensored projects.

1. Name the voice.
2. Choose **This is my own voice** or **The speaker gave me explicit consent**; for the second, type the speaker's full name.
3. Record 60 to 180 seconds in the recorder (a script to read is provided). Background noise is removed.
4. Tick the confirmation that you have the right to clone this voice, then press **Create voice**. Cost: $0.10 (about 12 credits).

The recording is deleted once the voice exists.

### My voices

Lists your custom voices (cloned or designed). **Use** selects one, **Delete** removes it after a confirmation; nodes using it stop speaking with it.

When all slots are used, Design and Clone are disabled until you delete a voice.

## Agents and MCP

| Tool | What it does |
|---|---|
| `list_voices` | Your organization's custom voices (free) |
| `voice_library` | Search the library: `search`, `language`, `gender`, `accent`, `useCase`, `page` (free) |
| `use_library_voice` | Add a library voice: `ownerId`, `voiceId`, `name` |
| `design_voice` | Design previews from a `description` (spends credits) |
| `save_voice` | Keep a preview: `generatedVoiceId`, `name`, `description` |
| `clone_voice` | `name`, `consentBasis`, `speaker?`, `attested: true`, `seconds` 60 to 180, `sampleBase64` up to 3 MB (spends credits; only with the user's consent) |
| `delete_voice` | `id` |

Over REST, `GET /api/v1/org/audio/voices?org=<org>` answers `{ voices, custom }`.
