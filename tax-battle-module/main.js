import { SUBJECTS } from '../question-bank.js?v=2';

const onboardingOverlay = document.getElementById('onboardingOverlay');
const onboardingForm = document.getElementById('onboardingForm');
const trainerNameInput = document.getElementById('trainerName');
const trainerSubjectInput = document.getElementById('trainerSubject');
const nameError = document.getElementById('nameError');
const gameShell = document.getElementById('gameShell');
const subjectPill = document.getElementById('subjectPill');
const trainerNameView = document.getElementById('trainerNameView');
const trainerLevel = document.getElementById('trainerLevel');
const playerHpValue = document.getElementById('playerHpValue');
const xpValue = document.getElementById('xpValue');
const badgeValue = document.getElementById('badgeValue');
const winsValue = document.getElementById('winsValue');
const teamList = document.getElementById('teamList');
const enemyNameEl = document.getElementById('enemyName');
const enemyHpTextEl = document.getElementById('enemyHpText');
const enemyHpBarEl = document.getElementById('enemyHpBar');
const enemySpriteEl = document.getElementById('enemySprite');
const dialogueBox = document.getElementById('dialogueBox');
const questionTextEl = document.getElementById('questionText');
const answerGridEl = document.getElementById('answerGrid');
const btnNextEncounter = document.getElementById('btnNextEncounter');
const btnTryAgain = document.getElementById('btnTryAgain');
const btnLeaveBattle = document.getElementById('btnLeaveBattle');
const worldPanel = document.getElementById('worldPanel');
const battlePanel = document.getElementById('battlePanel');
const worldCanvas = document.getElementById('worldCanvas');
const worldStage = document.getElementById('worldStage');
const worldCtx = worldCanvas ? worldCanvas.getContext('2d') : null;
const mapLocationEl = document.getElementById('mapLocation');
const hasLegacyWorldCanvas = Boolean(worldCanvas && worldCtx);
const worldMessageEl = document.getElementById('worldMessage');
const encounterLabelEl = document.getElementById('encounterLabel');
const routeBarEl = document.getElementById('routeBar');

const wildEnemies = [
  { name: 'VAT Viper', emoji: '🐍', colour: '#ff8a8a' },
  { name: 'NI Nibbler', emoji: '🐭', colour: '#8ae9b3' },
  { name: 'Relief Raccoon', emoji: '🦝', colour: '#93c5ff' },
  { name: 'Allowance Otter', emoji: '🦦', colour: '#f7d98b' },
  { name: 'Deadline Drake', emoji: '🐉', colour: '#d6a2ff' },
];

const teamRoster = [
  { name: 'Rate Rover', emoji: '🚀', hp: 100 },
  { name: 'Allowance Fox', emoji: '🦊', hp: 100 },
  { name: 'Audit Aardvark', emoji: '🦔', hp: 100 },
];

const state = {
  trainerName: '',
  subjectKey: 'uktax',
  playerHp: 100,
  xp: 0,
  badges: 0,
  wins: 0,
  level: 1,
  enemy: null,
  questionPool: [],
  currentQuestion: null,
  answersLocked: false,
  inBattle: false,
  world: {
    playerX: 120,
    playerY: 240,
    keys: { up: false, down: false, left: false, right: false },
    routeMeter: 0,
    lastEncounter: 0,
    location: 'Maple Lane',
    npcs: [],
    width: 860,
    height: 460,
    time: 0,
  }
};

function getCollisionRects() {
  return [
    { x: 0, y: 338, w: 220, h: 90 },
    { x: 58, y: 154, w: 34, h: 34 },
    { x: 90, y: 108, w: 34, h: 34 },
    { x: 186, y: 104, w: 34, h: 34 },
    { x: 250, y: 172, w: 34, h: 34 },
    { x: 320, y: 110, w: 34, h: 34 },
    { x: 500, y: 120, w: 34, h: 34 },
    { x: 588, y: 164, w: 34, h: 34 },
    { x: 640, y: 104, w: 34, h: 34 },
    { x: 710, y: 146, w: 34, h: 34 },
    { x: 780, y: 110, w: 34, h: 34 },
    { x: 44, y: 300, w: 34, h: 34 },
    { x: 190, y: 322, w: 34, h: 34 },
    { x: 260, y: 330, w: 34, h: 34 },
    { x: 638, y: 322, w: 34, h: 34 },
    { x: 716, y: 298, w: 34, h: 34 },
    { x: 780, y: 320, w: 34, h: 34 },
    { x: 66, y: 438, w: 34, h: 34 },
    { x: 210, y: 430, w: 34, h: 34 },
    { x: 690, y: 430, w: 34, h: 34 },
    { x: 150, y: 410, w: 150, h: 26 },
    { x: 548, y: 410, w: 170, h: 26 },
  ];
}

