// Leviathan Over Neon Bay — make.fun ai-excited-01 (round 4)
// A program that draws, pixel by pixel, one original 1024x1024 image made to
// excite the AI judge: a colossal whale breaches diagonally out of a burning
// sea and soars over a neon city at dusk, backlit by a huge golden moon,
// while the whole skyline looks up. One huge diagonal, one clear focal
// point, a scale surprise no one expects — a whale in the sky.
//
// Every pixel is computed from scratch with the Node 22 standard library only:
// a seeded generator, hand-built drawing primitives (circles, glows, thick
// polylines, polygons, rotated ellipses, a 5x7 pixel font) and a small PNG
// encoder (zlib deflate + CRC32 with per-row filter selection). No
// dependencies, no network, no image files. Running it twice writes
// byte-identical output.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Deterministic random numbers (fixed seed; never Date.now / Math.random).
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
const rand = mulberry32(20261116);

// ---------------------------------------------------------------------------
// Pixel buffer (RGBA, alpha always 255) and drawing primitives.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

const px = new Uint8Array(W * H * 4);
for (let i = 3; i < px.length; i += 4) px[i] = 255;

function blend(x: number, y: number, c: RGB, a: number): void {
  const ix = x | 0;
  const iy = y | 0;
  if (ix < 0 || iy < 0 || ix >= W || iy >= H || a <= 0) return;
  if (a > 1) a = 1;
  const o = (iy * W + ix) * 4;
  const inv = 1 - a;
  px[o] = Math.round(c[0] * a + px[o] * inv);
  px[o + 1] = Math.round(c[1] * a + px[o + 1] * inv);
  px[o + 2] = Math.round(c[2] * a + px[o + 2] * inv);
}

function fillCircle(cx: number, cy: number, r: number, c: RGB, a: number): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) blend(x, y, c, a);
    }
  }
}

// Soft radial glow: alpha falls off quadratically to the rim.
function glow(cx: number, cy: number, r: number, c: RGB, peak: number): void {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / r;
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / r;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) {
        const f = 1 - d;
        blend(x, y, c, peak * f * f);
      }
    }
  }
}

function thickLine(
  x1: number, y1: number, x2: number, y2: number,
  w: number, c: RGB, a: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(len / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x1 + dx * t, y1 + dy * t, w / 2, c, a);
  }
}

function thickPolyline(pts: Array<[number, number]>, w: number, c: RGB, a: number): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c, a);
  }
}

function fillPolygon(pts: Array<[number, number]>, c: RGB, a: number): void {
  let minY = H;
  let maxY = 0;
  let minX = W;
  let maxX = 0;
  for (const [x, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(H - 1, Math.ceil(maxY));
  minX = Math.max(0, Math.floor(minX));
  maxX = Math.min(W - 1, Math.ceil(maxX));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.max(minX, Math.ceil(xs[i]));
      const xb = Math.min(maxX, Math.floor(xs[i + 1]));
      for (let x = xa; x <= xb; x++) blend(x, y, c, a);
    }
  }
}

function fillEllipse(
  cx: number, cy: number, rx: number, ry: number, rot: number,
  c: RGB, a: number,
): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const r = Math.max(rx, ry);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = (dx * cos + dy * sin) / rx;
      const v = (-dx * sin + dy * cos) / ry;
      if (u * u + v * v <= 1) blend(x, y, c, a);
    }
  }
}

function rect(x: number, y: number, w: number, h: number, c: RGB, a: number): void {
  const x0 = Math.max(0, Math.floor(x));
  const x1 = Math.min(W - 1, Math.ceil(x + w));
  const y0 = Math.max(0, Math.floor(y));
  const y1 = Math.min(H - 1, Math.ceil(y + h));
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) blend(xx, yy, c, a);
  }
}

