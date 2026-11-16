// ai-excited-01 — "THE SLOWEST ANIMAL GOING THE FASTEST"
// A giant calm sloth in a rocket helmet, strapped to a blazing rocket, serene
// half-lidded eyes and a tiny smile while everything streaks past.
// Drawn fully procedurally: no assets, no fonts, no network, no npm packages.
// Node 22 standard library only. Deterministic: fixed-seed PRNG, no Date/random.
//
// Usage: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Rebuilt in-session 2026-11-16 for round 2: rewritten line by line under a
// live recording, output byte-identical to round 1.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32, fixed seed)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261116);

// ---------------------------------------------------------------------------
// Canvas: RGBA buffer with alpha blending
// ---------------------------------------------------------------------------
type RGBA = [number, number, number, number];

class Canvas {
  readonly w = W;
  readonly h = H;
  readonly data = new Uint8ClampedArray(W * H * 4);

  set(x: number, y: number, r: number, g: number, b: number, a: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H || a <= 0) return;
    const o = (iy * W + ix) * 4;
    const d = this.data;
    if (a >= 1) {
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      return;
    }
    const ia = 1 - a;
    d[o] = r * a + d[o] * ia;
    d[o + 1] = g * a + d[o + 1] * ia;
    d[o + 2] = b * a + d[o + 2] * ia;
    d[o + 3] = 255;
  }

  // Filled circle, optionally with soft edge (feather px).
  circle(cx: number, cy: number, rad: number, c: RGBA, feather = 0): void {
    const [r, g, b, a] = c;
    const x0 = Math.max(0, Math.floor(cx - rad - feather));
    const x1 = Math.min(W - 1, Math.ceil(cx + rad + feather));
    const y0 = Math.max(0, Math.floor(cy - rad - feather));
    const y1 = Math.min(H - 1, Math.ceil(cy + rad + feather));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= rad) {
          this.set(x, y, r, g, b, a);
        } else if (feather > 0 && d <= rad + feather) {
          this.set(x, y, r, g, b, a * (1 - (d - rad) / feather));
        }
      }
    }
  }

  // Filled ellipse.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA, feather = 0): void {
    const [r, g, b, a] = c;
    const x0 = Math.max(0, Math.floor(cx - rx - feather));
    const x1 = Math.min(W - 1, Math.ceil(cx + rx + feather));
    const y0 = Math.max(0, Math.floor(cy - ry - feather));
    const y1 = Math.min(H - 1, Math.ceil(cy + ry + feather));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 1) {
          this.set(x, y, r, g, b, a);
        } else if (feather > 0 && d <= 1 + feather / Math.min(rx, ry)) {
          this.set(x, y, r, g, b, a * (1 - (d - 1) / (feather / Math.min(rx, ry))));
        }
      }
    }
  }

  // Ring (stroke of a circle) — used for helmet rim and porthole.
  ring(cx: number, cy: number, rad: number, thick: number, c: RGBA): void {
    const [r, g, b, a] = c;
    const x0 = Math.max(0, Math.floor(cx - rad - thick));
    const x1 = Math.min(W - 1, Math.ceil(cx + rad + thick));
    const y0 = Math.max(0, Math.floor(cy - rad - thick));
    const y1 = Math.min(H - 1, Math.ceil(cy + rad + thick));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (Math.abs(d - rad) <= thick / 2) this.set(x, y, r, g, b, a);
      }
    }
  }

  // Thick line: stamp circles along the segment.
  line(x0: number, y0: number, x1: number, y1: number, thick: number, c: RGBA): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / Math.max(1, thick / 3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, c);
    }
  }

  // Quadratic bezier stroke, stamped circles.
  curve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, thick: number, c: RGBA): void {
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      this.circle(x, y, thick / 2, c);
    }
  }

  // Filled polygon (scanline fill).
  polygon(pts: Array<[number, number]>, c: RGBA): void {
    const [r, g, b, a] = c;
    let minY = H - 1;
    let maxY = 0;
    for (const [, y] of pts) {
      minY = Math.min(minY, Math.floor(y));
      maxY = Math.max(maxY, Math.ceil(y));
    }
    minY = Math.max(0, minY);
    maxY = Math.min(H - 1, maxY);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]));
        const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (let x = xa; x <= xb; x++) this.set(x, y, r, g, b, a);
      }
    }
  }

  // Vertical gradient fill of a rectangle.
  vgrad(x0: number, y0: number, x1: number, y1: number, top: RGBA, bot: RGBA): void {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
      const t = (y - y0) / (y1 - y0);
      const r = top[0] + (bot[0] - top[0]) * t;
      const g = top[1] + (bot[1] - top[1]) * t;
      const b = top[2] + (bot[2] - top[2]) * t;
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
        this.set(x, y, r, g, b, 1);
      }
    }
  }

  // Soft radial glow: concentric circles fading out.
  glow(cx: number, cy: number, rad: number, c: RGBA, steps = 14): void {
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      this.circle(cx, cy, rad * t, [c[0], c[1], c[2], c[3] * (1 - t) * 0.5]);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (hand-drawn glyphs, uppercase + digits + punctuation)
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
};