function collidesWithObstacle(x, y, radius = 12) {
  const bounds = getCollisionRects();
  const pad = radius + 2;

  return bounds.some((rect) => {
    const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy < pad * pad;
  });
}

function tryMoveEntity(entity, dx, dy, radius = 12) {
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;

  if (collidesWithObstacle(nextX, nextY, radius)) {
    return false;
  }

  entity.x = Math.max(24, Math.min(worldCanvas.width - 24, nextX));
  entity.y = Math.max(26, Math.min(worldCanvas.height - 28, nextY));
  return true;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getSubjectQuestions(subjectKey) {
  const subject = SUBJECTS[subjectKey] || SUBJECTS.uktax;
  return subject.questions.slice();
}

function updateSummary() {
  trainerNameView.textContent = state.trainerName || 'Trainer';
  trainerLevel.textContent = String(state.level);
  playerHpValue.textContent = String(state.playerHp);
  xpValue.textContent = String(state.xp);
  badgeValue.textContent = String(state.badges);
  winsValue.textContent = String(state.wins);
  subjectPill.textContent = (SUBJECTS[state.subjectKey] || SUBJECTS.uktax).shortName.replace(' FUNDAMENTALS', '').replace(' PRACTITIONER', '').replace(' FOUNDATION', '');

  teamList.innerHTML = teamRoster.map((member, index) => {
    const pct = index === 0 ? 100 : 90;
    return `
      <div class="team-item">
        <div class="team-sprite">${member.emoji}</div>
        <div class="team-copy">
          <strong>${member.name}</strong>
          <div class="mini-bar"><span style="width:${pct}%"></span></div>
        </div>
      </div>
    `;
  }).join('');
}

function updateEnemyStats() {
  if (!state.enemy) {
    enemyNameEl.textContent = 'Tax Wisp';
    enemyHpTextEl.textContent = '0 / 100';
    enemyHpBarEl.style.width = '0%';
    enemySpriteEl.textContent = '✨';
    return;
  }

  const hpRatio = Math.max(0, (state.enemy.hp / state.enemy.maxHp) * 100);
  enemyNameEl.textContent = state.enemy.name;
  enemyHpTextEl.textContent = `${state.enemy.hp} / ${state.enemy.maxHp}`;
  enemyHpBarEl.style.width = `${hpRatio}%`;
  enemyHpBarEl.style.background = `linear-gradient(90deg, #7ef7ae, ${state.enemy.colour})`;
  enemySpriteEl.textContent = state.enemy.emoji;
  enemySpriteEl.style.filter = `drop-shadow(0 0 16px ${state.enemy.colour})`;
}

function renderAnswers() {
  if (!state.currentQuestion) {
    answerGridEl.innerHTML = '';
    return;
  }

  answerGridEl.innerHTML = state.currentQuestion.answers.map((answer, index) => `
    <button class="answer-btn" type="button" data-index="${index}">${String.fromCharCode(65 + index)}. ${answer}</button>
  `).join('');

  answerGridEl.querySelectorAll('.answer-btn').forEach((button) => {
    button.addEventListener('click', () => handleAnswer(Number(button.dataset.index)));
  });
}

function setDialogue(message) {
  dialogueBox.textContent = message;
}

// The walkable field is a Phaser scene (phaser-route.js, scene 'RouteScene') that would otherwise
// keep running while its panel is hidden — arrow keys pressed during a battle would walk the
// trainer around out of sight. It's paused for battles and resumed on the way back, with any keys
// that were held down released so the trainer doesn't keep walking.
function setFieldActive(active) {
  const scene = window.phaserRouteGame && window.phaserRouteGame.scene && window.phaserRouteGame.scene.getScene('RouteScene');
  if (!scene || !scene.sys || !scene.sys.settings) return;
  if (active) {
    if (scene.scene.isPaused()) scene.scene.resume();
    if (scene.input && scene.input.keyboard) scene.input.keyboard.resetKeys();
  } else if (scene.scene.isActive()) {
    scene.scene.pause();
  }
}

function showWorld() {
  worldPanel.classList.remove('hidden');
  battlePanel.classList.add('hidden');
  state.inBattle = false;
  setFieldActive(true);
  updateWorldHud();
}

function showBattle() {
  worldPanel.classList.add('hidden');
  battlePanel.classList.remove('hidden');
  state.inBattle = true;
  setFieldActive(false);
}

// After an answer the next question is queued with a short delay; leaving the battle cancels it.
let nextEncounterTimer = null;
const queueNextEncounter = (delay) => {
  clearTimeout(nextEncounterTimer);
  nextEncounterTimer = setTimeout(() => {
    nextEncounterTimer = null;
    if (state.inBattle) beginEncounter();
  }, delay);
};

// "Back to the field": leave the battle (nothing is lost — XP, badges and HP stay as they are) and
// return to walking the route where the trainer left off.
function leaveBattle() {
  if (!state.inBattle) return;
  clearTimeout(nextEncounterTimer);
  nextEncounterTimer = null;
  state.world.lastEncounter = Date.now();
  showWorld();
  worldMessageEl.textContent = 'You left the battle. Walk the route with WASD or arrow keys. Press Enter to start a battle.';
  if (document.activeElement) document.activeElement.blur(); // so Enter doesn't press a hidden button
}

function updateWorldHud() {
  mapLocationEl.textContent = state.world.location;
  const meter = Math.min(100, state.world.routeMeter);
  routeBarEl.style.width = `${meter}%`;
  if (meter < 35) {
    encounterLabelEl.textContent = 'Calm';
  } else if (meter < 75) {
    encounterLabelEl.textContent = 'Alert';
  } else {
    encounterLabelEl.textContent = 'Active';
  }
}

function makeNPCs() {
  const variants = [
    { name: 'Mira', color: '#ffb6c1', accent: '#ffe4ef' },
    { name: 'Toby', color: '#9fe7ff', accent: '#d8f6ff' },
    { name: 'Rae', color: '#c9ff99', accent: '#ecffd8' },
    { name: 'Ned', color: '#ffd393', accent: '#fff0ca' },
  ];

  state.world.npcs = variants.map((npc, index) => ({
    ...npc,
    x: 120 + index * 170,
    y: 160 + (index % 2) * 110,
    vx: (index % 2 === 0 ? 1 : -1) * (0.8 + index * 0.18),
    vy: (index % 2 === 0 ? 1 : -1) * (0.9 + index * 0.14),
    radius: 11,
    minX: 80,
    maxX: 780,
    minY: 110,
    maxY: 360,
    stepOffset: index * 1.7,
    facing: index % 2 === 0 ? 1 : -1,
  }));
}

function drawNPC(npc, time) {
  const bob = Math.sin(time * 0.08 + npc.stepOffset) * 2.8;
  const x = npc.x;
  const y = npc.y + bob;
  const stride = Math.sin(time * 0.12 + npc.stepOffset) * 3;
  const dir = npc.facing;

  worldCtx.fillStyle = 'rgba(16,18,22,0.14)';
  worldCtx.beginPath();
  worldCtx.ellipse(x, y + 20, 12, 6, 0, 0, Math.PI * 2);
  worldCtx.fill();

  worldCtx.fillStyle = npc.accent;
  worldCtx.fillRect(x - 9, y - 6, 18, 8);
  worldCtx.fillStyle = npc.color;
  worldCtx.beginPath();
  worldCtx.arc(x, y - 10, 8, 0, Math.PI * 2);
  worldCtx.fill();

  worldCtx.fillStyle = '#1f2937';
  worldCtx.fillRect(x - 8, y + 2, 16, 12);
  worldCtx.fillStyle = '#f8fafc';
  worldCtx.fillRect(x - 5, y - 12, 2, 2);
  worldCtx.fillRect(x + 3, y - 12, 2, 2);

  worldCtx.fillStyle = '#1f2937';
  worldCtx.fillRect(x - 9, y + 14, 4, 11 + stride * 0.5 * dir);
  worldCtx.fillRect(x + 5, y + 14, 4, 11 - stride * 0.5 * dir);

  worldCtx.fillStyle = '#f9fafb';
  worldCtx.font = 'bold 11px Arial';
  worldCtx.fillText(npc.name, x - 15, y - 22);
}

function drawPlayer(time) {
  const x = state.world.playerX;
  const y = state.world.playerY;
  const stride = Math.sin(time * 0.12) * 3.5;

  worldCtx.fillStyle = 'rgba(16,18,22,0.18)';
  worldCtx.beginPath();
  worldCtx.ellipse(x, y + 22, 15, 7, 0, 0, Math.PI * 2);
  worldCtx.fill();

  worldCtx.fillStyle = '#f7d17a';
  worldCtx.beginPath();
  worldCtx.arc(x, y - 10, 9, 0, Math.PI * 2);
  worldCtx.fill();

  worldCtx.fillStyle = '#ffb28d';
  worldCtx.fillRect(x - 8, y + 1, 16, 13);
  worldCtx.fillStyle = '#3250a8';
  worldCtx.fillRect(x - 10, y + 14, 5, 11 + stride * 0.7);
  worldCtx.fillRect(x + 5, y + 14, 5, 11 - stride * 0.7);

  worldCtx.fillStyle = '#f8fafc';
  worldCtx.fillRect(x - 5, y - 12, 2, 2);
  worldCtx.fillRect(x + 3, y - 12, 2, 2);

  worldCtx.strokeStyle = 'rgba(255,255,255,0.85)';
  worldCtx.lineWidth = 2;
  worldCtx.beginPath();
  worldCtx.arc(x, y - 10, 15, 0, Math.PI * 2);
  worldCtx.stroke();
}

function drawWorld() {
  if (!hasLegacyWorldCanvas) return;

  const { width, height } = worldCanvas;
  const t = state.world.time * 0.06;

  worldCtx.clearRect(0, 0, width, height);
  worldCtx.lineJoin = 'round';
  worldCtx.lineCap = 'round';

  worldCtx.fillStyle = '#8fce73';
  worldCtx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += 18) {
    for (let x = 0; x < width; x += 18) {
      const shimmer = (Math.sin((x * 0.8) + t) + Math.cos((y * 0.6) - t * 1.3)) * 7;
      worldCtx.fillStyle = `rgba(${95 + shimmer}, ${175 + shimmer * 0.8}, ${92 + shimmer * 0.7}, 1)`;
      worldCtx.fillRect(x, y, 16, 16);
    }
  }

  worldCtx.fillStyle = '#5ca25c';
  worldCtx.fillRect(0, 0, width, 22);
  worldCtx.fillRect(0, height - 24, width, 24);
  worldCtx.fillRect(0, 0, 16, height);
  worldCtx.fillRect(width - 16, 0, 16, height);

  worldCtx.fillStyle = '#d8b286';
  worldCtx.fillRect(0, 215, width, 120);
  worldCtx.fillRect(350, 0, 130, height);

  worldCtx.fillStyle = '#b68657';
  worldCtx.fillRect(0, 224, width, 12);
  worldCtx.fillRect(0, 295, width, 10);
  worldCtx.fillRect(360, 0, 12, height);
  worldCtx.fillRect(460, 0, 12, height);

  worldCtx.fillStyle = '#75bfd9';
  worldCtx.beginPath();
  worldCtx.ellipse(110, 380, 118, 42, 0, 0, Math.PI * 2);
  worldCtx.fill();

  worldCtx.fillStyle = '#8cc9ee';
  worldCtx.beginPath();
  worldCtx.ellipse(728, 146, 124, 52, 0, 0, Math.PI * 2);
  worldCtx.fill();

  worldCtx.fillStyle = 'rgba(0,0,0,0.15)';
  worldCtx.fillRect(0, 220, width, 110);
  worldCtx.fillRect(360, 0, 120, height);

  const treePositions = [
    [36, 150], [90, 120], [186, 104], [250, 180], [320, 116], [500, 128], [588, 164], [640, 104], [710, 154], [780, 118],
    [44, 312], [190, 332], [260, 344], [638, 330], [716, 316], [780, 332], [66, 448], [210, 444], [690, 440]
  ];

  treePositions.forEach(([x, y]) => {
    worldCtx.fillStyle = '#72523a';
    worldCtx.fillRect(x - 4, y + 18, 8, 18);
    worldCtx.fillStyle = '#2d7f43';
    worldCtx.beginPath();
    worldCtx.arc(x, y, 18, 0, Math.PI * 2);
    worldCtx.fill();
    worldCtx.beginPath();
    worldCtx.arc(x - 12, y + 8, 12, 0, Math.PI * 2);
    worldCtx.arc(x + 12, y + 8, 12, 0, Math.PI * 2);
    worldCtx.arc(x, y - 12, 12, 0, Math.PI * 2);
    worldCtx.fill();
    worldCtx.fillStyle = 'rgba(12, 30, 12, 0.18)';
    worldCtx.beginPath();
    worldCtx.ellipse(x, y + 22, 20, 10, 0, 0, Math.PI * 2);
    worldCtx.fill();
  });

  worldCtx.fillStyle = '#76a94f';
  worldCtx.fillRect(150, 292, 94, 26);
  worldCtx.fillRect(564, 292, 116, 26);
  worldCtx.fillStyle = '#8bbd63';
  worldCtx.fillRect(160, 272, 72, 22);
  worldCtx.fillRect(578, 272, 84, 22);

  worldCtx.fillStyle = '#90d55a';
  for (let i = 12; i < width - 12; i += 24) {
    worldCtx.fillRect(i, 420, 14, 8);
  }

  const signs = [
    { x: 124, y: 206, label: 'Maple' },
    { x: 444, y: 202, label: 'Route' },
    { x: 668, y: 208, label: 'Civic' },
  ];

  signs.forEach(({ x, y, label }) => {
    worldCtx.fillStyle = '#6d4b39';
    worldCtx.fillRect(x, y, 6, 52);
    worldCtx.fillStyle = '#f3d46b';
    worldCtx.fillRect(x - 18, y - 18, 42, 18);
    worldCtx.fillStyle = '#1d2431';
    worldCtx.font = 'bold 9px Arial';
    worldCtx.fillText(label, x - 13, y - 4);
  });

  const fences = [
    { x: 164, y: 392, w: 110 },
    { x: 578, y: 392, w: 110 },
  ];

  fences.forEach(({ x, y, w }) => {
    worldCtx.strokeStyle = '#6e5a41';
    worldCtx.lineWidth = 4;
    worldCtx.beginPath();
    for (let i = 0; i <= w; i += 12) {
      worldCtx.moveTo(x + i, y);
      worldCtx.lineTo(x + i - 6, y + 10);
    }
    worldCtx.stroke();
  });

  worldCtx.fillStyle = 'rgba(15,22,32,0.45)';
  worldCtx.fillRect(18, 18, 198, 36);
  worldCtx.fillStyle = '#f9fafb';
  worldCtx.font = 'bold 15px Arial';
  worldCtx.fillText(`Trainer: ${state.trainerName || 'You'}`, 30, 42);

  worldCtx.fillStyle = 'rgba(18, 28, 40, 0.55)';
  worldCtx.fillRect(82, 136, 100, 18);
  worldCtx.fillRect(332, 136, 116, 18);
  worldCtx.fillRect(594, 136, 146, 18);
  worldCtx.fillStyle = '#edf6ff';
  worldCtx.font = 'bold 12px Arial';
  worldCtx.fillText('Maple Lane', 96, 150);
  worldCtx.fillText('Tax District', 344, 150);
  worldCtx.fillText('Civic Square', 608, 150);

  state.world.npcs.forEach((npc) => {
    const nextX = npc.x + npc.vx;
    const nextY = npc.y + npc.vy;
    const collides = collidesWithObstacle(nextX, nextY, 12);

    if (collides) {
      npc.vx *= -1;
      npc.vy *= -1;
      npc.facing *= -1;
      return drawNPC(npc, state.world.time);
    }

    npc.x = Math.max(npc.minX, Math.min(npc.maxX, nextX));
    npc.y = Math.max(npc.minY, Math.min(npc.maxY, nextY));

    if (npc.x <= npc.minX || npc.x >= npc.maxX) npc.vx *= -1;
    if (npc.y <= npc.minY || npc.y >= npc.maxY) npc.vy *= -1;

    drawNPC(npc, state.world.time);
  });

  drawPlayer(state.world.time);
}