// ---------------------------------------------------------------------------
// Tiny 5x7 pixel font (only the glyphs the billboard needs).
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function drawText(s: string, x: number, y: number, scale: number, c: RGB, a: number): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) {
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 5; col++) {
          if (g[r][col] === "1") {
            rect(cx + col * scale, y + r * scale, scale, scale, c, a);
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

// ---------------------------------------------------------------------------
// Scene.
// ---------------------------------------------------------------------------
const INK: RGB = [13, 13, 42];
const DEEP_SKY_TOP: RGB = [10, 14, 52];
const DEEP_SKY_MID: RGB = [42, 22, 80];
const DUSK: RGB = [122, 42, 94];
const HORIZON: RGB = [255, 122, 60];

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function paintSky(): void {
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let c: RGB;
    if (t < 0.45) c = lerpColor(DEEP_SKY_TOP, DEEP_SKY_MID, t / 0.45);
    else if (t < 0.78) c = lerpColor(DEEP_SKY_MID, DUSK, (t - 0.45) / 0.33);
    else c = lerpColor(DUSK, HORIZON, (t - 0.78) / 0.22);
    for (let x = 0; x < W; x++) blend(x, y, c, 1);
  }
  // Warm horizon band.
  glow(512, 1010, 620, [255, 110, 50], 0.5);
}

function paintStars(): void {
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = rand() * 560;
    const r = rand();
    const b = 0.35 + rand() * 0.6;
    const warm: RGB = r < 0.7 ? [255, 255, 255] : [255, 214, 150];
    if (r < 0.06) {
      // A few bright four-point stars.
      fillCircle(x, y, 2.2, warm, b);
      thickLine(x - 7, y, x + 7, y, 1.4, warm, b * 0.7);
      thickLine(x, y - 7, x, y + 7, 1.4, warm, b * 0.7);
    } else {
      fillCircle(x, y, r < 0.5 ? 1 : 1.6, warm, b);
    }
  }
}

function paintMoon(): void {
  // Halo, then the disc, then craters.
  glow(822, 178, 260, [255, 196, 110], 0.55);
  glow(822, 178, 150, [255, 220, 140], 0.7);
  fillCircle(822, 178, 96, [255, 214, 130], 1);
  fillCircle(822, 178, 88, [255, 228, 160], 1);
  fillCircle(790, 150, 14, [232, 186, 110], 0.8);
  fillCircle(848, 200, 18, [232, 186, 110], 0.8);
  fillCircle(830, 140, 9, [232, 186, 110], 0.8);
  fillCircle(800, 205, 7, [240, 196, 120], 0.8);
}

function paintAurora(): void {
  // Two faint teal-violet ribbons drifting across the upper sky.
  const pts1: Array<[number, number]> = [];
  const pts2: Array<[number, number]> = [];
  for (let x = 0; x <= W; x += 16) {
    pts1.push([x, 300 + Math.sin(x / 190) * 42 + Math.sin(x / 61) * 10]);
    pts2.push([x, 380 + Math.sin(x / 150 + 2) * 36]);
  }
  thickPolyline(pts1, 26, [64, 224, 208], 0.10);
  thickPolyline(pts1, 12, [120, 240, 220], 0.10);
  thickPolyline(pts2, 20, [150, 110, 220], 0.09);
}

function paintClouds(): void {
  const clouds: Array<[number, number, number]> = [
    [180, 250, 95], [300, 285, 70], [120, 320, 60],
    [880, 420, 85], [760, 460, 60], [620, 120, 70], [420, 150, 55],
  ];
  for (const [cx, cy, r] of clouds) {
    glow(cx, cy, r, [70, 50, 110], 0.25);
    fillEllipse(cx, cy, r, r * 0.34, 0, [58, 42, 96], 0.6);
    fillEllipse(cx - r * 0.4, cy - 8, r * 0.55, r * 0.26, 0, [74, 54, 118], 0.6);
  }
}

// Skyline; returns the rooftop list so the billboard and beams can sit on it.
function paintCity(): Array<{ x: number; w: number; top: number }> {
  const roofs: Array<{ x: number; w: number; top: number }> = [];
  let x = -10;
  while (x < W) {
    const w = 46 + rand() * 64;
    const h = 70 + rand() * 150;
    const top = H - h;
    rect(x, top, w, h + 4, [8, 8, 22], 1);
    roofs.push({ x, w, top });
    // Lit windows: warm, cyan and pink, seeded.
    const cols = Math.floor(w / 13);
    const rows = Math.floor(h / 17);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.42) {
          const pick = rand();
          const wc: RGB =
            pick < 0.6 ? [255, 196, 90] : pick < 0.85 ? [90, 220, 255] : [255, 110, 180];
          rect(x + 5 + c * 13, top + 8 + r * 17, 7, 9, wc, 0.9);
        }
      }
    }
    // Antenna on some roofs.
    if (rand() < 0.4) {
      const ax = x + w / 2;
      thickLine(ax, top, ax, top - 26, 3, INK, 1);
      fillCircle(ax, top - 28, 3, [255, 60, 70], 1);
      glow(ax, top - 28, 10, [255, 60, 70], 0.8);
    }
    x += w + 4 + rand() * 10;
  }
  return roofs;
}

