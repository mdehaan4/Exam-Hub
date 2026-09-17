import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BIOMES, TRANSITION_LENGTH, TRACK_LENGTH, START_Z, FINISH_Z, distanceToZ,
  getBiomeByName, getNextBiome,
} from './biomes.js';

// Procedural tinted noise texture, reused per biome (city/desert/jungle) with a different base
// color and speckle palette so each biome's ground reads as a distinct material, not just a
// color-multiplied copy of the same texture.
function buildGroundTexture(baseColor, speckleColor, speckleCount) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < speckleCount; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const size = Math.random() * 3 + 1;
    ctx.fillStyle = speckleColor(Math.random());
    ctx.fillRect(x, y, size, size);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Dedicated beach sand, rather than reusing the generic tinted-noise ground texture: fine grain
// speckle, wind-blown dune streaks, scattered pebbles and shell flecks, plus a damp/darker band
// so the sand doesn't read as one flat tone.
function buildSandTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#e3d3a0';
  ctx.fillRect(0, 0, S, S);

  // broad tonal variation so large areas aren't uniform
  for (let i = 0; i < 40; i++) {
    const g = ctx.createRadialGradient(Math.random() * S, Math.random() * S, 0, Math.random() * S, Math.random() * S, 60 + Math.random() * 110);
    const warm = Math.random() < 0.5;
    g.addColorStop(0, warm ? 'rgba(214,193,146,0.30)' : 'rgba(243,231,196,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // wind-blown dune streaks
  ctx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * S;
    const x = Math.random() * S;
    const len = 30 + Math.random() * 120;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(205,184,139,0.28)' : 'rgba(247,238,208,0.26)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + (Math.random() - 0.5) * 10, x + len, y + (Math.random() - 0.5) * 16);
    ctx.stroke();
  }

  // fine grain
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? `rgba(168,150,110,${0.06 + Math.random() * 0.12})` : `rgba(255,250,228,${0.06 + Math.random() * 0.14})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // pebbles + shell flecks
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 1 + Math.random() * 2.6;
    ctx.fillStyle = Math.random() < 0.65 ? `rgba(140,126,99,${0.3 + Math.random() * 0.35})` : `rgba(255,253,244,${0.35 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Procedural facade textures shared by every building instance (one draw call per LOD tier,
// so window/panel detail is "free" no matter how many buildings get added later).
function buildBuildingTextures() {
  // Higher res than before (128x256) so individual windows survive up close, and the texture now
  // maps ONCE over a building's full height (repeat 1,1 instead of 1,2) — that's what lets the
  // ground-floor storefront and roof parapet sit where they belong instead of repeating mid-wall.
  const W = 256, H = 512;
  const cols = 7;
  const storefrontH = Math.round(H * 0.11); // bottom strip = shopfront glazing
  const parapetH = Math.round(H * 0.035);   // top strip = roof trim
  const floorsTop = parapetH;
  const floorsBottom = H - storefrontH;
  const rows = 16;
  const cellW = W / cols, cellH = (floorsBottom - floorsTop) / rows;

  // Per-window state decided once and shared by colour + emissive maps. Brightness varies per
  // window instead of a binary on/off, so a lit facade reads as many individual units rather
  // than one uniform glow.
  const windows = [];
  for (let r = 0; r < rows; r++) {
    windows.push([]);
    for (let c = 0; c < cols; c++) {
      const isLit = Math.random() < 0.42;
      windows[r].push({ lit: isLit, brightness: 0.55 + Math.random() * 0.45 });
    }
  }

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = W; mapCanvas.height = H;
  const mctx = mapCanvas.getContext('2d');
  const normCanvas = document.createElement('canvas');
  normCanvas.width = W; normCanvas.height = H;
  const nctx = normCanvas.getContext('2d');
  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = W; emisCanvas.height = H;
  const ectx = emisCanvas.getContext('2d');

  mctx.fillStyle = '#8d97a6';
  mctx.fillRect(0, 0, W, H);
  nctx.fillStyle = '#8080ff'; // neutral "facing outward" normal
  nctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  // concrete speckle
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    mctx.fillStyle = `rgba(${Math.random()<0.5?0:255},${Math.random()<0.5?0:255},${Math.random()<0.5?0:255},${Math.random()*0.045})`;
    mctx.fillRect(x, y, 2, 2);
  }

  // Horizontal trim bands every few floors, with a matching ridge on the normal map so they
  // catch light as real mouldings rather than painted-on lines.
  for (let r = 0; r <= rows; r += 4) {
    const y = floorsTop + r * cellH;
    mctx.fillStyle = 'rgba(232,238,246,0.22)';
    mctx.fillRect(0, y - 3, W, 5);
    mctx.fillStyle = 'rgba(16,20,28,0.30)';
    mctx.fillRect(0, y + 2, W, 2);
    nctx.fillStyle = '#9b9bff'; nctx.fillRect(0, y - 3, W, 2);
    nctx.fillStyle = '#6565ff'; nctx.fillRect(0, y + 1, W, 2);
  }

  // Window grid
  const winMarginX = cellW * 0.2, winMarginY = cellH * 0.24;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = windows[r][c];
      const x = c * cellW + winMarginX;
      const y = floorsTop + r * cellH + winMarginY;
      const w = cellW - winMarginX * 2;
      const h = cellH - winMarginY * 2;

      if (cell.lit) {
        const b = cell.brightness;
        mctx.fillStyle = `rgb(${Math.round(190 + 65 * b)},${Math.round(165 + 70 * b)},${Math.round(110 + 60 * b)})`;
      } else {
        mctx.fillStyle = `rgb(${28 + Math.random() * 14 | 0},${34 + Math.random() * 14 | 0},${46 + Math.random() * 16 | 0})`;
      }
      mctx.fillRect(x, y, w, h);
      // mullion splitting each pane into two, so windows read as units not blank rectangles
      mctx.fillStyle = 'rgba(20,24,32,0.45)';
      mctx.fillRect(x + w / 2 - 0.5, y, 1, h);

      // recessed frame on the normal map
      nctx.fillStyle = '#7575f2'; nctx.fillRect(x, y, w, 1); nctx.fillRect(x, y, 1, h);
      nctx.fillStyle = '#9292ff'; nctx.fillRect(x, y + h - 1, w, 1); nctx.fillRect(x + w - 1, y, 1, h);

      if (cell.lit) {
        const a = 0.45 + cell.brightness * 0.55;
        ectx.fillStyle = `rgba(255,207,122,${a})`;
        ectx.fillRect(x, y, w, h);
      }
    }
  }

  // Ground-floor storefront: taller glazing, cooler/darker frame, its own warm spill so street
  // level reads differently from the offices above it.
  const sfY = floorsBottom;
  mctx.fillStyle = '#39414f';
  mctx.fillRect(0, sfY, W, storefrontH);
  const bayW = W / 4;
  for (let b = 0; b < 4; b++) {
    const bx = b * bayW + 4;
    const bw = bayW - 8;
    const by = sfY + 6;
    const bh = storefrontH - 14;
    const lit = Math.random() < 0.75;
    mctx.fillStyle = lit ? '#cfd9c6' : '#242c37';
    mctx.fillRect(bx, by, bw, bh);
    nctx.fillStyle = '#7070f0'; nctx.fillRect(bx, by, bw, 2);
    nctx.fillStyle = '#9696ff'; nctx.fillRect(bx, by + bh - 2, bw, 2);
    if (lit) {
      ectx.fillStyle = 'rgba(214,226,196,0.55)';
      ectx.fillRect(bx, by, bw, bh);
    }
  }
  // canopy lip above the shopfronts
  mctx.fillStyle = 'rgba(12,16,22,0.5)';
  mctx.fillRect(0, sfY - 3, W, 4);
  nctx.fillStyle = '#5f5fff'; nctx.fillRect(0, sfY - 1, W, 3);

  // Roof parapet band
  mctx.fillStyle = '#6f7887';
  mctx.fillRect(0, 0, W, parapetH);
  mctx.fillStyle = 'rgba(12,16,22,0.45)';
  mctx.fillRect(0, parapetH - 2, W, 3);

  // Baked ambient occlusion: darken toward the base so buildings feel planted on the ground
  // rather than floating. Cheap (it's just part of the shared texture) and applies to every
  // instance in both LOD tiers.
  const aoHeight = Math.round(H * 0.3);
  const aoGrad = mctx.createLinearGradient(0, H - aoHeight, 0, H);
  aoGrad.addColorStop(0, 'rgba(0,0,0,0)');
  aoGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
  mctx.fillStyle = aoGrad;
  mctx.fillRect(0, H - aoHeight, W, aoHeight);
  // ...and fade the emissive to match, so ground-level glow doesn't punch through the AO
  const aoEmis = ectx.createLinearGradient(0, H - aoHeight, 0, H);
  aoEmis.addColorStop(0, 'rgba(0,0,0,0)');
  aoEmis.addColorStop(1, 'rgba(0,0,0,0.5)');
  ectx.globalCompositeOperation = 'destination-out';
  ectx.fillStyle = aoEmis;
  ectx.fillRect(0, H - aoHeight, W, aoHeight);
  ectx.globalCompositeOperation = 'source-over';

  const map = new THREE.CanvasTexture(mapCanvas);
  const normalMap = new THREE.CanvasTexture(normCanvas);
  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  [map, normalMap, emissiveMap].forEach(t => {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1, 1); // one mapping per building — storefront at the bottom, parapet at the top
    t.colorSpace = t === map || t === emissiveMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  });
  return { map, normalMap, emissiveMap };
}