function maybeTriggerEncounter() {
  return;
}

function triggerEncounterOnDemand() {
  const now = Date.now();
  if (state.inBattle) return;
  if (now - state.world.lastEncounter < 1200) return;

  state.world.lastEncounter = now;
  state.world.routeMeter = 0;
  worldMessageEl.textContent = 'A wild tax challenger has appeared!';
  showBattle();
  beginEncounter();
}

function tickWorld() {
  if (state.inBattle || !hasLegacyWorldCanvas) return;

  const speed = 2.4;
  let moveX = 0;
  let moveY = 0;

  if (state.world.keys.left) moveX -= speed;
  if (state.world.keys.right) moveX += speed;
  if (state.world.keys.up) moveY -= speed;
  if (state.world.keys.down) moveY += speed;

  const nextX = state.world.playerX + moveX;
  const nextY = state.world.playerY + moveY;

  if (!collidesWithObstacle(nextX, nextY, 14)) {
    state.world.playerX = Math.max(30, Math.min(worldCanvas.width - 30, nextX));
    state.world.playerY = Math.max(30, Math.min(worldCanvas.height - 30, nextY));
  }

  state.world.time += 1;

  if (moveX !== 0 || moveY !== 0) {
    state.world.routeMeter = Math.min(100, state.world.routeMeter + 6);

    if (state.world.playerX < 220) {
      state.world.location = 'Maple Lane';
    } else if (state.world.playerX < 410) {
      state.world.location = state.world.playerY > 260 ? 'South Bend' : 'Tax District';
    } else if (state.world.playerX < 585) {
      state.world.location = 'Market Row';
    } else {
      state.world.location = 'Civic Square';
    }

    updateWorldHud();
    worldMessageEl.textContent = `Exploring ${state.world.location}. The route is becoming more active.`;
  }

  drawWorld();
}