function paintBeams(roofs: Array<{ x: number; w: number; top: number }>): void {
  // Two searchlights fanning up from rooftops.
  const picks = [roofs[2], roofs[Math.floor(roofs.length / 2)], roofs[roofs.length - 3]];
  for (const roof of picks) {
    if (!roof) continue;
    const bx = roof.x + roof.w / 2;
    const by = roof.top;
    const spread = 60 + rand() * 40;
    fillPolygon(
      [[bx, by], [bx - spread, 60], [bx + spread * 0.4, 60]],
      [255, 250, 220], 0.07,
    );
    fillPolygon(
      [[bx, by], [bx - spread * 0.4, 60], [bx + spread, 60]],
      [255, 250, 220], 0.05,
    );
  }
}

function paintSea(): void {
  // Burning sea at the bottom: dark teal body, orange-lit wave crests.
  for (let y = 900; y < H; y++) {
    const t = (y - 900) / (H - 900);
    const c = lerpColor([16, 40, 74], [8, 16, 38], t);
    for (let x = 0; x < W; x++) blend(x, y, c, 1);
  }
  for (let band = 0; band < 4; band++) {
    const baseY = 918 + band * 26;
    const pts: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 12) {
      pts.push([x, baseY + Math.sin(x / 90 + band * 1.7) * 7]);
    }
    const crest: RGB = band < 2 ? [255, 170, 80] : [70, 200, 220];
    thickPolyline(pts, band < 2 ? 5 : 4, crest, band < 2 ? 0.85 : 0.6);
    // Foam flecks on the crests.
    for (let i = 0; i < 40; i++) {
      const fx = rand() * W;
      const fy = baseY + Math.sin(fx / 90 + band * 1.7) * 7 + (rand() - 0.5) * 6;
      fillCircle(fx, fy, 1 + rand() * 2, [255, 240, 220], 0.7);
    }
  }
}

function paintSplash(): void {
  // The plume where the tail tears out of the water.
  const cx = 178;
  const cy = 872;
  glow(cx, cy, 150, [140, 230, 255], 0.5);
  for (let i = 0; i < 130; i++) {
    const ang = Math.PI * (0.15 + rand() * 0.7);
    const sp = 40 + rand() * 150;
    const dx = Math.cos(ang) * sp * (rand() < 0.5 ? -1 : 1) * 0.9;
    const dy = -Math.abs(Math.sin(ang)) * sp * 1.15;
    const r = 1.5 + rand() * 4.5;
    const c: RGB = rand() < 0.55 ? [255, 255, 255] : [150, 225, 255];
    fillCircle(cx + dx, cy + dy, r, c, 0.9);
    glow(cx + dx, cy + dy, r * 3, c, 0.35);
  }
  // Sheets of water curling off the tail.
  thickPolyline(
    [[132, 892], [156, 836], [184, 792], [208, 758]],
    7, [220, 245, 255], 0.7,
  );
  thickPolyline(
    [[238, 900], [220, 852], [206, 812]],
    5, [180, 230, 255], 0.55,
  );
}

