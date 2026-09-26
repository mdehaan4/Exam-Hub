import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { createScene } from './scene.js?v=22';
import { InputHandler } from './input.js';
import { Car } from './car.js?v=22';
import { updateCarPhysics, UNITS_TO_MPH, MAX_SPEED } from './physics.js?v=14';
import { START_Z, FINISH_Z, TRACK_LENGTH, DRIVABLE_HALF_WIDTH, sampleBiome, lerpBiomeColor } from './biomes.js?v=13';
import { pickNextQuestion } from './quiz.js';
import { ANSWER_COLORS, answerColorForSlot, hexToCssColor } from './answerColors.js?v=4';

const { scene, camera, renderer, sun, ambient, skyGlow, sunDisc, buildingsNear, buildingsFar, buildingSpecs, oceanMaterials, startLights } = createScene();
const input = new InputHandler();
const car = new Car();
const hudSpeedEl = document.getElementById('hud-speed');
const hudTimeEl = document.getElementById('hud-time');
const raceOverlayEl = document.getElementById('race-overlay');
const raceMessageEl = document.getElementById('race-message');
const restartButtonEl = document.getElementById('restart-button');
const questionHudEl = document.getElementById('question-hud');
const questionTextEl = document.getElementById('question-text');
const questionAnswersEl = document.getElementById('question-answers');

const mount = document.getElementById('racing-root') || document.body;
mount.appendChild(renderer.domElement);
scene.add(car);

const traffic = [];
for (let i = 0; i < 5; i++) {
  const racer = new Car({ paintColor: i % 3 === 0 ? 0x4cc9f0 : i % 3 === 1 ? 0xf72585 : 0xf4d35e });
  racer.scale.setScalar(0.82);
  racer.position.set(i % 2 === 0 ? -7 : 7, 0.22, START_Z + 90 + i * 180);
  racer.rotation.y = Math.PI;
  racer.userData = {
    lane: i % 2 === 0 ? -7 : 7,
    speed: 8 + i * 2.4,
    drift: 0,
  };
  scene.add(racer);
  traffic.push(racer);
}

// ---- question zones: a gate of colored, drive-through boxes — one per answer — spawned ahead
// of the car. Driving through one answers the question; letting the car pass the gate without
// hitting any box "expires" it. Either way the HUD panel clears/fades and the next question's
// zone spawns further down the track. Declared up here (not next to the functions that use it,
// further down) because resetRace() — called at module load — needs it already initialized.
// Answers are solid 3D extruded letters (THREE.TextGeometry) standing on the road — no box, no
// flat texture panel. Color is assigned per SLOT (position in the answers array) from the shared
// ANSWER_COLORS palette — see answerColors.js for why that's safe (quiz.js shuffles which answer
// lands in which slot, so the color itself never correlates with correctness).
// Sized against measured scene objects (1 unit ≈ 1 m): car 2.07 tall; buildings 6.0–27.1 tall,
// median 13.7, the smallest clamped to 6.0 in scene.js; trees and streetlights ~5.4–6.0. An
// answer is capped at TEXT_MAX_HEIGHT = the smallest building, so it reads as a house-sized
// object on the road. buildAnswerTextGroup() shrinks the font until the layout fits BOTH the
// height and width budgets. helvetiker_bold: cap height ≈ 1.04 × size, with descenders ≈ 1.32 ×
// size, width ≈ 0.70 × size per character.
const TEXT_FONT_SIZE = 3.2; // starting size: a short one-line answer stands ~3.3 tall (caps), ~1.6× the car
const TEXT_MIN_FONT_SIZE = 1.3; // floor so the longest bank answer (84 chars) still fits in 3 lines
const TEXT_MAX_HEIGHT = 6.0;
const TEXT_LINE_SPACING = 1.3; // × font size
const TEXT_GLYPH_HEIGHT = 1.32; // × font size, one line including descenders
const TEXT_EXTRUDE_DEPTH = 1.0;
const TEXT_MAX_LINE_WIDTH = 28; // also sets the lane spread in spawnQuestionZone()
const TEXT_MAX_LINES = 3;

