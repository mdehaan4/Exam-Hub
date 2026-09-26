// Indoor fairground hall layout. One character per 16px tile:
//   '#' wall top (seen from above)   'F' wall face (the back wall, seen front-on)
//   '.' wooden floor                 'c' red carpet   'D' entrance mat
// Walls are solid; props (below) add their own solid footprints on top of the floor.
export const TILE = 16;

export const MAP_ROWS = [
  '################################',
  '#FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............cc..............#',
  '#..............cc..............#',
  '#..............cc..............#',
  '#..............cc..............#',
  '#..............cc..............#',
  '#..............cc..............#',
  '#..............cc..............#',
  '###############DD###############',
];

export const MAP_WIDTH = MAP_ROWS[0].length;
export const MAP_HEIGHT = MAP_ROWS.length;

// Tile indices into the generated tileset (textures.js draws them in this order).
export const TILES = {
  FLOOR_A: 0,
  FLOOR_B: 1,
  WALL_TOP: 2,
  WALL_FACE: 3,
  MAT: 4,
  CARPET_L: 5,
  CARPET_R: 6,
};
export const TILE_COUNT = 7;

const SOLID_CHARS = new Set(['#', 'F']);

// Props sit on the floor; x/y/w/h are in tiles and the whole footprint is solid.
export const PROPS = [
  { type: 'stall', x: 3, y: 2, w: 4, h: 2, color: 0xd94a4a },
  { type: 'stall', x: 9, y: 2, w: 4, h: 2, color: 0x3f7fd9 },
  { type: 'stall', x: 19, y: 2, w: 4, h: 2, color: 0xe0b43a },
  { type: 'stall', x: 25, y: 2, w: 4, h: 2, color: 0x46a55a },
  { type: 'carousel', x: 13, y: 7, w: 6, h: 6 },
  { type: 'duckPond', x: 3, y: 9, w: 4, h: 3 },
  { type: 'highStriker', x: 26, y: 9, w: 2, h: 2 },
  { type: 'ticketBooth', x: 4, y: 15, w: 2, h: 2 },
  { type: 'popcornCart', x: 25, y: 15, w: 2, h: 2 },
  { type: 'bench', x: 9, y: 16, w: 2, h: 1 },
  { type: 'bench', x: 21, y: 16, w: 2, h: 1 },
];

export const PLAYER_START = { x: 15, y: 19, facing: 'up' };

// Tile index for each map cell (floor variety is deterministic so the layout never shifts).
export function buildTileData() {
  return MAP_ROWS.map((row, y) => [...row].map((ch, x) => {
    switch (ch) {
      case '#': return TILES.WALL_TOP;
      case 'F': return TILES.WALL_FACE;
      case 'D': return TILES.MAT;
      case 'c': return row[x + 1] === 'c' ? TILES.CARPET_L : TILES.CARPET_R;
      default: return (x * 7 + y * 13) % 5 === 0 ? TILES.FLOOR_B : TILES.FLOOR_A;
    }
  }));
}

// solid[y][x] === true where the player can't walk.
export function buildSolidGrid() {
  const solid = MAP_ROWS.map(row => [...row].map(ch => SOLID_CHARS.has(ch)));
  PROPS.forEach(p => {
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) solid[y][x] = true;
    }
  });
  return solid;
}
