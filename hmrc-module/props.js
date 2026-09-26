import { TILE, MAP_WIDTH } from './map.js';

// Fairground props drawn with Phaser Graphics. Each prop is drawn relative to the top-left of
// its tile footprint (px, py) and may extend above it (awnings, poles, canopies) to suggest
// height; its depth is the footprint's bottom edge so the player is y-sorted against it.

const CREAM = 0xf6efe0;
const WOOD = 0x8a5a36;
const WOOD_DARK = 0x6b3f2a;
const GOLD = 0xe0b43a;
const RED = 0xd94a4a;

function shadow(g, x, y, w, h) {
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(x + w / 2, y + h - 1, w, 6);
}

function stall(g, x, y, W, H, color) {
  shadow(g, x, y, W, H);
  g.fillStyle(WOOD, 1).fillRect(x + 1, y + 10, W - 2, H - 10);
  g.fillStyle(color, 1).fillRect(x + 1, y + H - 10, W - 2, 7);
  g.fillStyle(0xd8b58a, 1).fillRect(x, y + 9, W, 4); // counter top
  const prizes = [0xff7eb6, 0x7ee0ff, 0xfff07e, 0xb58cff];
  for (let i = 0; x + 6 + i * 9 < x + W - 4; i++) {
    g.fillStyle(prizes[i % prizes.length], 1).fillCircle(x + 6 + i * 9, y + 8, 3);
  }
  g.fillStyle(CREAM, 1).fillRect(x + 1, y - 8, 2, 18).fillRect(x + W - 3, y - 8, 2, 18); // posts
  // striped awning with a scalloped edge
  for (let sx = 0, i = 0; sx < W + 4; sx += 8, i++) {
    g.fillStyle(i % 2 ? CREAM : color, 1);
    g.fillRect(x - 2 + sx, y - 12, Math.min(8, W + 4 - sx), 11);
    g.fillCircle(x - 2 + sx + 4, y - 1, 4);
  }
  g.fillStyle(0x000000, 0.25).fillRect(x - 2, y - 13, W + 4, 1);
}

function carousel(g, x, y, W, H) {
  const cx = x + W / 2, cy = y + H / 2;
  g.fillStyle(0x000000, 0.2).fillEllipse(cx, cy + 8, W, H - 6);
  g.fillStyle(WOOD_DARK, 1).fillCircle(cx, cy + 4, 46);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.fillStyle(i % 2 ? 0xffe08a : 0xff9f43, 1).fillCircle(cx + Math.cos(a) * 44, cy + 4 + Math.sin(a) * 44, 1.5);
  }
  g.fillStyle(0xcaa06a, 1).fillCircle(cx, cy + 4, 41);
  // horses around the ring
  const saddles = [RED, 0x3f7fd9, 0x46a55a, GOLD];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const hx = cx + Math.cos(a) * 34, hy = cy + 4 + Math.sin(a) * 34;
    g.fillStyle(0xfdf8ee, 1).fillEllipse(hx, hy, 11, 6);
    g.fillStyle(0xfdf8ee, 1).fillCircle(hx + Math.cos(a + Math.PI / 2) * 5, hy + Math.sin(a + Math.PI / 2) * 5 - 1, 2.5);
    g.fillStyle(saddles[i % saddles.length], 1).fillCircle(hx, hy, 2.5);
  }
  // raised canopy, drawn higher than the platform to read as the roof
  const ty = cy - 10;
  g.fillStyle(0x000000, 0.2).fillCircle(cx, cy + 2, 30);
  for (let i = 0; i < 12; i++) {
    g.fillStyle(i % 2 ? CREAM : RED, 1);
    g.slice(cx, ty, 30, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2, false);
    g.fillPath();
  }
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    g.fillStyle(i % 2 ? CREAM : RED, 1).fillCircle(cx + Math.cos(a) * 29, ty + Math.sin(a) * 29, 4);
  }
  g.fillStyle(GOLD, 1).fillCircle(cx, ty, 5);
  g.fillStyle(0xfff3b0, 1).fillCircle(cx - 1, ty - 1, 2);
}

function duckPond(g, x, y, W, H) {
  shadow(g, x, y, W, H);
  g.fillStyle(GOLD, 1).fillRoundedRect(x, y, W, H, 8);
  g.fillStyle(0x3d8fd9, 1).fillRoundedRect(x + 5, y + 5, W - 10, H - 10, 6);
  g.fillStyle(0x7fc0f5, 1).fillRect(x + 12, y + 14, 10, 1).fillRect(x + 36, y + 30, 12, 1).fillRect(x + 20, y + 34, 8, 1);
  [[16, 12], [34, 18], [48, 12], [22, 28], [44, 32]].forEach(([dx, dy]) => {
    g.fillStyle(0xffd54a, 1).fillCircle(x + dx, y + dy, 3.5);
    g.fillStyle(0xffd54a, 1).fillCircle(x + dx - 3, y + dy - 2, 2.5);
    g.fillStyle(0xff8a2a, 1).fillRect(x + dx - 7, y + dy - 2, 2, 1);
  });
}

