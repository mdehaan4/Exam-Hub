// Forest adventure mode: overworld exploration + trainer battles.

import { goToHub, showScreen } from './arcade.js?v=17';
import { G } from './shared.js?v=17';

// ---------- forest adventure mode ----------
export const forestScreenEl = document.getElementById('forestScreen');
const forestCanvas = document.getElementById('forestCanvas');
const forestCtx = forestCanvas.getContext('2d');
const forestStatusEl = document.getElementById('forestStatus');
const forestBattlePanelEl = document.getElementById('forestBattlePanel');
const forestBattleNameEl = document.getElementById('forestBattleName');
const forestBattleHpEl = document.getElementById('forestBattleHp');
const forestKeys = {};
const forestPlayer = { x: 110, y: 250, radius: 15, color:'#76d6ff', facing:'right', step:0 };
const forestRace = { active:true, distance:0, speed:160, best:0, crash:false };
let forestTrees = [];
let forestNPCs = [];
let forestBerries = [];
let forestCars = [];
let forestActiveTrainer = null;
let forestBattle = { active:false, trainer:null, enemyHp:0, playerHp:6 };

function clampForest(value, min, max){ return Math.min(max, Math.max(min, value)); }

function updateForestBattle(){
  if(!forestBattle.active || !forestBattle.trainer){
    forestBattlePanelEl.classList.remove('visible');
    forestBattleNameEl.textContent = '';
    forestBattleHpEl.textContent = '0/0';
    return;
  }
  forestBattlePanelEl.classList.add('visible');
  forestBattleNameEl.textContent = forestBattle.trainer.name;
  forestBattleHpEl.textContent = `${forestBattle.enemyHp}/5`;
}

function makeForestWorld(){
  forestTrees = [
    { x: 40, y: 42, width: 110, height: 110, hue: '#d2b191', name: 'Cafe' },
    { x: 165, y: 26, width: 122, height: 128, hue: '#c7d7f2', name: 'Bakery' },
    { x: 300, y: 42, width: 114, height: 112, hue: '#bdd8c7', name: 'Bookshop' },
    { x: 430, y: 24, width: 126, height: 128, hue: '#d1b0a6', name: 'News' },
    { x: 575, y: 36, width: 106, height: 118, hue: '#9bb7d4', name: 'Market' },
  ];

  forestBerries = Array.from({ length: 7 }, (_, i) => ({
    x: 100 + ((i * 84) % 550),
    y: 265 + ((i * 33) % 40),
    size: 7,
    glow: 0,
    kind: i % 2 === 0 ? 'light' : 'shop',
  }));

  forestCars = [
    { x: -170, z: 90, speed: 78, color: '#ff7676', lane: -1 },
    { x: -40, z: 150, speed: 96, color: '#76b5ff', lane: 0 },
    { x: 80, z: 210, speed: 88, color: '#ffd166', lane: 1 },
    { x: 170, z: 260, speed: 104, color: '#8be28a', lane: 2 },
  ];

  forestNPCs = [
    { name: 'Milo', x: -150, y: 305, radius: 13, color:'#ffb26d', tx: 0, ty: 0, wander: 0, z: 70 },
    { name: 'Luna', x: -40, y: 310, radius: 13, color:'#b28cff', tx: 0, ty: 0, wander: 0, z: 120 },
    { name: 'Kip', x: 70, y: 304, radius: 13, color:'#5edab4', tx: 0, ty: 0, wander: 0, z: 170 },
    { name: 'Sora', x: 170, y: 315, radius: 13, color:'#ff7c98', tx: 0, ty: 0, wander: 0, z: 220 },
  ];

  forestPlayer.x = 0;
  forestPlayer.y = 315;
  forestRace.active = true;
  forestRace.distance = 0;
  forestRace.speed = 160;
  forestRace.crash = false;
  forestActiveTrainer = null;
  forestBattle = { active:false, trainer:null, enemyHp:0, playerHp:6 };
  forestStatusEl.textContent = 'Street race live — dodge traffic and chase the distance.';
  updateForestBattle();
}