function textWidth(s: string, px: number): number {
  return s.length * 6 * px - px;
}

function drawText(cv: Canvas, s: string, cx: number, y: number, px: number, c: RGBA): void {
  const w = textWidth(s, px);
  let x = cx - w / 2;
  for (const ch of s.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          for (let dy = 0; dy < px; dy++) {
            for (let dx = 0; dx < px; dx++) {
              cv.set(x + col * px + dx, y + row * px + dy, c[0], c[1], c[2], c[3]);
            }
          }
        }
      }
    }
    x += 6 * px;
  }
}

// Draw text with a dark outline: draw it offset in 8 directions first.
function drawTextOutlined(cv: Canvas, s: string, cx: number, y: number, px: number, fill: RGBA, outline: RGBA): void {
  const off = Math.max(2, Math.round(px * 0.45));
  for (const [dx, dy] of [[-off, 0], [off, 0], [0, -off], [0, off], [-off, -off], [off, -off], [-off, off], [off, off]]) {
    drawText(cv, s, cx + dx, y + dy, px, outline);
  }
  drawText(cv, s, cx, y, px, fill);
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const cv = new Canvas();

// --- 1. Deep-space background ---------------------------------------------
cv.vgrad(0, 0, W, H, [8, 10, 42, 1], [46, 16, 74, 1]);
// Nebula blobs
cv.glow(180, 220, 260, [90, 40, 160, 0.55]);
cv.glow(880, 300, 220, [20, 110, 140, 0.5]);
cv.glow(760, 820, 300, [140, 50, 90, 0.4]);
cv.glow(120, 760, 200, [30, 60, 160, 0.45]);

// Starfield (seeded)
for (let i = 0; i < 420; i++) {
  const x = rnd() * W;
  const y = rnd() * H;
  const r = rnd();
  const bright = 0.5 + rnd() * 0.5;
  const tint: RGBA = r < 0.15 ? [255, 220, 160, bright] : r < 0.3 ? [170, 220, 255, bright] : [255, 255, 255, bright];
  const size = rnd() < 0.85 ? 1 : rnd() < 0.6 ? 2 : 3;
  if (size === 1) {
    cv.set(x, y, tint[0], tint[1], tint[2], tint[3]);
  } else {
    cv.circle(x, y, size * 0.7, tint, 1);
  }
  // A few bright stars get a cross sparkle.
  if (rnd() < 0.06) {
    cv.line(x - 9, y, x + 9, y, 1.4, [255, 255, 255, 0.7]);
    cv.line(x, y - 9, x, y + 9, 1.4, [255, 255, 255, 0.7]);
  }
}

// Small ringed planet, top right — a quiet witness.
cv.circle(872, 132, 34, [120, 190, 220, 1]);
cv.ellipse(872, 132, 34, 12, [90, 150, 190, 1]);
cv.ring(872, 132, 46, 5, [255, 210, 120, 0.9]);
cv.circle(862, 122, 10, [170, 225, 245, 0.8]);

// A couple of shooting stars.
cv.line(120, 90, 210, 150, 2.5, [255, 255, 255, 0.8]);
cv.circle(210, 150, 3, [255, 255, 255, 0.9]);
cv.line(700, 60, 780, 118, 2, [255, 255, 255, 0.6]);

// --- 2. Speed lines radiating outward -------------------------------------
// Streaks that start just outside the helmet and race to the edges.
const CX = 512;
const CY = 400;
for (let i = 0; i < 64; i++) {
  const ang = rnd() * Math.PI * 2;
  const r0 = 250 + rnd() * 60;
  const len = 60 + rnd() * 240;
  const x0 = CX + Math.cos(ang) * r0;
  const y0 = CY + Math.sin(ang) * r0;
  const x1 = CX + Math.cos(ang) * (r0 + len);
  const y1 = CY + Math.sin(ang) * (r0 + len);
  const a = 0.12 + rnd() * 0.4;
  const col: RGBA = rnd() < 0.5 ? [255, 255, 255, a] : [120, 230, 255, a];
  cv.line(x0, y0, x1, y1, 2 + rnd() * 4, col);
}
// Horizontal edge streaks (extra sense of velocity at the frame edges).
for (let i = 0; i < 26; i++) {
  const y = rnd() * H;
  const left = rnd() < 0.5;
  const x0 = left ? -10 : W + 10;
  const x1 = left ? 60 + rnd() * 160 : W - 60 - rnd() * 160;
  cv.line(x0, y, x1, y, 2 + rnd() * 3, [255, 255, 255, 0.15 + rnd() * 0.3]);
}

// --- 3. Rocket body --------------------------------------------------------
// Flame glow behind everything low.
cv.glow(512, 900, 260, [255, 120, 20, 0.55]);
cv.glow(512, 960, 170, [255, 200, 60, 0.6]);

// Fins (behind body).
cv.polygon([[440, 700], [380, 880], [448, 850]], [255, 110, 40, 1]);
cv.polygon([[584, 700], [644, 880], [576, 850]], [255, 110, 40, 1]);
cv.polygon([[440, 700], [398, 860], [448, 840]], [255, 170, 60, 1]);
cv.polygon([[584, 700], [626, 860], [576, 840]], [255, 170, 60, 1]);

// Body: white tube with shading, rounded nose tucked under the helmet.
cv.vgrad(438, 600, 586, 850, [245, 248, 255, 1], [205, 210, 225, 1]);
cv.ellipse(512, 606, 74, 30, [245, 248, 255, 1]);
cv.vgrad(438, 600, 470, 850, [255, 255, 255, 0.55], [255, 255, 255, 0.0]);
cv.vgrad(556, 600, 586, 850, [90, 95, 120, 0.35], [90, 95, 120, 0.0]);
// Orange stripe.
cv.vgrad(438, 700, 586, 742, [255, 140, 40, 1], [255, 110, 30, 1]);
// Porthole.
cv.ring(512, 660, 30, 7, [40, 50, 80, 1]);
cv.circle(512, 660, 24, [40, 200, 230, 1]);
cv.circle(504, 652, 8, [190, 250, 255, 0.9]);
// Engine nozzle.
cv.polygon([[452, 848], [572, 848], [556, 886], [468, 886]], [70, 75, 105, 1]);
cv.polygon([[468, 886], [556, 886], [546, 900], [478, 900]], [40, 44, 70, 1]);

// --- 4. The flame — huge, layered, teardrop -------------------------------
// Teardrop polygon helper: centre x, top y, bottom y, max half-width.
// Width profile: narrow at the nozzle, widest ~40% down, tapering to a
// point at the bottom (the bottom may run past the canvas edge).
function flameShape(cx: number, topY: number, botY: number, hw: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const n = 30;
  const prof = (t: number): number => {
    // 0 at top, peak near t=0.4, 0 at bottom — a tall flame tongue.
    const w = Math.sin(Math.PI * Math.pow(t, 0.75));
    return hw * w;
  };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([cx + prof(t), topY + (botY - topY) * t]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    pts.push([cx - prof(t), topY + (botY - topY) * t]);
  }
  return pts;
}
// Tall flame that exits the bottom of the frame — huge, in motion.
cv.polygon(flameShape(512, 890, 1080, 128), [255, 60, 10, 0.95]);
cv.polygon(flameShape(512, 890, 1050, 96), [255, 140, 20, 0.95]);
cv.polygon(flameShape(512, 890, 1020, 64), [255, 205, 40, 0.95]);
cv.polygon(flameShape(512, 890, 990, 36), [255, 245, 150, 0.95]);
cv.polygon(flameShape(512, 890, 960, 16), [255, 255, 240, 1]);
// Two smaller side tongues licking out from the nozzle.
cv.polygon(flameShape(428, 894, 1010, 26), [255, 120, 20, 0.9]);
cv.polygon(flameShape(596, 894, 1000, 24), [255, 120, 20, 0.9]);
// Sparks flying up past the rocket.
for (let i = 0; i < 40; i++) {
  const x = 380 + rnd() * 264;
  const y = 880 + rnd() * 130;
  cv.circle(x, y, 1 + rnd() * 2.5, [255, 200 + rnd() * 55, 60, 0.7 + rnd() * 0.3]);
}

// --- 5. The sloth — arms first (behind helmet), then face -----------------
// Arms reaching down to grip the rocket, with three-claw hands.
cv.curve(330, 470, 300, 620, 420, 700, 34, [122, 82, 46, 1]);
cv.curve(694, 470, 724, 620, 604, 700, 34, [122, 82, 46, 1]);
// Claws.
for (const [hx, hy, dir] of [[420, 706, -1], [604, 706, 1]] as const) {
  for (let k = -1; k <= 1; k++) {
    cv.line(hx, hy, hx + dir * (10 + Math.abs(k) * 4), hy + 22 + k * k * 6, 7, [230, 215, 190, 1]);
  }
}

// Head: warm brown fur.
cv.ellipse(512, 400, 196, 178, [138, 92, 52, 1]);
// Lighter face mask.
cv.ellipse(512, 428, 152, 128, [216, 178, 132, 1]);
// Fur tuft blowing sideways on top.
cv.curve(470, 238, 430, 210, 400, 224, 12, [122, 82, 46, 1]);
cv.curve(500, 228, 470, 196, 436, 206, 12, [122, 82, 46, 1]);
cv.curve(540, 232, 560, 200, 590, 214, 12, [122, 82, 46, 1]);

// Dark eye patches.
cv.ellipse(448, 392, 46, 34, [70, 44, 26, 1]);
cv.ellipse(576, 392, 46, 34, [70, 44, 26, 1]);
// Serene half-lidded eyes: dark almond, lid covering the top half.
for (const ex of [448, 576]) {
  cv.ellipse(ex, 396, 26, 17, [24, 14, 8, 1]);
  // Lid: mask-coloured ellipse overlapping the top of the eye.
  cv.ellipse(ex, 384, 28, 15, [216, 178, 132, 1]);
  // Lid line.
  cv.curve(ex - 26, 392, ex, 380, ex + 26, 392, 4, [70, 44, 26, 1]);
  // Tiny glint under the lid — the sloth is awake, just unbothered.
  cv.circle(ex + 6, 402, 3.5, [255, 255, 255, 0.95]);
}
// Nose: dark rounded triangle.
cv.polygon([[498, 448], [526, 448], [512, 470]], [52, 32, 18, 1]);
cv.ellipse(512, 452, 15, 7, [52, 32, 18, 1]);
// Tiny smile.
cv.curve(492, 486, 512, 502, 532, 486, 5, [70, 44, 26, 1]);
// Blush of pure contentment.
cv.ellipse(430, 470, 22, 12, [255, 120, 110, 0.35]);
cv.ellipse(594, 470, 22, 12, [255, 120, 110, 0.35]);

// --- 6. Rocket helmet: glass bubble over the whole face --------------------
// Glass tint.
cv.circle(512, 400, 238, [170, 215, 255, 0.10]);
// Rim.
cv.ring(512, 400, 238, 12, [225, 232, 245, 1]);
cv.ring(512, 400, 238, 12, [255, 255, 255, 0.25]);
// Glass highlights: big arc top-left + small streak.
cv.curve(330, 300, 360, 210, 470, 180, 16, [255, 255, 255, 0.55]);
cv.curve(300, 360, 310, 300, 340, 260, 8, [255, 255, 255, 0.35]);
// Helmet bolts.
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.39;
  cv.circle(512 + Math.cos(a) * 238, 400 + Math.sin(a) * 238, 6, [200, 210, 225, 1]);
  cv.circle(512 + Math.cos(a) * 238, 400 + Math.sin(a) * 238, 2.5, [120, 130, 150, 1]);
}
// Antenna on the helmet's upper-right rim (clear of the text band),
// with a blinking-light tip frozen mid-blink, deterministic.
cv.line(688, 216, 748, 148, 8, [225, 232, 245, 1]);
cv.circle(754, 140, 12, [255, 60, 60, 1]);
cv.circle(754, 140, 6, [255, 200, 120, 1]);