function highStriker(g, x, y, W, H) {
  shadow(g, x, y, W, H);
  g.fillStyle(WOOD_DARK, 1).fillRect(x + 4, y + 16, 24, 14);
  g.fillStyle(RED, 1).fillCircle(x + 16, y + 22, 5);
  g.fillStyle(CREAM, 1).fillRect(x + 14, y - 44, 4, 62); // tower
  const marks = [RED, 0xff9f43, GOLD, 0x46a55a, 0x3f7fd9];
  marks.forEach((c, i) => g.fillStyle(c, 1).fillRect(x + 12, y - 38 + i * 10, 8, 3));
  g.fillStyle(GOLD, 1).fillCircle(x + 16, y - 46, 5);
  g.fillStyle(0xfff3b0, 1).fillCircle(x + 15, y - 47, 2);
  g.fillStyle(WOOD, 1).fillRect(x + 25, y + 4, 2, 14); // mallet handle
  g.fillStyle(0x5a3a2a, 1).fillRect(x + 22, y + 1, 8, 5); // mallet head
}

function ticketBooth(g, x, y, W, H) {
  shadow(g, x, y, W, H);
  g.fillStyle(CREAM, 1).fillRect(x + 2, y + 6, W - 4, H - 6);
  for (let sx = 4; sx < W - 4; sx += 6) g.fillStyle(RED, 1).fillRect(x + sx, y + 6, 3, H - 6);
  g.fillStyle(0x2a2233, 1).fillRect(x + 8, y + 12, 16, 9);
  g.fillStyle(0xffe08a, 1).fillRect(x + 9, y + 13, 14, 7);
  g.fillStyle(WOOD, 1).fillRect(x + 6, y + 21, 20, 3); // ticket ledge
  g.fillStyle(RED, 1).fillTriangle(x - 1, y + 8, x + W / 2, y - 8, x + W + 1, y + 8);
  g.fillStyle(GOLD, 1).fillCircle(x + W / 2, y - 9, 2.5);
}

function popcornCart(g, x, y, W, H) {
  shadow(g, x, y, W, H);
  g.fillStyle(0x2a2233, 1).fillCircle(x + 8, y + H - 3, 4).fillCircle(x + W - 8, y + H - 3, 4);
  for (let sx = 0, i = 0; sx < W - 6; sx += 4, i++) {
    g.fillStyle(i % 2 ? CREAM : RED, 1).fillRect(x + 3 + sx, y + 14, Math.min(4, W - 6 - sx), 13);
  }
  g.fillStyle(0xcfe8f2, 0.85).fillRect(x + 5, y + 2, W - 10, 12);
  for (let i = 0; i < 14; i++) g.fillStyle(0xfff3b0, 1).fillCircle(x + 8 + (i * 5) % 16, y + 9 + Math.floor(i / 4) * 1.5, 1.6);
  g.fillStyle(RED, 1).fillRect(x + 2, y - 2, W - 4, 4);
}

function bench(g, x, y, W, H) {
  shadow(g, x, y, W, H);
  g.fillStyle(0x3b2a20, 1).fillRect(x + 3, y + 4, 2, H - 4).fillRect(x + W - 5, y + 4, 2, H - 4);
  g.fillStyle(0xa8703f, 1).fillRect(x + 1, y - 3, W - 2, 3); // backrest
  for (let i = 0; i < 3; i++) g.fillStyle(i % 2 ? 0x9a6639 : 0xa8703f, 1).fillRect(x + 1, y + 2 + i * 3, W - 2, 2);
}

const DRAWERS = { stall, carousel, duckPond, highStriker, ticketBooth, popcornCart, bench };

export function addProps(scene, props) {
  props.forEach(p => {
    const g = scene.add.graphics();
    const px = p.x * TILE, py = p.y * TILE, W = p.w * TILE, H = p.h * TILE;
    DRAWERS[p.type](g, px, py, W, H, p.color);
    g.setDepth(py + H);
  });
}

// Bunting and string lights along the back wall (decoration only, never blocks movement).
export function addWallDecor(scene) {
  const g = scene.add.graphics().setDepth(1);
  const flags = [RED, 0x3f7fd9, GOLD, 0x46a55a, CREAM];
  const left = TILE + 4, right = (MAP_WIDTH - 1) * TILE - 4;
  g.lineStyle(1, 0x2a2233, 1).lineBetween(left, TILE + 3, right, TILE + 3);
  for (let x = left, i = 0; x + 8 <= right; x += 11, i++) {
    g.fillStyle(flags[i % flags.length], 1).fillTriangle(x, TILE + 3, x + 8, TILE + 3, x + 4, TILE + 10);
  }
  for (let x = left + 3, i = 0; x < right; x += 7, i++) {
    g.fillStyle(i % 2 ? 0xffe08a : 0xff9f43, 1).fillCircle(x, TILE + 12, 1.2);
  }
}