function prepareQuestionPool() {
  if (!state.questionPool.length) {
    state.questionPool = shuffleArray(getSubjectQuestions(state.subjectKey));
  }
}

function beginEncounter() {
  prepareQuestionPool();

  const enemy = wildEnemies[Math.floor(Math.random() * wildEnemies.length)];
  const question = state.questionPool.shift();

  if (!question) {
    setDialogue('No more questions left in this subject. The trainer deck has been refreshed.');
    state.questionPool = shuffleArray(getSubjectQuestions(state.subjectKey));
    return beginEncounter();
  }

  state.enemy = {
    name: enemy.name,
    emoji: enemy.emoji,
    colour: enemy.colour,
    hp: 150,
    maxHp: 150,
  };
  state.currentQuestion = question;
  state.answersLocked = false;

  questionTextEl.textContent = question.q;
  renderAnswers();
  updateEnemyStats();
  setDialogue(`${state.trainerName || 'Trainer'} entered a battle with ${enemy.name}. Choose the best answer.`);
}

function finishBattle(victory) {
  state.answersLocked = true;
  if (victory) {
    state.wins += 1;
    state.badges += 1;
    state.xp += 20;
    state.level = Math.max(1, Math.floor(state.xp / 40) + 1);
    setDialogue(`Correct! ${state.enemy.name} was defeated. +20 XP and a new badge earned.`);
  } else {
    state.playerHp = Math.max(0, state.playerHp - 15);
    state.level = Math.max(1, Math.floor(state.xp / 40) + 1);
    setDialogue(`Not quite. ${state.trainerName || 'Trainer'} loses ground, but the next battle is ready.`);
  }

  if (state.playerHp <= 0) {
    state.playerHp = 100;
    state.xp = Math.max(0, state.xp - 10);
    setDialogue(`The trainer has been knocked out, but the next match resets the HP and the challenge continues.`);
  }

  updateSummary();
  updateEnemyStats();
}