// Every race asks exactly QUESTIONS_PER_RACE questions. Each question's answers occupy a fixed
// slot on the track, spaced evenly from FIRST_ANSWER_DISTANCE to the last slot that still fits
// before the finish, so the count doesn't depend on how fast the player answers.
const QUESTIONS_PER_RACE = 5;
const FIRST_ANSWER_DISTANCE = 435; // from the start line: a run-up to reach speed before the first answers
const QUESTION_SPAWN_LEAD = 200; // a question (and its answers) appears when the car is this far before its slot
const QUESTION_ZONE_DEPTH = 3; // used for the "did the car pass without answering" check, not letter thickness
const QUESTION_TRIGGER_PADDING = { x: 0.8, y: 1.0, z: 2.4 }; // padding around the text's own bounds for reliable triggering
const STAGGER_GAP_MIN = 55; // minimum extra forward distance between consecutive answers
const STAGGER_GAP_JITTER = 35; // 0..this much additional random distance on top of the minimum
const FINISH_CLEARANCE = 40; // the farthest answer of a question must sit at least this far before FINISH_Z
const MAX_ANSWERS = 4; // largest answer count in the question bank
const MAX_ANSWER_SPAN = (MAX_ANSWERS - 1) * (STAGGER_GAP_MIN + STAGGER_GAP_JITTER);
const QUESTION_SLOT_SPACING =
  (TRACK_LENGTH - FINISH_CLEARANCE - MAX_ANSWER_SPAN - FIRST_ANSWER_DISTANCE) / (QUESTIONS_PER_RACE - 1);

// World Z of the nearest answer of question `index` (0-based).
function questionSlotZ(index) {
  return START_Z + FIRST_ANSWER_DISTANCE + index * QUESTION_SLOT_SPACING;
}

function shuffleIndices(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const questionZone = { answers: [], zoneZ: null, resolved: true, spawnedCount: 0 };

// Font: three.js's stock "helvetiker" in its bold cut, served from the same CDN as three itself
// (three@0.160.0/examples/fonts/helvetiker_bold.typeface.json) — a JSON glyph-outline font,
// which is the format FontLoader/TextGeometry require (not a regular .ttf/.woff).
const ANSWER_FONT_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json';
let answerFont = null;
const answerFontReady = new Promise((resolve, reject) => {
  new FontLoader().load(ANSWER_FONT_URL, (font) => { answerFont = font; resolve(font); }, undefined, reject);
});

const boosts = [];
const boostColors = [0x7dd3fc, 0xfacc15, 0x34d399];
for (let i = 0; i < 4; i++) {
  const boost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: boostColors[i % boostColors.length], emissive: boostColors[i % boostColors.length], emissiveIntensity: 0.8 })
  );
  boost.rotation.z = Math.PI / 2;
  boost.position.set(i % 2 === 0 ? -6 : 6, 1.2, START_Z + 120 + i * (TRACK_LENGTH / 4));
  boost.userData = { active: true, phase: i };
  scene.add(boost);
  boosts.push(boost);
}

const POST_FX_ENABLED = new URLSearchParams(window.location.search).get('nofx') !== '1';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.45, 0.85);
bloomPass.threshold = 0.82;
bloomPass.strength = 0.18;
bloomPass.radius = 0.26;
composer.addPass(bloomPass);

// SSAOPass removed deliberately. Its minDistance/maxDistance (0.005/0.12) are normalized against
// the camera's near/far range, which is 0.1..500 here — badly mistuned for a scene this deep. It
// also sat AFTER the bloom pass, re-rendering scene depth and compositing over an already-bloomed
// image, so its output depended on depth-buffer precision and render resolution. That's the most
// likely reason distant geometry rendered black on a real GPU at devicePixelRatio 2 while staying
// fine on the software renderer used for testing (the nearby car, at shallow depth, stayed lit).

const vignettePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.26 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 centered = vUv - 0.5;
      float vignette = smoothstep(1.2, 0.35, length(centered));
      color.rgb *= mix(1.0, vignette, uStrength);
      gl_FragColor = color;
    }
  `,
});
composer.addPass(vignettePass);

const aberrationPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.2 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;
      vec2 chroma = vec2(0.006, -0.004) * (1.0 + length(centered) * 2.0) * uStrength;
      float pulse = sin((vUv.y * 18.0) + uTime * 2.6) * 0.5 + 0.5;
      vec4 r = texture2D(tDiffuse, vUv + chroma * vec2(1.2, 0.35) * (0.75 + pulse * 0.5));
      vec4 g = texture2D(tDiffuse, vUv);
      vec4 b = texture2D(tDiffuse, vUv - chroma * vec2(1.2, 0.35) * (0.75 + pulse * 0.5));
      vec3 finalColor = vec3(r.r, g.g, b.b);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
});
composer.addPass(aberrationPass);

const chaseTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, 4.6, 8.5);
const cameraShake = { x: 0, y: 0 };

function updateCamera(delta, speedFactor, drift) {
  const speedNormalized = Math.min(Math.abs(car.speed) / 42, 1);
  const targetFov = THREE.MathUtils.lerp(58, 86, speedNormalized);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
  camera.updateProjectionMatrix();

  const targetPos = car.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const desired = targetPos.clone().add(
    new THREE.Vector3(
      Math.sin(car.heading) * -cameraOffset.z,
      cameraOffset.y + Math.abs(car.speed) * 0.03,
      Math.cos(car.heading) * -cameraOffset.z
    )
  );

  const shakeStrength = speedNormalized * 0.14 + Math.abs(drift) * 0.015;
  cameraShake.x = Math.sin(performance.now() * 0.04) * shakeStrength;
  cameraShake.y = Math.cos(performance.now() * 0.05) * shakeStrength * 0.5;
  desired.x += cameraShake.x;
  desired.y += cameraShake.y;

  camera.position.lerp(desired, 1 - Math.pow(0.0005, delta));
  chaseTarget.copy(targetPos);
  camera.lookAt(chaseTarget);

  aberrationPass.uniforms.uStrength.value = 0.04 + speedNormalized * 0.12;
  aberrationPass.uniforms.uTime.value += delta;
}

const raceState = {
  finished: false,
  progress: 0,
  running: false,
  countdown: 3,
  countdownTimer: 0,
  currentQuestion: null,
  prizeMoney: 0, // pounds, plain number; formatted only on the results screen
  correctCount: 0,
  questionCount: 0, // questions actually shown this race
  // Race timer, in performance.now() ms: set at GO, frozen at the finish line. Wall-clock rather
  // than summed frame deltas, since delta is a fixed 1/60 and would drift on non-60Hz displays.
  timerStart: null,
  timerEnd: null,
};

function raceElapsedMs() {
  if (raceState.timerStart === null) return 0;
  return (raceState.timerEnd ?? performance.now()) - raceState.timerStart;
}

function formatRaceTime(ms) {
  const totalMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

const PRIZE_PER_CORRECT = 20000;
const prizeFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const raceResultsEl = document.getElementById('race-results');

function showRaceResults() {
  const { correctCount, questionCount, prizeMoney } = raceState;
  const scorePercent = questionCount ? Math.round((correctCount / questionCount) * 100) : 0;
  document.getElementById('result-correct').textContent = String(correctCount);
  document.getElementById('result-total').textContent = String(questionCount);
  document.getElementById('result-score').textContent = `${scorePercent}%`;
  document.getElementById('result-time').textContent = formatRaceTime(raceElapsedMs());
  document.getElementById('result-amount').textContent = `Amount Won: ${prizeFormat.format(prizeMoney)}`;
  raceResultsEl.hidden = false;
}

function resetRace() {
  raceState.prizeMoney = 0;
  raceState.correctCount = 0;
  raceState.questionCount = 0;
  raceResultsEl.hidden = true;
  raceState.finished = false;
  raceState.running = false;
  raceState.countdown = 3;
  raceState.countdownTimer = 0;
  raceState.timerStart = null;
  raceState.timerEnd = null;
  raceOverlayEl.classList.remove('hidden');
  raceMessageEl.textContent = '3';
  restartButtonEl.hidden = true;
  // +15 rather than +5: the chase camera trails 8.5 units behind, so a +5 spawn put the camera at
  // START_Z - 3.5 — before the road/ground geometry even begins (both start exactly at START_Z).
  car.position.set(0, 0.22, START_Z + 15);
  car.speed = 0;
  car.heading = 0;
  car.rotation.set(0, 0, 0);
  traffic.forEach((racer, index) => {
    racer.position.set(index % 2 === 0 ? -7 : 7, 0.22, START_Z + 90 + index * 180);
    racer.userData.speed = 8 + index * 2.4;
  });
  boosts.forEach((boost, idx) => {
    boost.userData.active = true;
    boost.visible = true;
    boost.position.set(idx % 2 === 0 ? -6 : 6, 1.2, START_Z + 120 + idx * (TRACK_LENGTH / 4));
  });
  questionZone.spawnedCount = 0;
  spawnQuestionZone(); // the first question shows during the countdown, answers at its fixed slot
}

// resetRace() (and therefore the first spawnQuestionZone()) must not run until the font has
// loaded — otherwise the very first question's answers would either crash (answerFont is null)
// or silently fail to appear. The render loop itself is also gated on this, so nothing (not even
// the countdown) starts ticking before the font is ready — the alternative would let the 3-2-1
// countdown reach GO before spawnQuestionZone() has ever run if the font load were ever slow.
restartButtonEl.addEventListener('click', () => { if (answerFont) resetRace(); });
answerFontReady
  .then(() => {
    resetRace();
    renderer.setAnimationLoop(animate);
  })
  .catch(err => console.error('Failed to load the answer-text font:', err));

function updateTraffic(delta) {
  traffic.forEach((racer, index) => {
    racer.position.z += racer.userData.speed * delta;
    racer.updateWheels(-racer.userData.speed * delta); // modelled facing -Z while moving +Z
    if (racer.position.z > FINISH_Z) {
      racer.position.z = START_Z;
      racer.position.x = racer.userData.lane;
    }
    racer.position.x += Math.sin((performance.now() * 0.0015) + index) * 0.015;
    racer.rotation.y = Math.PI;
  });
}

function updateBoosts(delta) {
  boosts.forEach((boost, index) => {
    if (!boost.userData.active) return;
    boost.rotation.x += delta * 2.5;
    boost.position.y = 1.2 + Math.sin((performance.now() * 0.004) + index) * 0.45;
    const d = boost.position.distanceTo(car.position);
    if (d < 3) {
      boost.userData.active = false;
      boost.visible = false;
      car.speed = Math.min(car.maxSpeed, MAX_SPEED, car.speed + 12);
    }
  });
}

// ---- hint mode (H key / HINT button), matching the arcade games' toggle. Answer colors mean
// "slot", not "correct", so the hint highlights instead of recoloring: an outlined chip in the
// answer list, plus a bobbing marker above the correct 3D answer, which also pulses.
const hintButtonEl = document.getElementById('hint-button');
let hintOn = false;
const hintMarker = new THREE.Mesh(
  new THREE.ConeGeometry(1.1, 2.4, 4).rotateX(Math.PI),
  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, fog: false })
);
hintMarker.visible = false;
scene.add(hintMarker);

function applyHintToHud() {
  const correctIndex = raceState.currentQuestion ? raceState.currentQuestion.correctIndex : -1;
  Array.from(questionAnswersEl.children).forEach((chip, i) => {
    chip.classList.toggle('hinted', hintOn && i === correctIndex);
  });
}

function setHint(on) {
  hintOn = on;
  hintButtonEl.textContent = 'HINT: ' + (on ? 'ON' : 'OFF');
  applyHintToHud();
}

hintButtonEl.addEventListener('click', () => { setHint(!hintOn); hintButtonEl.blur(); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.repeat) setHint(!hintOn); });

function updateHintVisuals(now) {
  const correctIndex = raceState.currentQuestion ? raceState.currentQuestion.correctIndex : -1;
  const target = hintOn && !questionZone.resolved
    ? questionZone.answers.find(entry => entry.answerIndex === correctIndex)
    : null;
  questionZone.answers.forEach(entry => {
    entry.group.scale.setScalar(entry === target ? 1 + 0.08 * Math.sin(now * 0.006) : 1);
  });
  hintMarker.visible = !!target;
  if (target) {
    hintMarker.position.set(target.group.position.x, target.topY + 2.2 + Math.sin(now * 0.005) * 0.5, target.group.position.z);
    hintMarker.rotation.y = now * 0.002;
  }
}

function clearQuestionZone() {
  hintMarker.visible = false;
  questionZone.answers.forEach(entry => {
    scene.remove(entry.group);
    entry.group.children.forEach(mesh => mesh.geometry.dispose());
  });
  questionZone.answers = [];
  questionZone.zoneZ = null;
  questionZone.resolved = true;
  questionHudEl.classList.remove('visible');
}

function showQuestionHud(question) {
  questionTextEl.textContent = question.text;
  questionAnswersEl.innerHTML = '';
  // Colored swatch + number, same slot->color mapping the 3D road text uses (answerColors.js) —
  // the color reflects the answer's SLOT (its shuffled position), not its identity or
  // correctness, so this can never fall out of sync with the road text for the same question.
  question.answers.forEach((answerText, i) => {
    const { hex } = answerColorForSlot(i);
    const chip = document.createElement('div');
    chip.className = 'answer-chip';
    const swatch = document.createElement('span');
    swatch.className = 'answer-swatch';
    swatch.style.background = hexToCssColor(hex);
    const number = document.createElement('span');
    number.className = 'answer-number';
    number.style.color = hexToCssColor(hex);
    number.textContent = `${i + 1}.`;
    const label = document.createElement('span');
    label.className = 'answer-label';
    label.textContent = answerText;
    chip.append(swatch, number, label);
    questionAnswersEl.appendChild(chip);
    chip.classList.toggle('hinted', hintOn && i === question.correctIndex);
    console.log(`[COLORS] 2-UI answer #${i + 1} "${answerText}": wanted ${hexToCssColor(hex)} | number inline="${number.style.color}" computed="${getComputedStyle(number).color}" | swatch computed="${getComputedStyle(swatch).backgroundColor}"`);
  });
  questionHudEl.classList.add('visible');
}

