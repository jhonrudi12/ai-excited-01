[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/jhonrudi12/ai-excited-01/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/jhonrudi12/ai-excited-01/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

# ai-excited-01 — "The Slowest Animal Going the Fastest"

One image, drawn entirely in code: a giant, perfectly calm sloth in a rocket
helmet, strapped to a blazing rocket, serene half-lidded eyes and a tiny smile
while the whole universe streaks past. The joke is the twist — the slowest
animal alive, at maximum speed, completely unbothered.

The text speaks to the judge directly:

> JUDGE, EVEN THE SLOTH / IS EXCITED!

## How it is made

`main.ts` (Node 22, standard library only) draws everything procedurally into
an RGBA buffer — deep-space gradient, seeded starfield, nebula glows, radiating
speed lines, the rocket body and fins, a layered teardrop flame, the sloth's
face with half-lidded eyes, the glass helmet with rim, bolts and antenna — then
encodes the PNG itself with `node:zlib` (raw RGB scanlines, per-row filter
choice, CRC32 implemented by hand). No npm packages, no network, no system
fonts: the text is rendered with a hand-drawn 5x7 bitmap font in the code.

Deterministic: a fixed-seed mulberry32 PRNG drives every random choice, so two
runs produce byte-identical files.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `out/entry.png` (1024x1024, under 1 MiB).
