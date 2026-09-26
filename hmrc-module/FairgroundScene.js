import * as Phaser from 'phaser';
import { TILE, MAP_WIDTH, MAP_HEIGHT, PROPS, PLAYER_START, buildTileData, buildSolidGrid } from './map.js';
import { TILESET_KEY, PLAYER_KEY, SHADOW_KEY, createTileset, createPlayerTexture } from './textures.js';
import { addProps, addWallDecor } from './props.js';

const STEP_MS = 220; // time to walk one tile
const TURN_MS = 90; // tapping a new direction from standing turns on the spot first
const VIEW_TILES = { w: 18, h: 12 }; // roughly how much of the hall the camera shows

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const KEY_TO_DIR = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const animFacing = dir => (dir === 'left' || dir === 'right' ? 'side' : dir);

export class FairgroundScene extends Phaser.Scene {
  constructor() {
    super('fairground');
  }

  create() {
    createTileset(this);
    createPlayerTexture(this);

    const map = this.make.tilemap({ data: buildTileData(), tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, 0, 0);
    map.createLayer(0, tileset, 0, 0).setDepth(0);
    addWallDecor(this);
    addProps(this, PROPS);
    this.solid = buildSolidGrid();

    this.tileX = PLAYER_START.x;
    this.tileY = PLAYER_START.y;
    this.facing = PLAYER_START.facing;
    this.moving = false;
    this.turnUntil = 0;
    this.lastStepEnd = -Infinity;

    const { x, y } = this.tileToWorld(this.tileX, this.tileY);
    this.shadow = this.add.image(x, y - 1, SHADOW_KEY);
    this.player = this.add.sprite(x, y, PLAYER_KEY, `${animFacing(this.facing)}-0`).setOrigin(0.5, 1);

    // Most recently pressed movement key wins, like Pokémon; releasing it falls back to any
    // other key still held.
    this.heldKeys = [];
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', e => {
      if (!KEY_TO_DIR[e.code]) return;
      this.heldKeys = this.heldKeys.filter(k => k !== e.code);
      this.heldKeys.push(e.code);
    });
    this.input.keyboard.on('keyup', e => { this.heldKeys = this.heldKeys.filter(k => k !== e.code); });
    this.game.events.on(Phaser.Core.Events.BLUR, () => { this.heldKeys = []; });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_WIDTH * TILE, MAP_HEIGHT * TILE);
    cam.setRoundPixels(true);
    cam.startFollow(this.player, true);
    this.fitZoom();
    this.scale.on('resize', () => this.fitZoom());

    window.__hmrc = this; // test/debug handle
  }

  // Integer zoom keeps the pixel art crisp.
  fitZoom() {
    const { width, height } = this.scale.gameSize;
    const zoom = Math.floor(Math.min(width / (VIEW_TILES.w * TILE), height / (VIEW_TILES.h * TILE)));
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 2, 6));
  }

  // Bottom-centre of a tile, where the character's feet stand.
  tileToWorld(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 1 };
  }

  isWalkable(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < MAP_WIDTH && ty < MAP_HEIGHT && !this.solid[ty][tx];
  }

  heldDirection() {
    const code = this.heldKeys[this.heldKeys.length - 1];
    return code ? KEY_TO_DIR[code] : null;
  }

  face(dir) {
    this.facing = dir;
    this.player.setFlipX(dir === 'right');
  }

  standStill() {
    this.player.anims.stop();
    this.player.setFrame(`${animFacing(this.facing)}-0`);
  }

  update(time) {
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y - 1).setDepth(this.player.y - 0.5);
    if (this.moving) return;

    const dir = this.heldDirection();
    if (!dir) { this.standStill(); return; }

    const continuing = time - this.lastStepEnd < 60;
    if (dir !== this.facing) {
      this.face(dir);
      if (!continuing) {
        this.standStill();
        this.turnUntil = time + TURN_MS;
        return;
      }
    }
    if (time < this.turnUntil) return;

    const tx = this.tileX + DIRS[dir].dx, ty = this.tileY + DIRS[dir].dy;
    if (!this.isWalkable(tx, ty)) { this.standStill(); return; }

    this.moving = true;
    this.tileX = tx;
    this.tileY = ty;
    this.player.anims.play(`walk-${animFacing(dir)}`, true);
    const target = this.tileToWorld(tx, ty);
    this.tweens.add({
      targets: this.player,
      x: target.x,
      y: target.y,
      duration: STEP_MS,
      onComplete: () => {
        this.moving = false;
        this.lastStepEnd = this.time.now;
      },
    });
  }
}