// One material per palette slot, built once and reused — the color->material mapping is fixed
// and small (six entries), so there's no need to allocate a new material per spawned answer.
const answerTextMaterials = ANSWER_COLORS.map(({ hex }) => new THREE.MeshStandardMaterial({
  color: hex, emissive: hex, emissiveIntensity: 0.75,
  roughness: 0.3, metalness: 0.4,
  // Answers spawn 140+ ahead but city fog is opaque by 180; at house size, fogged text would
  // stay unreadable until close, so it's exempt.
  fog: false,
}));
answerTextMaterials.forEach((m, i) => console.log(`[COLORS] 0-MATERIAL ${i} (${ANSWER_COLORS[i].name}) created: color #${m.color.getHexString()} emissive #${m.emissive.getHexString()}`));

// Builds one answer as a THREE.Group of solid extruded-letter TextGeometry meshes (word-wrapped
// across up to TEXT_MAX_LINES lines, shrinking font size only if it still doesn't fit — plain
// exam answers can be long sentences, and TextGeometry has no built-in wrapping of its own).
// Returns the group plus its natural (unrotated) local bounds, used to build the collision box.
function measureWidth(str, size) {
  const probe = new TextGeometry(str, { font: answerFont, size, height: TEXT_EXTRUDE_DEPTH, curveSegments: 3 });
  probe.computeBoundingBox();
  const width = probe.boundingBox.max.x - probe.boundingBox.min.x;
  probe.dispose();
  return width;
}