function handleAnswer(index) {
  if (!state.currentQuestion || state.answersLocked) {
    return;
  }

  state.answersLocked = true;
  const isCorrect = index === state.currentQuestion.correct;
  const buttons = answerGridEl.querySelectorAll('.answer-btn');

  buttons.forEach((button, buttonIndex) => {
    const isSelected = Number(button.dataset.index) === index;
    if (buttonIndex === state.currentQuestion.correct) {
      button.classList.add('correct');
    }
    if (isSelected && !isCorrect) {
      button.classList.add('wrong');
    }
  });

  if (isCorrect) {
    state.enemy.hp = Math.max(0, state.enemy.hp - 25);
    updateEnemyStats();
    setDialogue(`Correct — ${state.currentQuestion.explanation}`);

    if (state.enemy.hp <= 0) {
      finishBattle(true);
      return;
    }

    queueNextEncounter(1400);
    return;
  }

  setDialogue(`Not quite. The right answer is: ${state.currentQuestion.answers[state.currentQuestion.correct]}`);
  finishBattle(false);

  queueNextEncounter(1500);
}

function validateForm() {
  let isValid = true;
  const nameValue = trainerNameInput.value.trim();
  nameError.textContent = '';

  if (!nameValue) {
    nameError.textContent = 'Please enter a trainer name.';
    isValid = false;
  }

  return isValid;
}

