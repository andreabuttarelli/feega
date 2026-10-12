# RGB split title template

New built-in `builtin:rgb-split-title`: a full-bleed picture arrives split into red,
green and blue channels with a horizontal streak blur, settles into focus, and a large
serif title enters word by word over it; it splits again to loop.

- CSS only: three tinted copies (multiply) composed with `screen` on black; the streak is
  one SVG `feGaussianBlur` with an anisotropic `stdDeviation`. No WebGL.
- Model is a pure function of t, wrapped on the loop length; a slow push keeps the sharp
  hold from freezing (render scripts treat identical frames as frozen).
- Discarded: isotropic CSS `blur()` (turned fur into rainbow noise), radial mask (read as
  an oval).