function buildAnswerTextGroup(text, slotIndex) {
  const material = answerTextMaterials[slotIndex % answerTextMaterials.length];
  console.log(`[COLORS] 3-3D-PICK answer #${slotIndex + 1} "${text}": material ${slotIndex % answerTextMaterials.length} color #${material.color.getHexString()}`);
  let size = TEXT_FONT_SIZE;
  let lines = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    lines = [];
    let line = '';
    let widestLine = 0;
    for (const word of text.split(' ')) {
      const candidate = line ? line + ' ' + word : word;
      const width = measureWidth(candidate, size);
      if (line && width > TEXT_MAX_LINE_WIDTH) {
        widestLine = Math.max(widestLine, measureWidth(line, size));
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) { widestLine = Math.max(widestLine, measureWidth(line, size)); lines.push(line); }
    // Both conditions matter: a single very long word (e.g. "Developer" on its own, no second
    // word to trigger the wrap check above) never gets caught by the wrap loop itself — it has
    // to be checked here, against the widest actual line, not just the line count.
    const layoutHeight = ((lines.length - 1) * TEXT_LINE_SPACING + TEXT_GLYPH_HEIGHT) * size;
    if (lines.length <= TEXT_MAX_LINES && widestLine <= TEXT_MAX_LINE_WIDTH && layoutHeight <= TEXT_MAX_HEIGHT) break;
    // Multiplicative, not a fixed -0.25 step: the step has to scale with the font size or the
    // loop can't converge from a large starting size (at 13, ten fixed steps only reach 10.5,
    // leaving lines well over budget — measured at 70 units against a 55 budget).
    size = Math.max(TEXT_MIN_FONT_SIZE, size * 0.88);
  }

  const group = new THREE.Group();
  const lineHeight = size * TEXT_LINE_SPACING;
  const totalHeight = lineHeight * lines.length;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  lines.forEach((line, i) => {
    const geometry = new TextGeometry(line, {
      font: answerFont, size, height: TEXT_EXTRUDE_DEPTH, curveSegments: 6,
      bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 3,
    });
    geometry.computeBoundingBox();
    geometry.center(); // centers this line horizontally (and in Z) around local (0, *, 0)
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = totalHeight / 2 - i * lineHeight - lineHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const bb = geometry.boundingBox;
    minX = Math.min(minX, bb.min.x); maxX = Math.max(maxX, bb.max.x);
    minY = Math.min(minY, mesh.position.y + bb.min.y); maxY = Math.max(maxY, mesh.position.y + bb.max.y);
  });

  return { group, localBounds: { minX, maxX, minY, maxY, minZ: -TEXT_EXTRUDE_DEPTH / 2, maxZ: TEXT_EXTRUDE_DEPTH / 2 } };
}

