import { TILE, TILES, TILE_COUNT } from './map.js';

// All art is drawn in code onto canvas textures, so the mode has no image assets to load.

export const TILESET_KEY = 'hmrc-tiles';
export const PLAYER_KEY = 'hmrc-player';
export const SHADOW_KEY = 'hmrc-shadow';
export const PLAYER_W = 16;
export const PLAYER_H = 20;

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ---- tiles ----

function drawFloor(ctx, ox, base, alt, seam, seamShift) {
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    rect(ctx, row % 2 ? alt : base, ox, y, TILE, 4);
    rect(ctx, seam, ox, y + 3, TILE, 1); // gap between planks
    rect(ctx, seam, ox + ((row * 5 + seamShift) % TILE), y, 1, 3); // plank end
  }
  rect(ctx, '#7a4f2c', ox + 3, 1, 1, 1);
  rect(ctx, '#7a4f2c', ox + 11, 9, 1, 1);
}

function drawWallTop(ctx, ox) {
  rect(ctx, '#3a2a3f', ox, 0, TILE, TILE);
  rect(ctx, '#45334b', ox + 2, 2, 5, 5);
  rect(ctx, '#45334b', ox + 9, 9, 5, 5);
}

function drawWallFace(ctx, ox) {
  rect(ctx, '#7a2f3a', ox, 0, TILE, TILE);
  rect(ctx, '#5e2330', ox + 7, 3, 1, 10); // panel seams
  rect(ctx, '#5e2330', ox + 15, 3, 1, 10);
  rect(ctx, '#8c3a46', ox + 1, 4, 5, 8); // raised panels
  rect(ctx, '#8c3a46', ox + 9, 4, 5, 8);
  rect(ctx, '#e0b43a', ox, 0, TILE, 2); // gold top trim
  rect(ctx, '#4a1c26', ox, 13, TILE, 3); // skirting board
}

function drawMat(ctx, ox) {
  rect(ctx, '#8a5a36', ox, 0, TILE, TILE);
  rect(ctx, '#6b3f2a', ox + 1, 1, TILE - 2, TILE - 2);
  for (let y = 3; y < 13; y += 3) rect(ctx, '#7d4d30', ox + 2, y, TILE - 4, 1);
}

function drawCarpet(ctx, ox, edge) {
  rect(ctx, '#b3263a', ox, 0, TILE, TILE);
  rect(ctx, '#9c1f31', ox, 7, TILE, 2);
  rect(ctx, '#e0b43a', ox + (edge === 'left' ? 0 : TILE - 2), 0, 2, TILE);
}

export function createTileset(scene) {
  const tex = scene.textures.createCanvas(TILESET_KEY, TILE * TILE_COUNT, TILE);
  const ctx = tex.context;
  const at = i => i * TILE;
  drawFloor(ctx, at(TILES.FLOOR_A), '#b9834f', '#b07a47', '#8f5f36', 0);
  drawFloor(ctx, at(TILES.FLOOR_B), '#c08a55', '#b5804c', '#8f5f36', 7);
  drawWallTop(ctx, at(TILES.WALL_TOP));
  drawWallFace(ctx, at(TILES.WALL_FACE));
  drawMat(ctx, at(TILES.MAT));
  drawCarpet(ctx, at(TILES.CARPET_L), 'left');
  drawCarpet(ctx, at(TILES.CARPET_R), 'right');
  tex.refresh();
}

// ---- player character (16x20 pixel art, 3 frames per facing) ----

const C = {
  outline: '#1d1a24',
  hair: '#3a2618',
  skin: '#f1c7a1',
  eye: '#1d1a24',
  jacket: '#2f5d8a',
  jacketDark: '#24486c',
  shirt: '#f4f4f4',
  trousers: '#2b2d3a',
  shoes: '#15151c',
};