function startGame() {
  if (!validateForm()) {
    return;
  }

  state.trainerName = trainerNameInput.value.trim();
  state.subjectKey = trainerSubjectInput.value || 'uktax';
  state.playerHp = 100;
  state.xp = 0;
  state.badges = 0;
  state.wins = 0;
  state.level = 1;
  state.questionPool = shuffleArray(getSubjectQuestions(state.subjectKey));

  onboardingOverlay.classList.add('hidden');
  gameShell.classList.remove('hidden');
  updateSummary();
  makeNPCs();
  showWorld();
  if (window.initPhaserRoute && worldStage) {
    window.initPhaserRoute();
  } else if (hasLegacyWorldCanvas) {
    drawWorld();
  }
}

onboardingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  startGame();
});

btnNextEncounter.addEventListener('click', () => {
  beginEncounter();
  showBattle();
});

btnLeaveBattle.addEventListener('click', leaveBattle);

btnTryAgain.addEventListener('click', () => {
  state.playerHp = 100;
  state.xp = Math.max(0, state.xp - 10);
  updateSummary();
  beginEncounter();
});

document.getElementById('btnReset').addEventListener('click', () => {
  onboardingOverlay.classList.remove('hidden');
  gameShell.classList.add('hidden');
  trainerNameInput.value = '';
  trainerSubjectInput.value = state.subjectKey || 'uktax';
  nameError.textContent = '';
});

window.addEventListener('keydown', (event) => {
  if (state.inBattle) {
    if (event.key === 'Escape') leaveBattle(); // keyboard shortcut for "Back to the field"
    return;
  }
  if (event.key === 'Enter') {
    triggerEncounterOnDemand();
    return;
  }
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') state.world.keys.up = true;
  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') state.world.keys.down = true;
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.world.keys.left = true;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.world.keys.right = true;
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') state.world.keys.up = false;
  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') state.world.keys.down = false;
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.world.keys.left = false;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.world.keys.right = false;
});

const initialSubject = new URLSearchParams(window.location.search).get('subject') || 'uktax';
if (SUBJECTS[initialSubject]) {
  state.subjectKey = initialSubject;
  trainerSubjectInput.value = initialSubject;
}

updateSummary();
updateEnemyStats();
updateWorldHud();
if (window.initPhaserRoute && worldStage) {
  window.initPhaserRoute();
} else if (hasLegacyWorldCanvas) {
  drawWorld();
}
setInterval(() => {
  if (!gameShell.classList.contains('hidden')) {
    tickWorld();
  }
}, 30);
