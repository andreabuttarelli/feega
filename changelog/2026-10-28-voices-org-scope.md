# Voices stay inside the org

The ElevenLabs account is shared by every org. The picker already
listed only `premade` voices plus the org's `custom_voices` rows, but
three gaps remained:

- A voice added from the library was never recorded, so it belonged to
  nobody and any org could use it by id.
- `voiceRefusalFor` only refused voices recorded for another org; an
  unrecorded non-premade voice passed.
- `/v2/voices` was read with `page_size=100` and no filter, so premade
  voices could fall off the first page on a busy account.

Now library voices are recorded (`method = 'library'`, takes a slot),
use is refused unless the voice is premade or the org's own, and the
list asks ElevenLabs for `voice_type=default`.

Migration `20261028100000_custom_voices_library_method.sql` widens the
`method` check. Apply it before deploying.