function paintWhale(): void {
  // Spine of the breach: tail low-left, head high-right.
  const spine: Array<[number, number]> = [
    [168, 806], [260, 716], [360, 624], [470, 536],
    [570, 452], [650, 386], [716, 332],
  ];
  const widths = [46, 96, 138, 158, 148, 122, 92];

  // Ink outline: a wider dark stroke under everything.
  for (let i = 0; i + 1 < spine.length; i++) {
    const w = widths[i] + 14;
    thickLine(spine[i][0], spine[i][1], spine[i + 1][0], spine[i + 1][1], w, INK, 1);
  }
  // Body: deep violet-blue on top, fading to indigo below.
  for (let i = 0; i + 1 < spine.length; i++) {
    const w = widths[i];
    const c: RGB = i < 3 ? [44, 52, 130] : [52, 60, 148];
    thickLine(spine[i][0], spine[i][1], spine[i + 1][0], spine[i + 1][1], w, c, 1);
  }
  // Belly: a lighter stroke offset down along the spine.
  const belly: Array<[number, number]> = spine.map(([x, y], i) => {
    const off = 30 + i * 2;
    return [x - 6, y + off];
  });
  for (let i = 0; i + 1 < belly.length; i++) {
    thickLine(belly[i][0], belly[i][1], belly[i + 1][0], belly[i + 1][1], 44, [126, 140, 216], 0.95);
  }
  // Dark dorsal band along the top for depth, under the rim light.
  for (let i = 0; i + 1 < spine.length; i++) {
    const w = widths[i] * 0.5;
    const oy = -(widths[i] * 0.22);
    thickLine(spine[i][0], spine[i][1] + oy, spine[i + 1][0], spine[i + 1][1] + oy, w, [32, 38, 100], 0.85);
  }
  // Belly grooves.
  for (let g = 0; g < 3; g++) {
    const pts = spine.map(([x, y], i) => [x - 2 + g * 4, y + 34 + g * 12 + i] as [number, number]);
    thickPolyline(pts, 3, [90, 104, 190], 0.7);
  }
  // Cyan rim light along the whale's upper edge.
  const rim: Array<[number, number]> = spine.map(([x, y], i) => {
    const off = -(widths[i] / 2) + 4;
    return [x + 4, y + off];
  });
  thickPolyline(rim, 7, [120, 235, 255], 0.95);
  glow(470, 470, 200, [90, 200, 255], 0.16);
  // Golden light from the moon catching the back.
  thickPolyline(
    [[560, 420], [640, 366], [706, 322]],
    5, [255, 214, 130], 0.8,
  );

  // Tail flukes, spread wide and rim-lit so they read against the dark sea.
  fillPolygon(
    [[168, 806], [84, 726], [112, 806], [148, 846]],
    [52, 60, 148], 1,
  );
  fillPolygon(
    [[168, 806], [92, 872], [128, 832], [160, 826]],
    [44, 52, 130], 1,
  );
  thickPolyline([[168, 806], [84, 726]], 6, [120, 235, 255], 0.95);
  thickPolyline([[168, 806], [92, 872]], 6, [120, 235, 255], 0.9);

  // Pectoral fin, swept back and rim-lit.
  fillPolygon(
    [[472, 556], [396, 676], [452, 684], [524, 578]],
    [40, 48, 120], 1,
  );
  thickPolyline([[472, 556], [396, 676]], 5, [120, 235, 255], 0.9);

  // Head: a bigger, rounder snout, jaw line, eye, blowhole spray.
  fillEllipse(720, 330, 78, 56, -0.6, [52, 60, 148], 1);
  fillEllipse(742, 350, 54, 34, -0.6, [126, 140, 216], 0.95);
  thickPolyline(
    [[672, 348], [716, 364], [762, 348]],
    4, INK, 0.9,
  );
  // Eye: white glint with a dark pupil, looking up at the moon.
  fillCircle(730, 312, 10, [255, 255, 255], 1);
  fillCircle(732, 310, 5, [8, 8, 20], 1);
  fillCircle(734, 308, 2, [255, 255, 255], 1);
  // Blowhole spray: a fan of bright droplets above the head.
  for (let i = 0; i < 46; i++) {
    const ang = -Math.PI / 2 + (rand() - 0.5) * 1.5;
    const sp = 26 + rand() * 90;
    const dx = Math.cos(ang) * sp;
    const dy = Math.sin(ang) * sp * 0.9;
    const r = 1.5 + rand() * 3.5;
    fillCircle(706 + dx, 296 + dy, r, [230, 245, 255], 0.95);
  }
  glow(706, 250, 60, [200, 235, 255], 0.5);
}

function paintBirds(): void {
  // Startled birds scattering off the whale's path.
  const spots: Array<[number, number, number]> = [
    [560, 300, 1.4], [610, 260, 1.1], [520, 240, 1.0],
    [820, 300, 1.2], [880, 260, 1.0], [470, 300, 0.9],
    [300, 480, 1.2], [250, 430, 1.0], [780, 430, 1.1],
  ];
  for (const [x, y, s] of spots) {
    const w = 12 * s;
    thickLine(x - w, y, x, y - 5 * s, 2.4, INK, 0.95);
    thickLine(x, y - 5 * s, x + w, y, 2.4, INK, 0.95);
  }
}

