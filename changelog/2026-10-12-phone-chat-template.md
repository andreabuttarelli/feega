# Phone chat template

`builtin:phone-chat`: smartphone close-up with a group chat. Each `name | text`
line types (three dots), then the bubble grows to its measured size and the
text fades in; the list scrolls by the measured overflow; slow push-in; loop
clears the messages and pulls back.

- Device moved to `template/phone-device.ts` (shared with phone-split, pure move).
- Avatars: initials on tints by default, optional media list. No people samples
  exist, so the preview uses the animal/landscape samples.
- Bubbles keep a realistic radius: depicted phone content, like the device.
- Discarded: bubble tails, emoji avatars (font-dependent).