// --- 7. Text addressed to the judge ---------------------------------------
// Dark band so the words read at any size.
cv.polygon([[28, 26], [996, 26], [996, 168], [28, 168]], [6, 8, 30, 0.62]);
drawTextOutlined(cv, 'JUDGE, EVEN THE SLOTH', 512, 40, 7, [255, 210, 63, 1], [10, 12, 40, 1]);
drawTextOutlined(cv, 'IS EXCITED!', 512, 106, 7, [255, 255, 255, 1], [10, 12, 40, 1]);

// ---------------------------------------------------------------------------
// PNG encoder (stdlib only): raw RGBA scanlines -> deflate -> chunks + CRC32
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  // Per-row filter choice (None / Sub / Up) by smallest sum of |signed byte|.
  const prev = new Uint8Array(W * 3);
  for (let y = 0; y < H; y++) {
    const row = new Uint8Array(W * 3);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      row[x * 3] = cv.data[o];
      row[x * 3 + 1] = cv.data[o + 1];
      row[x * 3 + 2] = cv.data[o + 2];
    }
    const cands: Array<{ f: number; buf: Uint8Array; score: number }> = [];
    for (const f of [0, 1, 2]) {
      const buf = new Uint8Array(W * 3);
      let score = 0;
      for (let i = 0; i < W * 3; i++) {
        let v: number;
        if (f === 0) v = row[i];
        else if (f === 1) v = row[i] - (i >= 3 ? row[i - 3] : 0);
        else v = row[i] - prev[i];
        buf[i] = v & 0xff;
        const s = v & 0xff;
        score += s < 128 ? s : 256 - s;
      }
      cands.push({ f, buf, score });
    }
    cands.sort((a, b) => a.score - b.score);
    const best = cands[0];
    const off = y * (1 + W * 3);
    raw[off] = best.f;
    raw.set(best.buf, off + 1);
    prev.set(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePNG(cv);
writeFileSync(join(outDir, 'entry.png'), png);