function paintSparkles(): void {
  // Golden embers and spray glitter trailing the whale.
  for (let i = 0; i < 90; i++) {
    const t = rand();
    const x = 180 + t * 560 + (rand() - 0.5) * 60;
    const y = 800 - t * 480 + (rand() - 0.5) * 70;
    const r = 1 + rand() * 2.4;
    const c: RGB = rand() < 0.5 ? [255, 214, 130] : [150, 230, 255];
    fillCircle(x, y, r, c, 0.9);
    if (rand() < 0.25) glow(x, y, r * 4, c, 0.5);
  }
}

function paintBillboard(roofs: Array<{ x: number; w: number; top: number }>): void {
  // A rooftop neon sign that says what the whole city is thinking.
  const roof = roofs.find((r) => r.x > 560 && r.x < 700 && r.w > 130) ?? roofs[6];
  if (!roof) return;
  const bx = roof.x + 8;
  const by = roof.top - 58;
  rect(bx - 4, by - 4, 178, 54, [10, 6, 26], 1);
  // Neon frame.
  thickLine(bx - 4, by - 4, bx + 174, by - 4, 3, [255, 93, 162], 0.95);
  thickLine(bx - 4, by + 50, bx + 174, by + 50, 3, [255, 93, 162], 0.95);
  thickLine(bx - 4, by - 4, bx - 4, by + 50, 3, [255, 93, 162], 0.95);
  thickLine(bx + 174, by - 4, bx + 174, by + 50, 3, [255, 93, 162], 0.95);
  glow(bx + 85, by + 23, 110, [255, 93, 162], 0.25);
  // One crisp neon line, glowing from behind.
  drawText("LOOK UP!", bx + 12, by + 12, 3, [255, 150, 205], 0.55);
  drawText("LOOK UP!", bx + 12, by + 12, 3, [255, 245, 252], 1);
}

function paintVignette(): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2);
      const dy = (y - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.85) {
        const a = Math.min(0.28, (d - 0.85) * 0.9);
        blend(x, y, [4, 4, 16], a);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PNG encoding (zlib deflate + CRC32, per-row filter selection).
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  crc.copy(out, 8 + data.length);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  const bpp = 3;
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(W * 3);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      row[x * 3] = px[o];
      row[x * 3 + 1] = px[o + 1];
      row[x * 3 + 2] = px[o + 2];
    }
    const prev = y === 0 ? null : raw.subarray((y - 1) * (W * 3 + 1) + 1, y * (W * 3 + 1));
    let bestType = 0;
    let bestScore = Infinity;
    let best: Buffer | null = null;
    for (let type = 0; type <= 4; type++) {
      const f = Buffer.alloc(W * 3);
      for (let i = 0; i < W * 3; i++) {
        const left = i >= bpp ? row[i - bpp] : 0;
        const up = prev ? prev[i] : 0;
        const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
        let pred = 0;
        if (type === 1) pred = left;
        else if (type === 2) pred = up;
        else if (type === 3) pred = Math.floor((left + up) / 2);
        else if (type === 4) pred = paeth(left, up, upLeft);
        f[i] = (row[i] - pred) & 0xff;
      }
      let score = 0;
      for (let i = 0; i < f.length; i++) {
        const s = f[i] < 128 ? f[i] : f[i] - 256;
        score += s < 0 ? -s : s;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best = f;
      }
    }
    raw[y * (W * 3 + 1)] = bestType;
    (best as Buffer).copy(raw, y * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Build the scene and write /output/entry.png.
// ---------------------------------------------------------------------------
function main(): void {
  paintSky();
  paintStars();
  paintAurora();
  paintMoon();
  paintClouds();
  const roofs = paintCity();
  paintBeams(roofs);
  paintSea();
  paintSplash();
  paintWhale();
  paintBirds();
  paintSparkles();
  paintBillboard(roofs);
  paintVignette();

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, encodePng());
  console.log(`wrote ${outPath}`);
}

main();
