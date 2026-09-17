import * as THREE from 'three';

// Track layout: distance is measured from the start line (0) to the finish line (TRACK_LENGTH).
// Each biome has a `start` distance; it runs until the next biome's `start`. TRANSITION_LENGTH
// is how many meters before each boundary the blend begins, so the shift feels gradual instead
// of a hard cut. Add a biome by inserting another entry — everything downstream (ground segment
// layout, sky/fog/light blending, prop placement) reads this array, nothing is hardcoded per-biome.
export const TRANSITION_LENGTH = 120;

export const BIOMES = [
  {
    name: 'city',
    start: 0,
    sky: { top: 0x2b3e5d, bottom: 0xc99563 },
    fog: { color: 0x4e6487, near: 48, far: 180 },
    sun: { color: 0xffd4a0, intensity: 0.46 },
    ambient: { intensity: 0.6 },
    ground: { color: 0x3c4348 },
    props: 'city',
  },
  {
    name: 'coastal',
    start: 380,
    // Bright coastal atmosphere: lighter/hazier blue sky, warmer low sun.
    sky: { top: 0x59b3e6, bottom: 0xe8f6f4 },
    fog: { color: 0xcfe9ee, near: 70, far: 260 },
    sun: { color: 0xfff1c9, intensity: 0.85 },
    ambient: { intensity: 0.75 },
    ground: { color: 0xdccb95 }, // sand tint (right-side city ground keeps its own texture — see scene.js)
    props: 'coastal',
  },
  {
    name: 'desert',
    start: 760,
    sky: { top: 0x5b7ea8, bottom: 0xf2c88a },
    fog: { color: 0xd9b487, near: 60, far: 230 },
    sun: { color: 0xffe0a8, intensity: 0.72 },
    ambient: { intensity: 0.7 },
    ground: { color: 0xc9a56b },
    props: 'desert',
  },
  {
    name: 'jungle',
    start: 1200,
    // Bright daytime jungle, not the dark/dusk canopy look this used to have: clear sky blue
    // fading to a light (but NOT near-white — see below) horizon, high-visibility fog, and both
    // sun and ambient raised above every other biome to counteract how much shadow the dense
    // tree canopy casts (three.js shadow maps have no standalone "intensity" — the fix is more
    // fill light). Colors close to pure white here blow out badly once the bloom pass sees them
    // (verified: an earlier pass at 0xdff5e6/0xfff4d6 washed the whole horizon into a white glow),
    // so these are deliberately held back from that edge, not just "however bright looks right."
    sky: { top: 0x5fa8e0, bottom: 0xb8ddc4 },
    fog: { color: 0xbfe0cc, near: 55, far: 220 },
    sun: { color: 0xfff0c8, intensity: 0.62 },
    ambient: { intensity: 0.85 },
    ground: { color: 0x4a6b3f },
    props: 'jungle',
  },
];

// Look up a biome by name / find whichever biome immediately follows another in the sequence —
// used instead of hardcoded BIOMES[n] indices so inserting a biome (like this one) can't silently
// shift some other file's index references out from under it.
export function getBiomeByName(name) { return BIOMES.find(b => b.name === name); }
export function getNextBiome(biome) {
  const i = BIOMES.indexOf(biome);
  return i >= 0 ? BIOMES[i + 1] || null : null;
}

export const TRACK_LENGTH = 1700; // total start-to-finish distance
export const START_Z = -TRACK_LENGTH / 2;
export const FINISH_Z = TRACK_LENGTH / 2;

// distance (0..TRACK_LENGTH) -> world Z
export function distanceToZ(distance) { return START_Z + distance; }
export function zToDistance(z) { return z - START_Z; }

// Given a distance along the track, return the two biomes on either side of the current point
// and a 0..1 blend factor between them (0 = fully biomeA, 1 = fully biomeB). Outside any
// transition band, biomeA === biomeB and t is 0.
export function sampleBiome(distance) {
  for (let i = 0; i < BIOMES.length; i++) {
    const biome = BIOMES[i];
    const next = BIOMES[i + 1];
    const zoneEnd = next ? next.start : Infinity;
    if (distance < zoneEnd) {
      if (next) {
        const blendStart = zoneEnd - TRANSITION_LENGTH;
        if (distance >= blendStart) {
          const t = THREE.MathUtils.clamp((distance - blendStart) / TRANSITION_LENGTH, 0, 1);
          return { biomeA: biome, biomeB: next, t };
        }
      }
      return { biomeA: biome, biomeB: biome, t: 0 };
    }
  }
  const last = BIOMES[BIOMES.length - 1];
  return { biomeA: last, biomeB: last, t: 0 };
}

// Returns a fresh Color each call — callers (main.js) call this several times per frame and
// hold each result in its own variable, so a shared/reused instance here would let a later
// call silently overwrite an earlier one's value before it's consumed.
export function lerpBiomeColor(hexA, hexB, t) {
  return new THREE.Color(hexA).lerp(new THREE.Color(hexB), t);
}