export function createScene() {
  const scene = new THREE.Scene();
  const cityBiome = getBiomeByName('city');
  scene.background = new THREE.Color(cityBiome.sky.top);
  scene.fog = new THREE.Fog(cityBiome.fog.color, cityBiome.fog.near, cityBiome.fog.far);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 6.2, START_Z + 6.5); // matches where the chase camera settles for the spawn position

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment(renderer);
  scene.environment = pmremGenerator.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 1.3;

  const ambient = new THREE.HemisphereLight(0xd7e7ff, 0x455a45, 0.6);
  scene.add(ambient);

  const fill = new THREE.DirectionalLight(0xb3cbff, 0.16);
  fill.position.set(-18, 12, -14);
  scene.add(fill);

  const sun = new THREE.DirectionalLight(cityBiome.sun.color, cityBiome.sun.intensity);
  sun.position.set(26, 28, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  // The shadow frustum is only ±45 units around the light's target. The target defaults to the
  // world origin, but the track runs from z=-850 to z=+850 — so without moving it, shadows only
  // ever resolve near the origin and do nothing for the ~95% of the track either side of it.
  // main.js keeps both the light and this target pinned to the car each frame.
  scene.add(sun.target);

  // ---- ground: per-biome segments, with a shader-blended strip across each transition ----
  // so the terrain crossfades from one biome's texture into the next instead of cutting hard.
  const GROUND_WIDTH = 260;
  const oceanMaterials = []; // animated per frame in main.js via uTime
  const groundTextures = {
    city: buildGroundTexture('#455159', a => `rgba(255,255,255,${0.04 + a * 0.08})`, 1400),
    coastal: buildSandTexture(),
    desert: buildGroundTexture('#c9a56b', a => `rgba(${120+a*90|0},${80+a*60|0},${40+a*30|0},${0.08 + a * 0.1})`, 900),
    jungle: buildGroundTexture('#30432b', a => `rgba(${10+a*30|0},${40+a*40|0},${10+a*20|0},${0.1 + a * 0.14})`, 1600),
  };
  Object.values(groundTextures).forEach(t => t.repeat.set(3, 3));

  const groundBlendVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;
  const groundBlendFragmentShader = `
    uniform sampler2D mapA;
    uniform sampler2D mapB;
    uniform float zFrom;
    uniform float zTo;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      float t = smoothstep(zFrom, zTo, vWorldPosition.z);
      vec3 colorA = texture2D(mapA, vUv).rgb;
      vec3 colorB = texture2D(mapB, vUv).rgb;
      gl_FragColor = vec4(mix(colorA, colorB, t), 1.0);
    }
  `;

  for (let i = 0; i < BIOMES.length; i++) {
    const biome = BIOMES[i];
    const next = BIOMES[i + 1];
    const zoneEndDist = next ? next.start : TRACK_LENGTH;
    const pureEndDist = next ? zoneEndDist - TRANSITION_LENGTH : zoneEndDist;

    const pureFromZ = distanceToZ(biome.start);
    const pureToZ = distanceToZ(pureEndDist);

    if (biome.props === 'coastal') {
      // Coastal is asymmetric — city-style ground continues on the right (buildings still sit
      // there), while the left half becomes a sand strip next to the road and open ocean beyond
      // it. Built as three side-by-side strips instead of one full-width plane.
      // Note: for this chase camera (looking down +Z), world +X renders on screen-LEFT and -X on
      // screen-RIGHT — verified empirically, not assumed — so "left"/"right" below are inverted
      // relative to what you'd naively guess from the X sign.
      const halfLen = pureToZ - pureFromZ;
      const midZ = (pureFromZ + pureToZ) / 2;
      // Spans from the far city side all the way to the road's outer edge (+45), not just to x=0 —
      // with the road now 90 units wide, stopping at the centreline would leave the whole right
      // half of the carriageway with no ground under it.
      const cityGroundWidth = GROUND_WIDTH / 2 + 45;
      const rightGround = new THREE.Mesh(
        new THREE.PlaneGeometry(cityGroundWidth, halfLen),
        new THREE.MeshStandardMaterial({ map: groundTextures.city, color: cityBiome.ground.color, roughness: 0.94, metalness: 0.08, envMapIntensity: 0.85 })
      );
      rightGround.rotation.x = -Math.PI / 2;
      rightGround.position.set(-GROUND_WIDTH / 2 + cityGroundWidth / 2, 0, midZ);
      rightGround.receiveShadow = true;
      scene.add(rightGround);

      const BEACH_WIDTH = 62;
      const beachGround = new THREE.Mesh(
        new THREE.PlaneGeometry(BEACH_WIDTH, halfLen),
        new THREE.MeshStandardMaterial({ map: groundTextures.coastal, color: biome.ground.color, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.8 })
      );
      beachGround.rotation.x = -Math.PI / 2;
      beachGround.position.set(45 + BEACH_WIDTH / 2, 0, midZ);
      beachGround.receiveShadow = true;
      scene.add(beachGround);

      const OCEAN_WIDTH = 420;
      const oceanMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColorDeep: { value: new THREE.Color(0x0b4f6c) },
          uColorShallow: { value: new THREE.Color(0x49b6cf) },
          uColorShore: { value: new THREE.Color(0x8fd8d2) },
          uSkyColor: { value: new THREE.Color(biome.sky.top) },
          uSunColor: { value: new THREE.Color(biome.sun.color) },
          // Custom ShaderMaterials get NO fog from three.js automatically — that's why the ocean
          // used to end in a hard line at its far edge while everything else faded out. These are
          // kept in sync with scene.fog each frame from main.js.
          uFogColor: { value: new THREE.Color(biome.fog.color) },
          uFogNear: { value: biome.fog.near },
          uFogFar: { value: biome.fog.far },
        },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          varying float vCrest;
          varying vec3 vWorldPos;
          varying float vViewDepth;

          void main() {
            vUv = uv;
            vec3 pos = position;

            // Several octaves at different speeds/directions instead of two sines, so the
            // surface never settles into an obvious repeating ripple.
            float w =
                sin(pos.x * 0.18 + uTime * 1.30) * 0.16
              + sin(pos.y * 0.11 - uTime * 0.90) * 0.20
              + sin((pos.x * 0.07 + pos.y * 0.09) + uTime * 0.55) * 0.26
              + sin((pos.x * 0.31 - pos.y * 0.23) - uTime * 1.90) * 0.07;
            pos.z += w;

            vWave = w;
            // steeper part of the wave = crest, used for foam/specular streaks
            vCrest = smoothstep(0.18, 0.42, w);

            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            vViewDepth = -mvPos.z;
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColorDeep;
          uniform vec3 uColorShallow;
          uniform vec3 uColorShore;
          uniform vec3 uSkyColor;
          uniform vec3 uSunColor;
          uniform vec3 uFogColor;
          uniform float uFogNear;
          uniform float uFogFar;
          varying vec2 vUv;
          varying float vWave;
          varying float vCrest;
          varying vec3 vWorldPos;
          varying float vViewDepth;

          void main() {
            // vUv.x = 0 at the beach edge, 1 out to sea (see position.set below)
            float shore = 1.0 - smoothstep(0.0, 1.0, vUv.x);

            vec3 base = mix(uColorDeep, uColorShallow, shore);
            base = mix(base, uColorShore, smoothstep(0.75, 1.0, shore)); // shallows go turquoise

            // Foam: a band hugging the waterline, broken up by the wave motion so it advances and
            // retreats instead of sitting as a static stripe, plus flecks on the wave crests.
            float shoreBand = smoothstep(0.90, 1.0, shore);
            float surge = sin(vWorldPos.z * 0.35 + uTime * 1.6) * 0.5 + 0.5;
            float foam = shoreBand * (0.45 + 0.55 * surge);
            foam += vCrest * 0.28 * smoothstep(0.25, 0.9, shore);
            foam = clamp(foam, 0.0, 1.0);

            // Specular glare: a broad highlight where the surface faces the sun, tightened on
            // wave crests so light skips across the chop.
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            vec3 normal = normalize(vec3(-vWave * 0.35, 1.0, -vWave * 0.25));
            float fres = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
            float glare = pow(max(dot(reflect(-viewDir, normal), normalize(vec3(0.45, 0.55, -0.7))), 0.0), 28.0);

            vec3 color = base;
            color = mix(color, uSkyColor, fres * 0.55);          // sky reflection at grazing angles
            color += uSunColor * glare * 1.1;                     // sun glare
            color += uSunColor * max(vWave, 0.0) * 0.10;          // crest sparkle
            color = mix(color, vec3(0.94, 0.97, 0.96), foam);     // foam

            // Manual linear fog, matching THREE.Fog, so the ocean fades into the same haze as the
            // rest of the scene and the horizon has no hard seam.
            float fogFactor = smoothstep(uFogNear, uFogFar, vViewDepth);
            color = mix(color, uFogColor, fogFactor);

            gl_FragColor = vec4(color, 0.94);
          }
        `,
        transparent: true,
      });
      // More segments than before (24x12) so the extra wave octaves actually have vertices to
      // displace instead of being flattened by the tessellation.
      const ocean = new THREE.Mesh(new THREE.PlaneGeometry(OCEAN_WIDTH, halfLen, 80, 40), oceanMat);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(45 + BEACH_WIDTH + OCEAN_WIDTH / 2, -0.15, midZ);
      scene.add(ocean);
      oceanMaterials.push(oceanMat);
    } else {
      const pureGround = new THREE.Mesh(
        new THREE.PlaneGeometry(GROUND_WIDTH, pureToZ - pureFromZ),
        new THREE.MeshStandardMaterial({
          map: groundTextures[biome.props],
          color: biome.ground.color,
          roughness: 0.94,
          metalness: 0.08,
          envMapIntensity: 0.85,
        })
      );
      pureGround.rotation.x = -Math.PI / 2;
      pureGround.position.z = (pureFromZ + pureToZ) / 2;
      pureGround.receiveShadow = true;
      scene.add(pureGround);
    }

    if (next) {
      const blendFromZ = pureToZ;
      const blendToZ = distanceToZ(zoneEndDist);
      const blendGround = new THREE.Mesh(
        new THREE.PlaneGeometry(GROUND_WIDTH, blendToZ - blendFromZ),
        new THREE.ShaderMaterial({
          uniforms: {
            mapA: { value: groundTextures[biome.props] },
            mapB: { value: groundTextures[next.props] },
            zFrom: { value: blendFromZ },
            zTo: { value: blendToZ },
          },
          vertexShader: groundBlendVertexShader,
          fragmentShader: groundBlendFragmentShader,
        })
      );
      blendGround.rotation.x = -Math.PI / 2;
      blendGround.position.z = (blendFromZ + blendToZ) / 2;
      blendGround.receiveShadow = true;
      scene.add(blendGround);
    }
  }

  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 2048;
  const roadCtx = roadCanvas.getContext('2d');
  roadCtx.fillStyle = '#2a2d32';
  roadCtx.fillRect(0, 0, roadCanvas.width, roadCanvas.height);
  for (let y = 0; y < roadCanvas.height; y += 18) {
    roadCtx.fillStyle = y % 36 === 0 ? '#31373d' : '#262b31';
    roadCtx.fillRect(0, y, roadCanvas.width, 18);
  }
  roadCtx.fillStyle = '#d6d7c8';
  for (let y = 24; y < roadCanvas.height; y += 72) {
    roadCtx.fillRect(246, y, 20, 28);
    roadCtx.fillRect(246, y + 36, 20, 28);
  }
  roadCtx.fillStyle = '#e4e0bf';
  roadCtx.fillRect(0, 0, roadCanvas.width, 8);
  roadCtx.fillRect(0, roadCanvas.height - 8, roadCanvas.width, 8);
  const roadTexture = new THREE.CanvasTexture(roadCanvas);
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.ClampToEdgeWrapping;

  const roadMat = new THREE.MeshPhysicalMaterial({
    map: roadTexture,
    color: 0x2a2d32,
    roughness: 0.7,
    metalness: 0.18,
    clearcoat: 0.38,
    clearcoatRoughness: 0.72,
    envMapIntensity: 1.2,
  });

  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x454b52,
    roughness: 0.92,
    metalness: 0.12,
    envMapIntensity: 0.7,
  });

  const trackLeft = new THREE.Mesh(new THREE.BoxGeometry(14, 0.15, TRACK_LENGTH), shoulderMat);
  trackLeft.position.set(-52, 0.08, 0);
  trackLeft.receiveShadow = true;
  scene.add(trackLeft);

  const trackRight = trackLeft.clone();
  trackRight.position.x = 52;
  scene.add(trackRight);

  const road = new THREE.Mesh(new THREE.BoxGeometry(90, 0.2, TRACK_LENGTH), roadMat);
  road.position.y = 0.05;
  road.receiveShadow = true;
  scene.add(road);

  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.04, TRACK_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xf5f0c5, emissive: 0x4f481d, roughness: 0.6, metalness: 0.08 })
  );
  centerLine.position.y = 0.12;
  scene.add(centerLine);

  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xd1d9df, roughness: 0.8, metalness: 0.12 });
  const curbProps = [
    { x: -46.6, z: 0 },
    { x: 46.6, z: 0 },
  ];
  curbProps.forEach(({ x, z }) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, TRACK_LENGTH), curbMaterial);
    curb.position.set(x, 0.18, z);
    curb.receiveShadow = true;
    scene.add(curb);
  });

  // Guardrails run the full track length regardless of biome, so — same reasoning as the
  // buildings — they're one InstancedMesh rather than one Mesh per post.
  const barrierPositions = [];
  for (let z = START_Z + 10; z <= FINISH_Z - 10; z += 12) {
    barrierPositions.push({ z, x: -53.5 }, { z, x: 53.5 });
  }
  const barriers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.7, 0.9, 4.8),
    new THREE.MeshStandardMaterial({ color: 0xf0a34b, roughness: 0.6, metalness: 0.25, emissive: 0x38230f }),
    barrierPositions.length
  );
  barriers.castShadow = true;
  barriers.receiveShadow = true;
  const barrierMatrix = new THREE.Matrix4();
  barrierPositions.forEach(({ x, z }, i) => {
    barrierMatrix.makeTranslation(x, 0.55, z);
    barriers.setMatrixAt(i, barrierMatrix);
  });
  barriers.instanceMatrix.needsUpdate = true;
  scene.add(barriers);

  // Streetlights are a city fixture — they run through the city zone and taper off through its
  // transition into the desert, rather than lining the whole track.
  const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xfff0c2, emissive: 0xffd675, emissiveIntensity: 0.9 });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.8, metalness: 0.4 });
  const coastalBiome = getBiomeByName('coastal');
  const desertBiome = getBiomeByName('desert');
  const jungleBiome = getBiomeByName('jungle');
  const cityZoneEndDist = coastalBiome ? coastalBiome.start : TRACK_LENGTH;
  [-1, 1].forEach(side => {
    for (let d = 10; d <= cityZoneEndDist; d += 18) {
      const z = distanceToZ(d);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.8, 10), poleMaterial);
      pole.position.set(side * 61, 2.9, z);
      pole.castShadow = true;
      scene.add(pole);

      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 18), lightMaterial);
      lamp.position.set(side * 61, 5.5, z);
      lamp.castShadow = true;
      scene.add(lamp);
    }
  });

  // ---- buildings: instanced + two-tier LOD, confined to the city zone (+ its transition) ----
  // Every building shares one geometry/material per tier (one draw call each, however many
  // buildings exist), so detail can grow without a per-building draw-call cost. main.js swaps
  // each instance between the "near" (textured) and "far" (flat, cheap) tier every frame based
  // on distance from the camera.
  // Wider palette than the original 5 — more spread between warm stone, cool glass and concrete
  // so a row of buildings doesn't read as one repeated material.
  const buildingColors = [
    0x8f9aad, 0xbdc5d5, 0x9fa8a1, 0xc5b29a, 0x9ca3b7,
    0xa8917f, 0x7f8899, 0xd0cdc2, 0x8c9bA6, 0xb0a08c,
  ];
  const buildingSpecs = [];
  let blockIndex = 0;
  for (let d = 10; d <= cityZoneEndDist; d += 22) {
    // Per-block height bias so neighboring buildings on the same block feel related in scale,
    // instead of every single building rolling fully independent dice.
    const blockHeightBias = Math.sin(blockIndex * 1.7) * 4;
    blockIndex++;
    const z = distanceToZ(d);
    [-1, 1].forEach(side => {
      const width = 6 + Math.random() * 5;
      const height = Math.max(6, 8 + blockHeightBias + Math.random() * 16);
      const depth = 6 + Math.random() * 6;
      buildingSpecs.push({
        width, height, depth,
        x: side * (71 + Math.random() * 22),
        z: z + (Math.random() - 0.5) * 6,
        colorIndex: Math.floor(Math.random() * buildingColors.length),
      });
    });
  }
  // Coastal zone: buildings continue on the right (away from the beach/ocean on the left) but
  // sparser — wider spacing and an extra chance to skip a slot entirely.
  if (coastalBiome) {
    const coastalBuildingEndDist = desertBiome ? desertBiome.start : TRACK_LENGTH;
    for (let d = cityZoneEndDist; d <= coastalBuildingEndDist; d += 34) {
      if (Math.random() < 0.25) continue;
      const blockHeightBias = Math.sin(blockIndex * 1.7) * 4;
      blockIndex++;
      const z = distanceToZ(d);
      const width = 6 + Math.random() * 5;
      const height = Math.max(6, 7 + blockHeightBias + Math.random() * 13);
      const depth = 6 + Math.random() * 6;
      buildingSpecs.push({
        width, height, depth,
        x: -(71 + Math.random() * 22),
        z: z + (Math.random() - 0.5) * 6,
        colorIndex: Math.floor(Math.random() * buildingColors.length),
      });
    }
  }

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingTextures = buildBuildingTextures();
  const buildingsNear = new THREE.InstancedMesh(
    buildingGeometry,
    new THREE.MeshStandardMaterial({
      map: buildingTextures.map,
      normalMap: buildingTextures.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      emissiveMap: buildingTextures.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 1.1,
      roughness: 0.75,
      metalness: 0.15,
      envMapIntensity: 0.6,
    }),
    buildingSpecs.length
  );
  // Far tier still drops the normal map (per-pixel bump detail is the least visible thing at
  // distance and the most expensive), but keeps the window/emissive map — lit windows must be
  // there from the moment a building exists, not pop in once it crosses the LOD threshold.
  const buildingsFar = new THREE.InstancedMesh(
    buildingGeometry,
    new THREE.MeshStandardMaterial({
      map: buildingTextures.map,
      emissiveMap: buildingTextures.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 1.1,
      roughness: 0.9,
      metalness: 0.1,
      envMapIntensity: 0.5,
    }),
    buildingSpecs.length
  );
  [buildingsNear, buildingsFar].forEach(im => {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // An InstancedMesh caches its bounding sphere the first time it's frustum-tested, but
    // updateBuildingLOD() rewrites every instance matrix each frame (swapping instances between
    // the near/far tier by zero-scaling them). The cached sphere therefore goes stale immediately
    // and can cull a tier that actually has visible instances in it. There are only two of these
    // meshes covering the whole track, so skipping the frustum test entirely is both correct and
    // cheaper than recomputing the sphere every frame.
    im.frustumCulled = false;
    scene.add(im);
  });

  const buildingColorObj = new THREE.Color();
  const buildingMatrix = new THREE.Matrix4();
  buildingSpecs.forEach((spec, i) => {
    buildingMatrix.makeScale(spec.width, spec.height, spec.depth);
    buildingMatrix.setPosition(spec.x, spec.height / 2, spec.z);
    buildingsNear.setMatrixAt(i, buildingMatrix);
    buildingsFar.setMatrixAt(i, buildingMatrix);
    buildingColorObj.set(buildingColors[spec.colorIndex]);
    buildingsNear.setColorAt(i, buildingColorObj);
    buildingsFar.setColorAt(i, buildingColorObj);
  });
  buildingsNear.instanceMatrix.needsUpdate = true;
  buildingsFar.instanceMatrix.needsUpdate = true;
  buildingsNear.instanceColor.needsUpdate = true;
  buildingsFar.instanceColor.needsUpdate = true;

  // ---- roof detail: breaks up the "row of plain boxes" silhouette ----
  // An InstancedMesh shares one geometry, so per-building roof shapes can't come from the
  // building mesh itself. Instead these are two extra instanced meshes layered on top of the
  // existing boxes — still only 2 more draw calls total, regardless of building count.
  const roofUnitSpecs = [];
  const roofCapSpecs = [];
  buildingSpecs.forEach(spec => {
    const roofY = spec.height;
    const style = Math.random();
    if (style < 0.35) {
      // sloped/pyramid cap
      roofCapSpecs.push({ x: spec.x, y: roofY, z: spec.z, w: spec.width * 0.92, d: spec.depth * 0.92, h: 1.2 + Math.random() * 2.2 });
    }
    // rooftop mechanical boxes / AC units on most buildings (including the sloped ones' bases)
    const unitCount = style < 0.35 ? 1 : 1 + Math.floor(Math.random() * 3);
    for (let u = 0; u < unitCount; u++) {
      const uw = 0.8 + Math.random() * 1.6;
      const uh = 0.5 + Math.random() * 1.1;
      const ud = 0.8 + Math.random() * 1.4;
      roofUnitSpecs.push({
        x: spec.x + (Math.random() - 0.5) * (spec.width - uw - 0.6),
        y: roofY + uh / 2,
        z: spec.z + (Math.random() - 0.5) * (spec.depth - ud - 0.6),
        w: uw, h: uh, d: ud,
        rotY: Math.random() * Math.PI * 2,
      });
    }
  });

  const roofUnitMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.85, metalness: 0.3, envMapIntensity: 0.5 });
  const roofUnits = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofUnitMaterial, Math.max(1, roofUnitSpecs.length));
  const roofCapMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7480, roughness: 0.9, metalness: 0.15, envMapIntensity: 0.45 });
  // 4-sided cone = a simple hipped/pyramid roof
  const roofCaps = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1, 4), roofCapMaterial, Math.max(1, roofCapSpecs.length));
  [roofUnits, roofCaps].forEach(im => {
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false; // same reasoning as the buildings: few meshes spanning the whole track
    scene.add(im);
  });

  const roofMatrix = new THREE.Matrix4();
  const roofQuat = new THREE.Quaternion();
  const roofScale = new THREE.Vector3();
  const roofPos = new THREE.Vector3();
  const roofUp = new THREE.Vector3(0, 1, 0);
  roofUnitSpecs.forEach((spec, i) => {
    roofQuat.setFromAxisAngle(roofUp, spec.rotY);
    roofScale.set(spec.w, spec.h, spec.d);
    roofPos.set(spec.x, spec.y, spec.z);
    roofMatrix.compose(roofPos, roofQuat, roofScale);
    roofUnits.setMatrixAt(i, roofMatrix);
  });
  roofCapSpecs.forEach((spec, i) => {
    roofQuat.setFromAxisAngle(roofUp, Math.PI / 4); // align the 4-sided cone with the box below
    roofScale.set(spec.w, spec.h, spec.d);
    roofPos.set(spec.x, spec.y + spec.h / 2, spec.z);
    roofMatrix.compose(roofPos, roofQuat, roofScale);
    roofCaps.setMatrixAt(i, roofMatrix);
  });
  roofUnits.instanceMatrix.needsUpdate = true;
  roofCaps.instanceMatrix.needsUpdate = true;

  // ---- beach props: instanced palm trees + umbrellas, along the sand strip only (the pure ----
  // ---- coastal ground segment — the transitions on either side don't have a beach to put them on)
  if (coastalBiome) {
    const palmTrunk = new THREE.CylinderGeometry(0.14, 0.22, 4.2, 7).translate(0, 2.1, 0);
    palmTrunk.rotateZ(0.12);
    const frondGeoms = [palmTrunk];
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.ConeGeometry(0.22, 2.4, 4).translate(0, 1.2, 0);
      frond.rotateX(1.15); // tip outward/down from vertical
      frond.rotateY((f / 5) * Math.PI * 2);
      frond.translate(0, 4.1, 0);
      frondGeoms.push(frond);
    }
    const palmGeometry = mergeGeometries(frondGeoms);

    const umbrellaPole = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6).translate(0, 1.1, 0);
    const umbrellaCanopy = new THREE.ConeGeometry(1.1, 0.6, 10).translate(0, 2.3, 0);
    const umbrellaGeometry = mergeGeometries([umbrellaPole, umbrellaCanopy]);

    const coastalPropZoneStart = coastalBiome.start;
    const coastalPropZoneEnd = desertBiome ? desertBiome.start - TRANSITION_LENGTH : TRACK_LENGTH;
    const palmSpecs = [];
    const umbrellaSpecs = [];
    for (let d = coastalPropZoneStart; d <= coastalPropZoneEnd; d += 16) {
      const z = distanceToZ(d) + (Math.random() - 0.5) * 6;
      const x = 56 + Math.random() * 40; // within the relocated sand strip, clear of the road shoulder
      if (Math.random() < 0.65) {
        palmSpecs.push({ x, z, scale: 0.8 + Math.random() * 0.5, rotY: Math.random() * Math.PI * 2 });
      } else {
        umbrellaSpecs.push({ x, z, scale: 0.8 + Math.random() * 0.4, rotY: Math.random() * Math.PI * 2 });
      }
    }
    const umbrellaColors = [0xe0524a, 0xf2c94c, 0x4fa8dd, 0xf2f2f2];
    const palms = new THREE.InstancedMesh(
      palmGeometry,
      new THREE.MeshStandardMaterial({ color: 0x4a7d3f, roughness: 0.85, metalness: 0.05 }),
      Math.max(1, palmSpecs.length)
    );
    const umbrellas = new THREE.InstancedMesh(
      umbrellaGeometry,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 }),
      Math.max(1, umbrellaSpecs.length)
    );
    const umbrellaColorObj = new THREE.Color();
    [palms, umbrellas].forEach(im => { im.castShadow = true; im.receiveShadow = true; scene.add(im); });
    const beachPropMatrix = new THREE.Matrix4();
    const beachPropQuat = new THREE.Quaternion();
    const beachPropScale = new THREE.Vector3();
    const beachUpAxis = new THREE.Vector3(0, 1, 0);
    palmSpecs.forEach((spec, i) => {
      beachPropQuat.setFromAxisAngle(beachUpAxis, spec.rotY);
      beachPropScale.set(spec.scale, spec.scale, spec.scale);
      beachPropMatrix.compose(new THREE.Vector3(spec.x, 0, spec.z), beachPropQuat, beachPropScale);
      palms.setMatrixAt(i, beachPropMatrix);
    });
    umbrellaSpecs.forEach((spec, i) => {
      beachPropQuat.setFromAxisAngle(beachUpAxis, spec.rotY);
      beachPropScale.set(spec.scale, spec.scale, spec.scale);
      beachPropMatrix.compose(new THREE.Vector3(spec.x, 0, spec.z), beachPropQuat, beachPropScale);
      umbrellas.setMatrixAt(i, beachPropMatrix);
      umbrellaColorObj.set(umbrellaColors[Math.floor(Math.random() * umbrellaColors.length)]);
      umbrellas.setColorAt(i, umbrellaColorObj);
    });
    palms.instanceMatrix.needsUpdate = true;
    umbrellas.instanceMatrix.needsUpdate = true;
    if (umbrellas.instanceColor) umbrellas.instanceColor.needsUpdate = true;

    // ---- extra beach clutter: rocks, driftwood and grass tufts ----
    // Three more instanced meshes (3 draw calls total) scattered denser than the palms/umbrellas,
    // including a band right along the waterline so the sand-to-sea edge isn't a bare strip.
    const beachRockGeo = new THREE.IcosahedronGeometry(1, 0).translate(0, 0.45, 0);
    const driftwoodGeo = new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 0.2, 0);
    const grassBlades = [];
    for (let b = 0; b < 5; b++) {
      const blade = new THREE.ConeGeometry(0.075, 1.15, 3).translate(0, 0.575, 0);
      blade.rotateZ((Math.random() - 0.5) * 0.7);
      blade.rotateY((b / 5) * Math.PI * 2);
      blade.translate((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
      grassBlades.push(blade);
    }
    const grassTuftGeo = mergeGeometries(grassBlades);

    const rockSpecsBeach = [], driftSpecs = [], grassSpecs = [];
    for (let d = coastalPropZoneStart; d <= coastalPropZoneEnd; d += 5) {
      const z = distanceToZ(d) + (Math.random() - 0.5) * 4;
      const roll = Math.random();
      // bias grass toward the road side, rocks/driftwood toward the waterline
      if (roll < 0.4) {
        grassSpecs.push({ x: 52 + Math.random() * 16, z, scale: 0.7 + Math.random() * 0.8, rotY: Math.random() * Math.PI * 2 });
      } else if (roll < 0.72) {
        rockSpecsBeach.push({ x: 70 + Math.random() * 28, z, scale: 0.35 + Math.random() * 0.75, rotY: Math.random() * Math.PI * 2 });
      } else {
        driftSpecs.push({ x: 78 + Math.random() * 24, z, scale: 0.6 + Math.random() * 0.8, rotY: Math.random() * Math.PI * 2 });
      }
    }

    const beachRocks = new THREE.InstancedMesh(
      beachRockGeo,
      new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.95, metalness: 0.04 }),
      Math.max(1, rockSpecsBeach.length)
    );
    const driftwood = new THREE.InstancedMesh(
      driftwoodGeo,
      new THREE.MeshStandardMaterial({ color: 0xa08c6f, roughness: 0.92, metalness: 0.03 }),
      Math.max(1, driftSpecs.length)
    );
    const beachGrass = new THREE.InstancedMesh(
      grassTuftGeo,
      new THREE.MeshStandardMaterial({ color: 0x9cab63, roughness: 0.9, metalness: 0.02 }),
      Math.max(1, grassSpecs.length)
    );
    [beachRocks, driftwood, beachGrass].forEach(im => {
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
    });
    const writeBeachProps = (specs, mesh, flattenY = 1) => {
      specs.forEach((spec, i) => {
        beachPropQuat.setFromAxisAngle(beachUpAxis, spec.rotY);
        beachPropScale.set(spec.scale, spec.scale * flattenY, spec.scale);
        beachPropMatrix.compose(new THREE.Vector3(spec.x, 0, spec.z), beachPropQuat, beachPropScale);
        mesh.setMatrixAt(i, beachPropMatrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    writeBeachProps(rockSpecsBeach, beachRocks, 0.7); // squashed so rocks sit low in the sand
    writeBeachProps(driftSpecs, driftwood);
    writeBeachProps(grassSpecs, beachGrass);
  }

  // ---- desert props: instanced cacti + rocks, spanning the desert zone and its transitions ----
  const cactusTrunk = new THREE.CylinderGeometry(0.32, 0.42, 3, 8).translate(0, 1.5, 0);
  const cactusArmL = new THREE.CylinderGeometry(0.14, 0.17, 1.1, 6).translate(0, 0.55, 0);
  cactusArmL.rotateZ(0.9); cactusArmL.translate(-0.5, 1.6, 0);
  const cactusArmR = new THREE.CylinderGeometry(0.14, 0.17, 1.1, 6).translate(0, 0.55, 0);
  cactusArmR.rotateZ(-0.9); cactusArmR.translate(0.5, 2.0, 0);
  const cactusGeometry = mergeGeometries([cactusTrunk, cactusArmL, cactusArmR]);
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0).translate(0, 0.55, 0);

  const desertZoneStartDist = desertBiome.start - TRANSITION_LENGTH;
  const desertZoneEndDist = jungleBiome ? jungleBiome.start : TRACK_LENGTH;
  const cactusSpecs = [];
  const rockSpecs = [];
  for (let d = desertZoneStartDist; d <= desertZoneEndDist; d += 14) {
    const z = distanceToZ(d) + (Math.random() - 0.5) * 8;
    [-1, 1].forEach(side => {
      const x = side * (57 + Math.random() * 14);
      if (Math.random() < 0.6) {
        cactusSpecs.push({ x, z, scale: 0.7 + Math.random() * 0.7, rotY: Math.random() * Math.PI * 2 });
      } else {
        rockSpecs.push({ x, z, scale: 0.5 + Math.random() * 1.3, rotY: Math.random() * Math.PI * 2 });
      }
    });
  }
  const cacti = new THREE.InstancedMesh(
    cactusGeometry,
    new THREE.MeshStandardMaterial({ color: 0x5c8a4f, roughness: 0.85, metalness: 0.05 }),
    Math.max(1, cactusSpecs.length)
  );
  const rocks = new THREE.InstancedMesh(
    rockGeometry,
    new THREE.MeshStandardMaterial({ color: 0x8d7a6b, roughness: 0.95, metalness: 0.05 }),
    Math.max(1, rockSpecs.length)
  );
  [cacti, rocks].forEach(im => { im.castShadow = true; im.receiveShadow = true; scene.add(im); });
  const propMatrix = new THREE.Matrix4();
  const propQuat = new THREE.Quaternion();
  const propScaleVec = new THREE.Vector3();
  const propUpAxis = new THREE.Vector3(0, 1, 0);
  cactusSpecs.forEach((spec, i) => {
    propQuat.setFromAxisAngle(propUpAxis, spec.rotY);
    propScaleVec.set(spec.scale, spec.scale, spec.scale);
    propMatrix.compose(new THREE.Vector3(spec.x, 0, spec.z), propQuat, propScaleVec);
    cacti.setMatrixAt(i, propMatrix);
  });
  rockSpecs.forEach((spec, i) => {
    propQuat.setFromAxisAngle(propUpAxis, spec.rotY);
    propScaleVec.set(spec.scale, spec.scale * 0.7, spec.scale);
    propMatrix.compose(new THREE.Vector3(spec.x, 0, spec.z), propQuat, propScaleVec);
    rocks.setMatrixAt(i, propMatrix);
  });
  cacti.instanceMatrix.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = true;

  // ---- jungle trees: instanced, denser than the old city street-trees ----
  const jungleTrunk = new THREE.CylinderGeometry(0.2, 0.26, 2.2, 8).translate(0, 1.1, 0);
  const jungleCrown = new THREE.ConeGeometry(1.5, 3.2, 10).translate(0, 2.2 + 1.6, 0);
  const jungleTreeGeometry = mergeGeometries([jungleTrunk, jungleCrown]);
  const jungleZoneStartDist = jungleBiome.start - TRANSITION_LENGTH;
  const jungleTreeSpecs = [];
  for (let d = jungleZoneStartDist; d <= TRACK_LENGTH; d += 9) {
    const z = distanceToZ(d) + (Math.random() - 0.5) * 5;
    [-1, 1].forEach(side => {
      const x = side * (24 + Math.random() * 20);
      jungleTreeSpecs.push({ x, z, scale: 0.8 + Math.random() * 0.6, rotY: Math.random() * Math.PI * 2 });
    });
  }
  const jungleTrees = new THREE.InstancedMesh(
    jungleTreeGeometry,
    new THREE.MeshStandardMaterial({ color: 0x3f6b3f, roughness: 0.9, metalness: 0.05 }),
    Math.max(1, jungleTreeSpecs.length)
  );
  jungleTrees.castShadow = true;
  jungleTrees.receiveShadow = true;
  scene.add(jungleTrees);
  jungleTreeSpecs.forEach((spec, i) => {
    propQuat.setFromAxisAngle(propUpAxis, spec.rotY);
    propScaleVec.set(spec.scale, spec.scale, spec.scale);
    propMatrix.compose(new THREE.Vector3(spec.x, 0, spec.z), propQuat, propScaleVec);
    jungleTrees.setMatrixAt(i, propMatrix);
  });
  jungleTrees.instanceMatrix.needsUpdate = true;

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(15, 3.6, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.35, roughness: 0.5, emissive: 0x1d4ed8, emissiveIntensity: 0.2 })
  );
  // Sits well down the track, not on the start line. The chase camera spawns ~3.5 units BEHIND
  // the car's start position (car z = START_Z + 15, camera trails by 8.5), and this banner is a
  // 15-wide near-black box — parked at START_Z it landed directly in front of the camera, inside
  // its vertical span, filling the entire frame until the player drove out from behind it.
  // Raised as well so it reads as an overhead gantry the car passes under.
  banner.position.set(0, 8.6, START_Z + 70);
  scene.add(banner);

  const finishLine = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 1.7, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xe7ecf4, emissive: 0x2d6ae8, emissiveIntensity: 0.2, roughness: 0.38, metalness: 0.22 })
  );
  finishLine.position.set(0, 1.05, FINISH_Z);
  finishLine.castShadow = true;
  scene.add(finishLine);

  const startLine = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 1.7, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xf5f0db, emissive: 0xa57a26, emissiveIntensity: 0.18, roughness: 0.55, metalness: 0.14 })
  );
  startLine.position.set(0, 1.05, START_Z + 35); // ahead of the grid, so the car launches across it
  startLine.castShadow = true;
  scene.add(startLine);

  // Sky sphere + sun disc are re-centered on the camera every frame (see main.js) so they
  // always surround the player no matter where they are on a track now 1400m long — and their
  // color uniforms are lerped live between biomes as the player drives through a transition.
  const skyGlow = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false, // a skybox must never occlude scene geometry beyond its own radius
      uniforms: {
        topColor: { value: new THREE.Color(cityBiome.sky.top) },
        bottomColor: { value: new THREE.Color(cityBiome.sky.bottom) },
        exponent: { value: 2.8 }
      },
      // The gradient is computed from the sphere's LOCAL position, not its world position.
      // The sky sphere follows the camera, and the camera can be ~850 units from the world
      // origin — using world position there makes normalize() dominated by that offset and the
      // gradient collapses (which is what made the sky render as a flat dark slab at the start
      // of the track). Local position on a sphere centered at its own origin is exactly the
      // vertical direction, independent of where the sphere sits in the world.
      vertexShader: `
        varying vec3 vLocalPosition;
        void main() {
          vLocalPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float exponent;
        varying vec3 vLocalPosition;
        void main() {
          float h = normalize(vLocalPosition).y;
          float mixAmount = smoothstep(0.0, 1.0, max(h, 0.0));
          vec3 color = mix(bottomColor, topColor, pow(mixAmount, exponent));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
  );
  skyGlow.renderOrder = -1; // drawn first, so it never sorts in front of scene geometry
  scene.add(skyGlow);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2c98a, transparent: true, opacity: 0.55 })
  );
  sunDisc.position.set(48, 42, START_Z - 30);
  scene.add(sunDisc);

  return {
    scene, camera, renderer, sun, ambient, fill, finishLine, startLine, sunDisc, skyGlow,
    buildingsNear, buildingsFar, buildingSpecs, oceanMaterials,
  };
}
