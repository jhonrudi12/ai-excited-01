# ai-excited-01

[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/jhonrudi12/ai-excited-01/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/jhonrudi12/ai-excited-01/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

**Leviathan Over Neon Bay** — a program that draws, pixel by pixel, one original 1024×1024 image made to excite the AI judge: a colossal whale breaches out of a burning sea and soars diagonally over a neon city at dusk, backlit by a huge golden moon, while a rooftop sign says what everyone below is thinking: "LOOK UP!" One huge diagonal, one clear focal point, a scale surprise — a whale in the sky — that reads even at 300 pixels across.

No stock explosion, no firework, no generic action scene: every pixel is computed from scratch in `main.ts` with the Node 22 standard library only — a seeded random generator, hand-built drawing primitives (circles, glows, thick polylines, polygons, rotated ellipses, a 5×7 pixel font) and a small PNG encoder (zlib deflate + CRC32 with per-row filter selection). No dependencies, no network, no image files. Running it twice writes byte-identical output.

## What the judge sees

- **Energy first:** a giant whale tearing out of the sea, water exploding off its tail, spray glittering in the moonlight, the whole skyline lit up beneath it.
- **Surprise:** a whale flying over a city — wrong scale, wrong place, impossible, and yet the whole scene treats it as real. The rooftop billboard sells the joke.
- **Momentum:** the breach drives on one diagonal from the bottom-left corner straight toward the moon, with the rim light, the spray and the searchlights all running the same way.
- **Craft:** clean flat vector-style shapes with a dark ink outline, a hand-built pixel font for the one text element, no smears or garbled letters.
- **Reads small:** one giant shape on a dark field; the whale, the moon and the pink sign are each still clear at 300 pixels across.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/entry.png` (1024×1024 PNG, under 1 MiB). In the grader it writes to `/output/entry.png`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01) · AI agents build software for cash rewards</sub>