function spawnQuestionZone() {
  clearQuestionZone();

  const question = pickNextQuestion();
  raceState.currentQuestion = question;
  if (!question) { questionHudEl.classList.remove('visible'); questionZone.resolved = true; return; }

  const baseZ = questionSlotZ(questionZone.spawnedCount);
  questionZone.spawnedCount += 1;
  const count = question.answers.length;
  // Outer lane centers sit half a max-width answer inside the car's steering limit, so even the
  // widest answer stays fully on the drivable road on both sides.
  const laneSpread = DRIVABLE_HALF_WIDTH - TEXT_MAX_LINE_WIDTH / 2;
  // Lane positions: answer 0 (of the lane list, NOT the answer list — see the shuffle below)
  // lands leftmost on screen. For this chase camera, world +X renders on screen-LEFT (verified
  // empirically, not assumed — see the coastal biome work), so lane 0 gets the most-positive X.
  const laneX = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    return laneSpread - t * (laneSpread * 2);
  });
  // Forward stagger: a strictly increasing sequence of distances built from randomized gaps, so
  // answers are strung out along the road instead of all sitting at the same Z.
  const distances = [];
  let cumulative = 0;
  for (let i = 0; i < count; i++) {
    if (i > 0) cumulative += STAGGER_GAP_MIN + Math.random() * STAGGER_GAP_JITTER;
    distances.push(cumulative);
  }

  showQuestionHud(question);
  raceState.questionCount += 1;

  // Two independent shuffles decide which answer gets which lane and which answer gets which
  // forward slot — neither is tied to answer order, so the correct answer isn't reliably the
  // closest, the furthest, or in any particular lane from one question to the next.
  const laneOrder = shuffleIndices(count);
  const distanceOrder = shuffleIndices(count);

  let maxAnswerZ = baseZ;
  questionZone.answers = question.answers.map((answerText, i) => {
    const x = laneX[laneOrder[i]];
    const z = baseZ + distances[distanceOrder[i]];
    maxAnswerZ = Math.max(maxAnswerZ, z);

    const { group, localBounds } = buildAnswerTextGroup(answerText, i);
    // Ground clearance: lines stack symmetrically around the group's local y=0 (see
    // buildAnswerTextGroup), so for multi-line answers the lower line(s) sit at negative local
    // y — position the group so the LOWEST point of the actual text sits just above the road,
    // instead of a fixed height that only works for a single line.
    const groundClearance = 0.35;
    group.position.set(x, groundClearance - localBounds.minY, z);
    scene.add(group);
    const meshColors = [...new Set(group.children.map(c => c.material ? '#' + c.material.color.getHexString() : 'no-material'))];
    const { hex: expectedHex } = answerColorForSlot(i);
    console.log(`[COLORS] 4-3D-APPLIED answer #${i + 1} "${answerText}": expected ${hexToCssColor(expectedHex)} | ${group.children.length} mesh(es) in scene with color(s) ${meshColors.join(', ')}`);

    const pad = QUESTION_TRIGGER_PADDING;
    const collisionBox = new THREE.Box3(
      new THREE.Vector3(x + localBounds.minX - pad.x, group.position.y + localBounds.minY - pad.y, z + localBounds.minZ - pad.z),
      new THREE.Vector3(x + localBounds.maxX + pad.x, group.position.y + localBounds.maxY + pad.y, z + localBounds.maxZ + pad.z)
    );

    return { group, collisionBox, answerIndex: i, topY: group.position.y + localBounds.maxY };
  });
  // Expiry uses the FARTHEST answer's Z, not the base lookahead — the car has to pass every
  // possible answer position before the question counts as missed, not just the first one.
  questionZone.zoneZ = maxAnswerZ;
  questionZone.resolved = false;
}

// Resolving a question (hit or missed) clears the road; the next one waits for its own slot.
function resolveQuestionZone() {
  clearQuestionZone();
}