// step: 0 = standing, 1 = left foot forward, 2 = right foot forward.
function characterShapes(facing, step) {
  const s = [];
  const add = (color, x, y, w, h) => s.push([color, x, y, w, h]);
  const legs = (lx, rx) => {
    const lLen = step === 2 ? 2 : 3, rLen = step === 1 ? 2 : 3;
    add(C.trousers, lx, 16, 2, lLen); add(C.shoes, lx, 16 + lLen, 2, 1);
    add(C.trousers, rx, 16, 2, rLen); add(C.shoes, rx, 16 + rLen, 2, 1);
  };

  if (facing === 'down' || facing === 'up') {
    add(C.hair, 4, 1, 8, 2);
    add(C.hair, 3, 3, 10, 3);
    if (facing === 'down') {
      add(C.hair, 3, 6, 1, 3); add(C.hair, 12, 6, 1, 3);
      add(C.skin, 4, 6, 8, 5);
      add(C.eye, 6, 8, 1, 2); add(C.eye, 9, 8, 1, 2);
    } else {
      add(C.hair, 3, 6, 10, 5);
    }
    add(C.jacket, 4, 11, 8, 5);
    if (facing === 'down') { add(C.shirt, 7, 11, 2, 3); }
    const lArmY = step === 1 ? 10 : 11, rArmY = step === 2 ? 10 : 11;
    add(C.jacketDark, 3, lArmY, 1, 4); add(C.skin, 3, lArmY + 4, 1, 1);
    add(C.jacketDark, 12, rArmY, 1, 4); add(C.skin, 12, rArmY + 4, 1, 1);
    legs(5, 9);
  } else {
    // side view, facing left (right is the same frames mirrored)
    add(C.hair, 5, 1, 7, 2);
    add(C.hair, 4, 3, 9, 3);
    add(C.skin, 4, 6, 5, 5);
    add(C.skin, 3, 8, 1, 1); // nose
    add(C.hair, 9, 6, 3, 4);
    add(C.eye, 5, 8, 1, 2);
    add(C.jacket, 5, 11, 6, 5);
    const armX = step === 1 ? 6 : step === 2 ? 8 : 7;
    add(C.jacketDark, armX, 11, 2, 4); add(C.skin, armX, 15, 2, 1);
    if (step === 0) legs(6, 8);
    else legs(step === 1 ? 5 : 6, step === 1 ? 9 : 8);
  }
  return s;
}

function drawCharacter(ctx, ox, facing, step) {
  const shapes = characterShapes(facing, step);
  // 1px outline: every shape grown by a pixel in the outline colour, then the fills on top.
  shapes.forEach(([, x, y, w, h]) => rect(ctx, C.outline, ox + x - 1, y - 1, w + 2, h + 2));
  shapes.forEach(([color, x, y, w, h]) => rect(ctx, color, ox + x, y, w, h));
}

export const FACINGS = ['down', 'up', 'side'];

export function createPlayerTexture(scene) {
  const tex = scene.textures.createCanvas(PLAYER_KEY, PLAYER_W * FACINGS.length * 3, PLAYER_H);
  FACINGS.forEach((facing, fi) => {
    for (let step = 0; step < 3; step++) {
      const ox = (fi * 3 + step) * PLAYER_W;
      drawCharacter(tex.context, ox, facing === 'side' ? 'left' : facing, step);
      tex.add(`${facing}-${step}`, 0, ox, 0, PLAYER_W, PLAYER_H);
    }
  });
  tex.refresh();

  FACINGS.forEach(facing => {
    scene.anims.create({
      key: `walk-${facing}`,
      frames: [1, 0, 2, 0].map(step => ({ key: PLAYER_KEY, frame: `${facing}-${step}` })),
      frameRate: 10,
      repeat: -1,
    });
  });

  const shadow = scene.textures.createCanvas(SHADOW_KEY, 12, 4);
  shadow.context.fillStyle = 'rgba(0,0,0,0.28)';
  shadow.context.beginPath();
  shadow.context.ellipse(6, 2, 6, 2, 0, 0, Math.PI * 2);
  shadow.context.fill();
  shadow.refresh();
}
