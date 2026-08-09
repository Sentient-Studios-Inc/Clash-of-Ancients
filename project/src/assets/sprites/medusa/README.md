# Medusa sprite frames

Drop PNG files here. Naming is flexible — case-insensitive, and underscores
or hyphens both work. The state name comes first, then the frame number.

Accepted examples (all equivalent):
```
idle-1.png   Idle_1.png   IDLE-1.png
strike-2.png  Strike_2.png STRIKE-2.png
hit-3.png     Hit_3.png
special-4.png Special_4.png
```

States: `idle`, `strike`, `hit`, `special`

The MedusaSprite component auto-discovers these via Vite's `import.meta.glob`.
Files that aren't present fall back to a labeled placeholder, so you can add
frames incrementally — no code edits needed.

When you're ready for the full 12-frame cycle, add `idle-5.png` through
`idle-12.png` (and so on) and bump the `count` argument in `MedusaSprite.tsx`.