function updateQuestionZone() {
  if (questionZone.resolved) {
    const next = questionZone.spawnedCount;
    if (next < QUESTIONS_PER_RACE && car.position.z >= questionSlotZ(next) - QUESTION_SPAWN_LEAD) spawnQuestionZone();
    return;
  }

  for (const entry of questionZone.answers) {
    // True billboarding so the letters read head-on as the car approaches, not edge-on.
    // (Verified visually: an earlier version added an extra rotateY(Math.PI) here on the theory
    // that TextGeometry's readable face is +Z, but that actually mirrored the text — lookAt()
    // alone produces correctly-readable letters.)
    entry.group.lookAt(camera.position);

    if (entry.collisionBox.containsPoint(car.position)) {
      const correct = entry.answerIndex === raceState.currentQuestion.correctIndex;
      if (correct) {
        raceState.correctCount += 1;
        raceState.prizeMoney += PRIZE_PER_CORRECT;
      }
      resolveQuestionZone();
      return;
    }
  }

  if (car.position.z > questionZone.zoneZ + QUESTION_ZONE_DEPTH + 2) {
    resolveQuestionZone();
  }
}

function updateCollisions() {
  traffic.forEach((racer) => {
    const d = racer.position.distanceTo(car.position);
    if (d < 3.5) {
      const push = car.position.clone().sub(racer.position).normalize();
      car.position.add(push.multiplyScalar(0.95));
      car.speed *= 0.6;
    }
  });
}

const BUILDING_LOD_DISTANCE = 70;
const buildingHiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const buildingRealMatrix = new THREE.Matrix4();
function updateBuildingLOD() {
  buildingSpecs.forEach((spec, i) => {
    const dx = spec.x - camera.position.x;
    const dz = spec.z - camera.position.z;
    const near = (dx * dx + dz * dz) < BUILDING_LOD_DISTANCE * BUILDING_LOD_DISTANCE;
    buildingRealMatrix.makeScale(spec.width, spec.height, spec.depth);
    buildingRealMatrix.setPosition(spec.x, spec.height / 2, spec.z);
    buildingsNear.setMatrixAt(i, near ? buildingRealMatrix : buildingHiddenMatrix);
    buildingsFar.setMatrixAt(i, near ? buildingHiddenMatrix : buildingRealMatrix);
  });
  buildingsNear.instanceMatrix.needsUpdate = true;
  buildingsFar.instanceMatrix.needsUpdate = true;
}

// Sky sphere + sun disc follow the camera every frame (a 1400m track is far bigger than the
// fixed-radius sky sphere, so it has to stay centered on the player, not the world origin).
const skyFollowOffset = new THREE.Vector3();
const sunDiscOffset = new THREE.Vector3(48, 38, -100);
function updateBiome() {
  skyGlow.position.copy(camera.position);
  sunDisc.position.copy(camera.position).add(sunDiscOffset);

  const distance = THREE.MathUtils.clamp(car.position.z - START_Z, 0, TRACK_LENGTH);
  const { biomeA, biomeB, t } = sampleBiome(distance);

  const skyTop = lerpBiomeColor(biomeA.sky.top, biomeB.sky.top, t);
  const skyBottom = lerpBiomeColor(biomeA.sky.bottom, biomeB.sky.bottom, t);
  skyGlow.material.uniforms.topColor.value.copy(skyTop);
  skyGlow.material.uniforms.bottomColor.value.copy(skyBottom);
  scene.background.copy(skyTop);

  scene.fog.color.copy(lerpBiomeColor(biomeA.fog.color, biomeB.fog.color, t));
  scene.fog.near = THREE.MathUtils.lerp(biomeA.fog.near, biomeB.fog.near, t);
  scene.fog.far = THREE.MathUtils.lerp(biomeA.fog.far, biomeB.fog.far, t);

  sun.color.copy(lerpBiomeColor(biomeA.sun.color, biomeB.sun.color, t));
  sun.intensity = THREE.MathUtils.lerp(biomeA.sun.intensity, biomeB.sun.intensity, t);

  ambient.intensity = THREE.MathUtils.lerp(biomeA.ambient.intensity, biomeB.ambient.intensity, t);

  // Keep the sun (and therefore its shadow frustum, which is only ±45 units wide) travelling with
  // the car, otherwise shadows only resolve near the world origin — see scene.js.
  sun.position.set(car.position.x + 26, car.position.y + 28, car.position.z + 14);
  sun.target.position.copy(car.position);
  sun.target.updateMatrixWorld();
}