function forestNearestTrainer(){
  let bestIndex = -1;
  let bestDist = 9999;
  forestNPCs.forEach((npc, index) => {
    const dist = Math.hypot(npc.x - forestPlayer.x, npc.y - forestPlayer.y);
    if(dist < 42 && dist < bestDist){
      bestDist = dist;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function forestNearestBerry(){
  let bestIndex = -1;
  let bestDist = 9999;
  forestBerries.forEach((berry, index) => {
    const dist = Math.hypot(berry.x - forestPlayer.x, berry.y - forestPlayer.y);
    if(dist < 28 && dist < bestDist){
      bestDist = dist;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function forestInteract(){
  if(forestBattle.active){
    forestStatusEl.textContent = `${forestBattle.trainer.name} is ready for battle — use the battle panel.`;
    return;
  }

  const berryIndex = forestNearestBerry();
  if(berryIndex !== -1){
    forestBerries.splice(berryIndex, 1);
    forestStatusEl.textContent = 'You picked a berry and restored your focus.';
    forestBattle.playerHp = Math.min(6, forestBattle.playerHp + 1);
    return;
  }

  const index = forestNearestTrainer();
  if(index === -1){
    forestStatusEl.textContent = 'No walker is close enough. Walk nearer to someone on the street.';
    return;
  }

  const npc = forestNPCs[index];
  const encounters = [
    `${npc.name} challenges you to a friendly street duel!`,
    `${npc.name} shows off a quick city move.`,
    `${npc.name} wants to trade snacks and stories.`,
    `${npc.name} says: "Let’s walk the avenue together!"`,
  ];
  forestActiveTrainer = npc;
  forestBattle = { active:true, trainer:npc, enemyHp:5, playerHp:6 };
  forestStatusEl.textContent = encounters[Math.floor(Math.random() * encounters.length)];
  updateForestBattle();
}

function forestRun(){
  if(forestBattle.active){
    forestBattle = { active:false, trainer:null, enemyHp:0, playerHp:6 };
    forestActiveTrainer = null;
    forestStatusEl.textContent = 'You safely slip away into the trees.';
    updateForestBattle();
    return;
  }
  forestStatusEl.textContent = 'You keep moving through the forest.';
}

function forestBattleAction(kind){
  if(!forestBattle.active || !forestBattle.trainer) return;

  if(kind === 'battle'){
    forestBattle.enemyHp = Math.max(0, forestBattle.enemyHp - 1);
    forestStatusEl.textContent = `You strike ${forestBattle.trainer.name}.`;
    if(forestBattle.enemyHp <= 0){
      forestStatusEl.textContent = `You defeated ${forestBattle.trainer.name}!`;
      forestBattle = { active:false, trainer:null, enemyHp:0, playerHp:6 };
      forestActiveTrainer = null;
      updateForestBattle();
      return;
    }
    if(Math.random() > 0.45){
      forestBattle.playerHp = Math.max(0, forestBattle.playerHp - 1);
      forestStatusEl.textContent = `${forestBattle.trainer.name} counters with a quick spark!`;
    }
  }

  if(kind === 'talk'){
    const talkLines = [
      `${forestBattle.trainer.name} says: "You’ve got great energy!"`,
      `${forestBattle.trainer.name} smiles and offers a route through the trees.`,
      `${forestBattle.trainer.name} says: "The forest is full of hidden berries."`,
    ];
    forestStatusEl.textContent = talkLines[Math.floor(Math.random() * talkLines.length)];
  }

  if(kind === 'run'){
    forestRun();
    return;
  }

  updateForestBattle();
}

export function updateForest(dt){
  if(G.appMode !== 'forest') return;

  let dx = 0;
  if(forestKeys.ArrowRight || forestKeys.KeyD) dx += 1;
  if(forestKeys.ArrowLeft || forestKeys.KeyA) dx -= 1;

  if(dx !== 0){
    const speed = 220;
    forestPlayer.x += dx * speed * dt;
    forestPlayer.x = clampForest(forestPlayer.x, -180, 180);
    forestPlayer.step += dt * 8;
    forestPlayer.facing = dx >= 0 ? 'right' : 'left';
  } else {
    forestPlayer.step = 0;
  }

  forestPlayer.y = 315;

  if(forestRace.active){
    forestRace.speed = 160 + Math.min(forestRace.distance * 0.12, 120);
    forestRace.distance += forestRace.speed * dt;
    forestStatusEl.textContent = 'Street race live — distance: ' + Math.floor(forestRace.distance) + 'm';
  }

  forestCars.forEach(car => {
    car.z -= (forestRace.speed * 0.9 + car.speed) * dt;
    if(car.z < -40){
      car.z = 260 + Math.random() * 110;
      const lanes = [-170, -80, 0, 80, 170];
      car.x = lanes[Math.floor(Math.random() * lanes.length)];
    }
  });

  const crash = forestCars.some(car => Math.abs(car.x - forestPlayer.x) < 40 && car.z < 24 && car.z > -16);
  if(crash && forestRace.active){
    forestRace.active = false;
    forestRace.crash = true;
    forestStatusEl.textContent = 'Crash! Press RUN or tap the button to restart the race.';
  }

  forestNPCs.forEach((npc, index) => {
    npc.wander -= dt * 1000;
    if(npc.wander <= 0){
      npc.tx = (Math.random() - 0.5) * 2;
      npc.wander = 700 + Math.random() * 1300;
    }
    const moveX = npc.tx * 40 * dt;
    npc.x = clampForest(npc.x + moveX, -170, 170);
    npc.z = 48 + (index * 24) + Math.sin(performance.now() * 0.002 + index) * 10;
    npc.y = 305 + Math.sin(performance.now() * 0.003 + index + npc.x * 0.04) * 4;
    npc.facing = npc.tx >= 0 ? 'right' : 'left';
  });

  forestBerries.forEach(berry => {
    berry.glow += dt * 2.5;
  });
}

function projectRoadPoint(x, z){
  const w = forestCanvas.width;
  const h = forestCanvas.height;
  const horizon = 130;
  const zNorm = Math.min(Math.max(z, 20), 220) / 220;
  const roadHalf = 30 + (1 - zNorm) * 300;
  const y = horizon + (1 - zNorm) * (h - horizon - 12);
  const xScreen = w / 2 + (x / 220) * roadHalf;
  return { x: xScreen, y, scale: 0.25 + (1 - zNorm) * 1.8 };
}

function drawForestGround(){
  const w = forestCanvas.width;
  const h = forestCanvas.height;
  const horizon = 130;
  const roadFlow = (forestRace.distance * 0.8) % 200;

  const sky = forestCtx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7ec5ff');
  sky.addColorStop(0.18, '#dff5ff');
  sky.addColorStop(0.52, '#d0ecff');
  sky.addColorStop(1, '#a9bac8');
  forestCtx.fillStyle = sky;
  forestCtx.fillRect(0, 0, w, h);

  forestCtx.fillStyle = 'rgba(255,230,160,0.9)';
  forestCtx.beginPath();
  forestCtx.arc(570, 72, 44, 0, Math.PI * 2);
  forestCtx.fill();

  for (let i = 0; i < 18; i++) {
    const x = 20 + i * 40;
    const blockH = 35 + (i % 6) * 18;
    const centerY = horizon - 8 - blockH * 0.7;
    const wBlock = 26 + (i % 3) * 7;
    forestCtx.fillStyle = 'rgba(26,42,57,0.18)';
    forestCtx.fillRect(x, centerY, wBlock, blockH);
    forestCtx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 2; col++) {
        forestCtx.fillRect(x + 4 + col * 10, centerY + 6 + row * 8, 6, 5);
      }
    }
  }

  const roadLeft1 = projectRoadPoint(-220, 20);
  const roadLeft2 = projectRoadPoint(-45, 220);
  const roadRight1 = projectRoadPoint(220, 20);
  const roadRight2 = projectRoadPoint(45, 220);

  forestCtx.fillStyle = '#5d6470';
  forestCtx.beginPath();
  forestCtx.moveTo(roadLeft1.x, roadLeft1.y);
  forestCtx.lineTo(roadRight1.x, roadRight1.y);
  forestCtx.lineTo(roadRight2.x, roadRight2.y + 6);
  forestCtx.lineTo(roadLeft2.x, roadLeft2.y + 6);
  forestCtx.closePath();
  forestCtx.fill();

  forestCtx.fillStyle = '#2d3037';
  forestCtx.beginPath();
  forestCtx.moveTo(roadLeft2.x + 10, roadLeft2.y + 16);
  forestCtx.lineTo(roadRight2.x - 10, roadRight2.y + 16);
  forestCtx.lineTo(w, h);
  forestCtx.lineTo(0, h);
  forestCtx.closePath();
  forestCtx.fill();

  forestCtx.strokeStyle = 'rgba(255,255,255,0.38)';
  forestCtx.lineWidth = 1.5;
  forestCtx.beginPath();
  forestCtx.moveTo(w / 2, horizon + 12);
  forestCtx.lineTo(w / 2, h);
  forestCtx.stroke();

  forestCtx.strokeStyle = '#f4ecc0';
  forestCtx.lineWidth = 2;
  forestCtx.beginPath();
  for (let i = 0; i < 14; i++) {
    const t = (i / 14 + roadFlow / 220) % 1;
    const p1 = projectRoadPoint(-170 + t * 340, 28 + t * 180);
    const p2 = projectRoadPoint(-170 + (t + 0.08) * 340, 28 + (t + 0.08) * 180);
    forestCtx.moveTo(p1.x, p1.y);
    forestCtx.lineTo(p2.x, p2.y);
  }
  forestCtx.stroke();

  for (let i = 0; i < 10; i++) {
    const x = 40 + i * 68;
    const lampBase = projectRoadPoint(x - 150, 95 + (i % 2) * 18);
    const lampTop = projectRoadPoint(x - 150, 160 + (i % 2) * 18);
    forestCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    forestCtx.lineWidth = 1.3;
    forestCtx.beginPath();
    forestCtx.moveTo(lampBase.x, lampBase.y);
    forestCtx.lineTo(lampTop.x, lampTop.y);
    forestCtx.stroke();
    forestCtx.fillStyle = 'rgba(255, 236, 165, 0.8)';
    forestCtx.beginPath();
    forestCtx.arc(lampTop.x, lampTop.y, 2.5, 0, Math.PI * 2);
    forestCtx.fill();
  }

  const buildings = [
    { x: -180, z: 60, w: 62, h: 110, c: '#d7b090', sign: 'CAFE' },
    { x: -110, z: 80, w: 62, h: 92, c: '#c9d8f3', sign: 'BAKERY' },
    { x: -42, z: 92, w: 54, h: 88, c: '#d7bfd6', sign: 'BOOKS' },
    { x: 46, z: 82, w: 60, h: 118, c: '#c2dcc8', sign: 'NEWS' },
    { x: 115, z: 68, w: 62, h: 96, c: '#dbc9a0', sign: 'SHOP' },
    { x: 185, z: 58, w: 48, h: 76, c: '#9bb6d5', sign: '' },
  ];

  buildings.forEach(building => {
    const p = projectRoadPoint(building.x - forestPlayer.x, building.z);
    const width = building.w * p.scale;
    const height = building.h * p.scale;
    const x = p.x;
    const y = p.y;

    forestCtx.fillStyle = 'rgba(0,0,0,0.12)';
    forestCtx.fillRect(x - width / 2 + 5, y + 4, width - 10, 12);
    forestCtx.fillStyle = building.c;
    forestCtx.fillRect(x - width / 2, y, width, height);
    forestCtx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        forestCtx.fillRect(x - width / 2 + 8 + col * 12, y + 8 + row * 12, 7, 9);
      }
    }
    forestCtx.fillStyle = '#f0d593';
    forestCtx.fillRect(x - width * 0.18, y + height + 2, width * 0.36, 8);
    if (building.sign) {
      forestCtx.fillStyle = 'rgba(20,26,33,0.72)';
      forestCtx.fillRect(x - width / 2 + 6, y + 8, width - 12, 12);
      forestCtx.fillStyle = '#fff';
      forestCtx.font = 'bold 8px sans-serif';
      forestCtx.textAlign = 'center';
      forestCtx.fillText(building.sign, x, y + 18);
    }
  });

  forestCtx.fillStyle = '#7d8d99';
  forestCtx.fillRect(0, h - 18, w, 18);

  const driftX = Math.sin(performance.now() * 0.0012) * 4;
  const driftY = Math.sin(performance.now() * 0.0016) * 2;
  forestCtx.translate(driftX, driftY);
  forestCtx.fillStyle = 'rgba(255,255,255,0.08)';
  forestCtx.fillRect(0, 0, w, h);
  forestCtx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawForestBerry(berry){
  const bob = Math.sin(performance.now() * 0.004 + berry.x) * 3;
  const p = projectRoadPoint(berry.x - forestPlayer.x, 90);
  const x = p.x;
  const y = p.y + bob;
  forestCtx.save();
  forestCtx.translate(x, y);
  if(berry.kind === 'light'){
    forestCtx.fillStyle = '#f5d76c';
    forestCtx.beginPath();
    forestCtx.arc(0, 0, 7, 0, Math.PI * 2);
    forestCtx.fill();
    forestCtx.strokeStyle = 'rgba(255,255,255,0.45)';
    forestCtx.lineWidth = 2;
    forestCtx.beginPath();
    forestCtx.moveTo(0, -15);
    forestCtx.lineTo(0, 15);
    forestCtx.moveTo(-15, 0);
    forestCtx.lineTo(15, 0);
    forestCtx.stroke();
  } else {
    forestCtx.fillStyle = `rgba(91, 176, 255, ${0.8 + Math.sin(berry.glow) * 0.15})`;
    forestCtx.fillRect(-6, -10, 12, 20);
    forestCtx.fillStyle = '#fff';
    forestCtx.fillRect(-2, -6, 4, 12);
  }
  forestCtx.restore();
}

function drawForestCar(car){
  const xWorld = car.x - forestPlayer.x;
  const z = car.z;
  const p = projectRoadPoint(xWorld, z);
  const sx = p.x;
  const sy = p.y + 22;
  const scale = p.scale * 0.9;

  forestCtx.save();
  forestCtx.translate(sx, sy);
  forestCtx.scale(scale, scale);
  forestCtx.fillStyle = 'rgba(0,0,0,0.18)';
  forestCtx.beginPath();
  forestCtx.ellipse(0, 18, 20, 8, 0, 0, Math.PI * 2);
  forestCtx.fill();
  forestCtx.fillStyle = car.color;
  forestCtx.fillRect(-18, -10, 36, 18);
  forestCtx.fillStyle = '#ebf4ff';
  forestCtx.fillRect(-10, -6, 8, 10);
  forestCtx.fillRect(2, -6, 8, 10);
  forestCtx.fillStyle = '#2a2a2a';
  forestCtx.fillRect(-16, 8, 6, 6);
  forestCtx.fillRect(10, 8, 6, 6);
  forestCtx.restore();
}

function drawForestCharacter(npc, isPlayer){
  const xWorld = isPlayer ? 0 : npc.x - forestPlayer.x;
  const z = isPlayer ? 16 : npc.z || 80;
  const p = projectRoadPoint(xWorld, z);
  const x = p.x;
  const y = p.y + 8;
  const scale = p.scale * (isPlayer ? 1.35 : 1.0);

  forestCtx.save();
  forestCtx.translate(x, y);
  forestCtx.scale(scale, scale);

  forestCtx.fillStyle = 'rgba(0,0,0,0.24)';
  forestCtx.beginPath();
  forestCtx.ellipse(0, 18, 16 * (isPlayer ? 1.1 : 0.9), 7, 0, 0, Math.PI * 2);
  forestCtx.fill();

  if (isPlayer) {
    forestCtx.fillStyle = '#243246';
    forestCtx.fillRect(-11, -10, 22, 22);
    forestCtx.fillStyle = '#7fe5ff';
    forestCtx.beginPath();
    forestCtx.arc(0, -22, 11, 0, Math.PI * 2);
    forestCtx.fill();
    forestCtx.fillStyle = '#f5f7ff';
    forestCtx.fillRect(-8, 4, 16, 11);
    forestCtx.strokeStyle = '#243246';
    forestCtx.lineWidth = 3;
    forestCtx.beginPath();
    forestCtx.moveTo(-7, 18);
    forestCtx.lineTo(-16, 36);
    forestCtx.moveTo(7, 18);
    forestCtx.lineTo(16, 36);
    forestCtx.stroke();
    forestCtx.restore();
    return;
  }

  forestCtx.fillStyle = npc.color;
  forestCtx.beginPath();
  forestCtx.moveTo(0, -10);
  forestCtx.lineTo(12, 2);
  forestCtx.quadraticCurveTo(10, 18, 0, 24);
  forestCtx.quadraticCurveTo(-10, 18, -12, 2);
  forestCtx.closePath();
  forestCtx.fill();

  forestCtx.fillStyle = '#f5f7ff';
  forestCtx.beginPath();
  forestCtx.ellipse(0, -18, 9, 10, 0, 0, Math.PI * 2);
  forestCtx.fill();

  forestCtx.fillStyle = '#0e1728';
  forestCtx.beginPath();
  forestCtx.arc(-3, -18, 2, 0, Math.PI * 2);
  forestCtx.arc(3, -18, 2, 0, Math.PI * 2);
  forestCtx.fill();

  forestCtx.strokeStyle = '#173537';
  forestCtx.lineWidth = 2.5;
  forestCtx.beginPath();
  forestCtx.moveTo(0, 12);
  forestCtx.lineTo(-8, 28);
  forestCtx.moveTo(0, 12);
  forestCtx.lineTo(8, 28);
  forestCtx.stroke();

  forestCtx.fillStyle = '#ecfff1';
  forestCtx.font = 'bold 11px sans-serif';
  forestCtx.textAlign = 'center';
  forestCtx.fillText(npc.name, 0, -30);
  forestCtx.restore();
}

export function renderForest(){
  forestCtx.clearRect(0, 0, forestCanvas.width, forestCanvas.height);
  drawForestGround();

  forestCars.forEach(car => drawForestCar(car));
  forestBerries.forEach(berry => drawForestBerry(berry));

  const sceneNPCs = [...forestNPCs].sort((a, b) => (b.z || 0) - (a.z || 0));
  sceneNPCs.forEach(npc => drawForestCharacter(npc, false));
  drawForestCharacter(forestPlayer, true);

  forestCtx.fillStyle = 'rgba(12, 29, 20, 0.10)';
  forestCtx.fillRect(0, 0, forestCanvas.width, forestCanvas.height);

  forestCtx.fillStyle = 'rgba(9, 18, 21, 0.78)';
  forestCtx.fillRect(18, 18, 180, 52);
  forestCtx.strokeStyle = 'rgba(130, 255, 185, 0.9)';
  forestCtx.strokeRect(18, 18, 180, 52);
  forestCtx.fillStyle = '#ebfff4';
  forestCtx.font = 'bold 18px sans-serif';
  forestCtx.fillText(`DIST ${Math.floor(forestRace.distance)}m`, 30, 48);

  if(forestActiveTrainer){
    forestCtx.fillStyle = 'rgba(11, 17, 24, 0.76)';
    forestCtx.fillRect(18, 18, 350, 58);
    forestCtx.strokeStyle = 'rgba(130, 255, 185, 0.9)';
    forestCtx.strokeRect(18, 18, 350, 58);
    forestCtx.fillStyle = '#ebfff4';
    forestCtx.font = 'bold 18px sans-serif';
    forestCtx.fillText(`${forestActiveTrainer.name} wants to battle!`, 32, 55);
  }
}

export function startForestMode(subjectKey){
  G.currentSubject = subjectKey;
  makeForestWorld();
  showScreen('forest');
}

window.addEventListener('keydown', e => {
  if (G.appMode !== 'forest') return;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyE','KeyA','KeyD','KeyW','KeyS'].includes(e.code)) {
    e.preventDefault();
  }
  if (['ArrowLeft','KeyA'].includes(e.code)) forestKeys.ArrowLeft = true;
  if (['ArrowRight','KeyD'].includes(e.code)) forestKeys.ArrowRight = true;
  if (['ArrowUp','KeyW'].includes(e.code)) forestKeys.ArrowUp = true;
  if (['ArrowDown','KeyS'].includes(e.code)) forestKeys.ArrowDown = true;
  if (e.code === 'KeyE' || e.code === 'Space') forestInteract();
  if (e.code === 'KeyR') {
    forestActiveTrainer = null;
    forestStatusEl.textContent = 'You safely slip away into the trees.';
  }
});

window.addEventListener('keyup', e => {
  if (G.appMode !== 'forest') return;
  if (['ArrowLeft','KeyA'].includes(e.code)) forestKeys.ArrowLeft = false;
  if (['ArrowRight','KeyD'].includes(e.code)) forestKeys.ArrowRight = false;
  if (['ArrowUp','KeyW'].includes(e.code)) forestKeys.ArrowUp = false;
  if (['ArrowDown','KeyS'].includes(e.code)) forestKeys.ArrowDown = false;
});

document.getElementById('btnForestHub').addEventListener('click', goToHub);
document.getElementById('btnForestInteract').addEventListener('click', forestInteract);
document.getElementById('btnForestRun').addEventListener('click', () => {
  forestActiveTrainer = null;
  forestStatusEl.textContent = 'You safely slip away into the trees.';
});

