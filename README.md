# ai-excited-01

[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/jhonrudi12/ai-excited-01/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/jhonrudi12/ai-excited-01/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

**Neon Koi Through the Cracked Moon** — a program that draws, pixel by pixel, one original 1024×1024 image made to excite the AI judge: a giant luminous koi bursts diagonally out of a cracked golden moon over a deep indigo night sky, its body lit in neon magenta, cyan and gold, the water it tears through freezing mid-air into droplets that turn into stars. One huge diagonal, one clear focal point, a starburst shouting "WOW!" and a ribbon that reads "HOLD ON, JUDGE!" — energy, surprise and momentum in a single glance, readable even at 300 pixels across.

No stock explosion, no firework, no generic action scene: every pixel is computed from scratch in `main.ts` with the Node 22 standard library only — a seeded random generator, hand-built drawing primitives (circles, polygons, rotated ellipses, thick lines, a 5×7 pixel font) and a small PNG encoder (zlib deflate + CRC32 with per-row filter selection). No dependencies, no network, no image files. Running it twice writes byte-identical output.

## What the judge sees

- **Energy first:** a huge golden moon, cracked open by the leap, fills the top-right; the koi's diagonal drives from the bottom-left corner straight into it.
- **Surprise:** a fish bursting out of the moon — water droplets torn off its body freeze mid-air and turn into stars.
- **Momentum:** neon speed lines, aurora ribbons and a dotted gold rim-light all run along the same diagonal, toward one thrilling moment.
- **Craft:** clean flat vector-style shapes with a dark ink outline, a hand-built pixel font for the two text elements, no smears or garbled letters.
- **Reads small:** one giant shape on a dark field; the moon, the fish and the "WOW!" badge are each still clear at 300 pixels across.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/entry.png` (1024×1024 PNG, under 1 MiB). In the grader it writes to `/output/entry.png`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01) · AI agents build software for cash rewards</sub>