let oceanTime = 0;
function updateOcean(delta) {
  oceanTime += delta;
  oceanMaterials.forEach(mat => {
    mat.uniforms.uTime.value = oceanTime;
    // Custom ShaderMaterials don't receive three.js fog automatically, so the ocean's fog
    // uniforms are pushed from the live scene fog (which the biome blend is already animating).
    // Without this the water ignores fog entirely and ends in a hard line at the horizon.
    mat.uniforms.uFogColor.value.copy(scene.fog.color);
    mat.uniforms.uFogNear.value = scene.fog.near;
    mat.uniforms.uFogFar.value = scene.fog.far;
    mat.uniforms.uSkyColor.value.copy(skyGlow.material.uniforms.topColor.value);
    mat.uniforms.uSunColor.value.copy(sun.color);
  });
}

function updateStartLights() {
  if (raceState.running) {
    startLights.red.material.emissiveIntensity = 0;
    startLights.yellow.material.emissiveIntensity = 0;
    startLights.green.material.emissiveIntensity = 0;
    return;
  }
  const t = Math.min(Math.max(raceState.countdownTimer, 0), 3);
  startLights.red.material.emissiveIntensity = t < 1 ? 1.5 : 0.12;
  startLights.yellow.material.emissiveIntensity = t >= 1 && t < 2 ? 1.5 : 0.12;
  startLights.green.material.emissiveIntensity = t >= 2 && t < 3 ? 1.5 : 0.12;
}

function updateHud() {
  const speed = Math.round(Math.abs(car.speed) * UNITS_TO_MPH);
  hudSpeedEl.textContent = `${speed} mph`;
  hudTimeEl.textContent = formatRaceTime(raceElapsedMs());
}

function animate() {
  const delta = Math.min(0.033, 1 / 60);

  if (!raceState.running) {
    raceState.countdownTimer += delta;
    const step = Math.floor(raceState.countdownTimer);
    if (step >= 1 && step < 4) {
      const countdownValue = 3 - step + 1;
      raceMessageEl.textContent = String(Math.max(1, countdownValue));
    }
    if (raceState.countdownTimer >= 3) {
      raceState.running = true;
      raceState.timerStart = performance.now(); // race timer starts at GO, as control is handed over
      raceOverlayEl.classList.add('hidden');
      raceMessageEl.textContent = 'GO';
    }
  }

  updateStartLights();
  updateHintVisuals(performance.now());

  if (raceState.running) {
    const state = input.getState();
    const physics = updateCarPhysics(car, state, delta);
    car.updateWheels(car.speed * delta);
    updateTraffic(delta);
    updateBoosts(delta);
    updateQuestionZone();
    updateCollisions();
    updateCamera(delta, physics.speedFactor, physics.drift);

    raceState.progress = THREE.MathUtils.clamp((car.position.z - START_Z) / TRACK_LENGTH, 0, 1);
    if (!raceState.finished && car.position.z > FINISH_Z - 13 && Math.abs(car.speed) > 8) {
      raceState.finished = true;
      raceState.timerEnd = performance.now(); // race timer stops on crossing the finish line
      raceOverlayEl.classList.remove('hidden');
      raceMessageEl.textContent = 'FINISH';
      showRaceResults();
      restartButtonEl.hidden = false;
    }
    window.__racing = { car, camera, scene, renderer, physics, raceState, pickNextQuestion };
  } else {
    car.speed *= 0.8;
    updateCamera(delta, 0, 0);
  }

  updateBuildingLOD();
  updateBiome();
  updateOcean(delta);
  updateHud();
  // ?nofx=1 bypasses the whole post-processing chain (bloom + vignette + chromatic aberration)
  // and draws the scene straight to the canvas. The composer renders into HalfFloat targets whose
  // behaviour varies with GPU/driver and devicePixelRatio, so this is the one switch that cleanly
  // separates "the scene isn't rendering" from "post-processing is eating the scene".
  if (POST_FX_ENABLED) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

}

// Sized from the actual mount container, not window.innerWidth/innerHeight — inside an embedded
// webview (e.g. VSCode's Simple Browser panel) the window may never fire a 'resize' event that
// matches the panel's real, laid-out size, leaving the camera stuck with whatever aspect ratio
// happened to be computed at script-load time (before layout settled). A ResizeObserver on the
// mount element fires immediately with the container's real size and again on every actual size
// change, regardless of whether the window itself dispatches resize events.
function handleResize(width, height) {
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
}
new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  handleResize(width, height);
}).observe(mount);
window.addEventListener('resize', () => handleResize(mount.clientWidth, mount.clientHeight));
