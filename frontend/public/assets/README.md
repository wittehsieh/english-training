# Art assets

All artwork is produced **outside this repo** by an AI image-generation
workflow and dropped in here. The app runs fine with these folders empty —
missing files fall back to generated CSS placeholders (never broken images).

## Rules

- **Backgrounds and characters are always separate files.** Never a single
  flattened image containing both.
- Characters: transparent **PNG** or **WebP**, full-body or bust, roughly
  portrait aspect. Any resolution — the UI scales with `object-fit: contain`.
- Backgrounds: **WebP** (or PNG), landscape, generous framing so mobile
  `object-fit: cover` cropping still looks right. Keep the important content
  near the focal point declared in `src/data/assets.json`.

## Folder layout

```
backgrounds/
  office/     morning.webp  afternoon.webp  evening.webp
  meeting-room/  normal.webp
  kitchen/      normal.webp
  coffee-area/  normal.webp
  lobby/       normal.webp
characters/
  <id>/        neutral.webp  happy.webp  surprised.webp
               concerned.webp  thinking.webp  talking.webp
ui/
  icons/  effects/
```

## Adding assets

The only file that maps an **id** to a **path** is
[`src/data/assets.json`](../../src/data/assets.json). Lesson JSON and React
components reference ids only. See the project README for step-by-step
instructions on adding a background, a character, or an expression.
