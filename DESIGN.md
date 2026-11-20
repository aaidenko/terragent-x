# TerragentX design language

The site is built in the language of the TerragentX pitch deck: monochrome, cool, editorial and very quiet, with one color reserved for the planet doing something. Every screen is checked against the rules below before it ships.

## What the deck does (observed across all 10 slides)

| Element | In the deck | In code |
|---|---|---|
| Palette | Ink charcoal, deep navy, slate, silver, mist. No hue. | `--ink #1c1e24` · `--ink-2 #23262e` · `--navy #1a2234` · `--slate #5b6574` · `--silver #aeb5bb` · `--mist #d2d7d9` · `--paper #f4f5f6` |
| Gradient | One family: long, soft ramps navy → slate → silver. Vertical on panels, horizontal on full-bleed bands. | `surface-fall` · `surface-rise` · `surface-dusk` · `surface-band` (all paired with `grain`) |
| Type | Neo-grotesk at regular weight, huge, tight tracking, leading under 0.9. Body is tiny and dim. | Inter with optical sizing (Display cut at large sizes), `text-display-xl/l/m/s`, `text-title`, `text-body`, `text-micro`; Geist Mono `text-mono` for data only |
| Strip | Three small labels along an edge: brand · tagline · frosted pill. | `<Strip>` + `<Brand>` + `<Pill>` |
| Glass | Translucent white with a 1px light border, 14px radius, heavy blur. One big label and one small line. | `.glass`, `.glass-pill`, `<Glass>` |
| Hairlines | 1px white rules separating stacked giant words; vertical splits. | `<Rule>`, `<DrawRule>`, `border-hair` |
| Glyphs | Thin ↘ ↗ ↙ arrows (often paired), ⌟ corner ticks, ✦ sparkles on line crossings, crop marks over imagery. | `components/deck/glyphs.tsx` |
| Indices | A tiny superscript `01` beside giant words. | `<IndexMark>` |
| Imagery | High-contrast black-and-white, full-bleed, hard-cropped, often half the canvas. | `<Satellite>` with NASA / USGS scenes graded by `scripts/grade-imagery.mjs` |
| Composition | Hard vertical splits (ink · gradient · image), full-bleed bands, left-aligned, huge negative space. Each slide is 16:9. | Sections use `min-h-[min(100svh,56.25vw)]`, split grids |

## Rules

1. **Two sizes per view.** One display size plus body or micro text. `text-title` is the only third size, reserved for card and list labels.
2. **Never bold.** Display is weight 400. Emphasis comes from size and opacity, never weight.
3. **Gray, plus one signal.** Flare `#ff5a2e` appears only on live or critical hazard state: the live dot, critical markers, failed sends, errors. Never on buttons, links or decoration. At most one flare cluster per viewport.
4. **One gradient family.** Only navy → slate → silver at roughly 180° or 90°. No radial gradients, glows, colored shadows or blur blobs. Grain sits on every gradient.
5. **Glass needs a backdrop.** Glass only over a gradient or an image, never over flat ink. Radius is 14px for glass, fully round for pills. No other radii.
6. **Lines, not boxes.** Structure comes from hairlines. Only glass and pills have borders.
7. **One glyph set.** Every glyph comes from `glyphs.tsx`, drawn with 1px strokes. No icon libraries, no emoji.
8. **Sparkles mark crossings.** A ✦ only appears where two lines meet: a crop frame corner, a split meeting a rule, the equator meeting the prime meridian.
9. **Indices count.** Ordinals are `01 02 03` in mono, always sequential.
10. **Every section has a strip.** It is the navigation chrome. There is no separate navbar.
11. **Imagery is B&W satellite.** Graded to sit on the ink: lifted blacks, no pure white, hard crops, never rounded.
12. **Copy is terse.** Headlines are one to four words. Supporting lines stay under about 18 words. No buzzwords, no internal notes, no raw enum values on screen.
13. **Motion eases, never bounces.** `cubic-bezier(0.2, 0.7, 0.1, 1)`, 700–1100ms for reveals, 200ms for hovers. The only loops are the live dot and the running-pass scan line. Reduced motion turns it all off.
14. **No template tells.** No neon, glow blobs, gradient text, uppercase tracked-out eyebrows, icon-topped three-up feature cards, generic stat tiles, logo walls or card drop shadows.

## Principles

1. **Every page is a slide.** Sections are full compositions with a strip, not stacked content blocks.
2. **Scale is the hierarchy.** A huge word next to a tiny explanation, with nothing in between.
3. **Quiet until it's live.** Gray is calm. Flare means something is happening on Earth right now.
4. **Show the real planet.** Real coordinates, sources and timestamps. No invented numbers. When a feed is quiet or a reading is a fallback, the UI says so.
5. **Instruments, not dashboards.** Mission control reads like a precision instrument: hairlines, mono readouts, crop marks, a severity meter instead of colored badges.
6. **Earn every element.** If removing it doesn't hurt the composition, remove it.

## Goals

- A visitor understands "Earth intelligence, run by agents" within five seconds, and the page looks like the deck.
- One click from the hero reaches a live mission control.
- In mission control, a judge can run a pass, watch the steps arrive, open a signal, read its verified brief (method, confidence, limitations, source) and approve a single draft without hunting.
- Any screen can sit beside the deck's thumbnails without looking out of place.
- First byte stays fast: live data streams in behind Suspense, and the landing feed read is cached for five minutes.
- Everything works on laptop and phone, by keyboard, and under reduced motion.

## Component inventory

| Path | What it is |
|---|---|
| `src/app/globals.css` | Tokens, type scale, surfaces, glass, grain, motion keyframes |
| `src/components/deck/primitives.tsx` | `Strip`, `Brand`, `Pill`, `LiveDot`, `Glass`, `Rule`, `VRule`, `IndexMark`, `Micro`, `Mono`, `Panel` |
| `src/components/deck/glyphs.tsx` | `Arrow`, `ArrowRight`, `ArrowPair`, `ArrowTick`, `CornerTick`, `Sparkle`, `SparkleAt`, `CropFrame` |
| `src/components/deck/motion.tsx` | `Display` (line-mask reveal), `Reveal`, `DrawRule`, `CountUp` |
| `src/components/deck/satellite.tsx` | Graded satellite scene with `next/image` |
| `src/components/map/*` | Dot-matrix Equal Earth map: land built on the server, markers on the client |
| `src/components/landing/*` | The ten landing sections, one per deck slide |
| `src/components/mission/*` | Mission control: state hook, readouts, loop log, feed health, signal rows, detail sheet, outreach cards |
| `src/components/format.ts` | Labels, times, coordinates, metric formatting, feed provenance |
| `src/components/ui/button.tsx` | Pill buttons: `solid`, `glass`, `line`, `quiet` |

## Typeface note

The deck is set in a Helvetica Now–style grotesk. The site uses Inter (SIL Open Font License) with its optical-size axis, which gives the Display cut at large sizes. Both families are wired through `--font-inter` and `--font-geist-mono` in `src/app/layout.tsx`, so a licensed face can replace Inter by changing one loader.
