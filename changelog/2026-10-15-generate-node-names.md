# Generation nodes renamed; ADR 0011 for free canvas elements

Graphic elements are leaving frames (free on the canvas, drag in/out, groups). With a drawn "Text"
next to an AI "Text" node the two read the same, so the AI nodes become "Generate text / image /
video / audio / 3D model". Only labels change (`ADDABLE_LABEL`, onboarding coach, agent tool
descriptions, CLI tools reference, e2e selectors); type ids stay — renaming them would touch the
type check, every `nodes.data` reader and the MCP contract for no user gain.

ADR 0011 picks the storage for free elements: a new `element` node type holding one clip in the
frame clip schema. Discarded: a canvas-wide board doc (one `version` for every element, breaks
per-node LOD) and reusing the generation nodes.
