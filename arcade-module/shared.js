// Shared engine: constants, question data, sprites, audio, backdrop, leaderboard/app state,
// and the generic particle/popup system reused by every game mode.

export const G = { appMode: 'hub', currentSubject: 'gitlab', muted: false, debugReveal: false };


export const FONT_MONO = 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace';
export const LOGICAL_W = 600, LOGICAL_H = 760;
export const REDUCED_MOTION = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const rootStyle = getComputedStyle(document.documentElement);
export const COLORS = {
  phosphor: rootStyle.getPropertyValue('--phosphor').trim(),
  signal:   rootStyle.getPropertyValue('--signal').trim(),
  amber:    rootStyle.getPropertyValue('--amber').trim(),
  violet:   rootStyle.getPropertyValue('--violet').trim(),
  ink:      rootStyle.getPropertyValue('--ink').trim(),
};
export const SHADE = {
  outline: '#10152c',
  hullShade: '#a9b2cf',
  violetDark: '#4a3b8a',
  violetLight: '#c9bbff',
  decoy: '#5a6488',
  decoyDark: '#333a58',
  decoyLight: '#8891b8',
};


// ---------- mock exam questions ----------
// Re-exported for the game modules, and imported for this file's own use (openLeaderboard needs
// it) — a re-export alone doesn't create a local binding.
import { SUBJECTS } from '../question-bank.js?v=2';
import { calculatePayslip, calculateSelfAssessment } from '../payslip.js?v=2';
import { getSalary, saveSalary, getHmrcUser, EMPLOYMENT } from '../player-session.js?v=1';
export { SUBJECTS };

// ---------- pixel-block sprites ----------
function buildSprite(w, h, blocks){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const bctx = c.getContext('2d');
  for(const b of blocks){ bctx.fillStyle = b.c; bctx.fillRect(b.x, b.y, b.w, b.h); }
  return c;
}

const PLAYER_BASE_BLOCKS = [
  {x:8,y:0,w:4,h:3,c:SHADE.outline},
  {x:7,y:3,w:6,h:3,c:SHADE.outline},
  {x:3,y:6,w:14,h:4,c:SHADE.outline},
  {x:6,y:10,w:8,h:4,c:SHADE.outline},
  {x:7,y:14,w:6,h:3,c:SHADE.outline},
  {x:6,y:17,w:2,h:2,c:SHADE.outline},
  {x:12,y:17,w:2,h:2,c:SHADE.outline},
  {x:9,y:1,w:2,h:2,c:COLORS.ink},
  {x:8,y:4,w:4,h:2,c:COLORS.ink},
  {x:4,y:7,w:5,h:2,c:SHADE.hullShade},
  {x:11,y:7,w:5,h:2,c:COLORS.ink},
  {x:9,y:7,w:2,h:2,c:COLORS.ink},
  {x:7,y:11,w:6,h:2,c:COLORS.ink},
  {x:8,y:15,w:4,h:1,c:SHADE.hullShade},
  {x:9,y:4,w:2,h:2,c:COLORS.phosphor},
  {x:3,y:8,w:1,h:2,c:COLORS.phosphor},
  {x:16,y:8,w:1,h:2,c:COLORS.phosphor},
  {x:6,y:18,w:2,h:1,c:COLORS.amber},
  {x:12,y:18,w:2,h:1,c:COLORS.amber},
];
const PLAYER_POD_OFFSET = [0, 0, 3, 6, 9]; // extra grid-units added to each side, per weapon level
function playerBlocksForLevel(level){
  const offset = PLAYER_POD_OFFSET[level-1];
  const gridW = 20 + offset*2;
  const shift = b => ({x:b.x+offset, y:b.y, w:b.w, h:b.h, c:b.c});

  const blocks = PLAYER_BASE_BLOCKS.map(shift);
  if(level>=2){
    blocks.push(shift({x:2,y:8,w:1,h:1,c:COLORS.amber}));
    blocks.push(shift({x:17,y:8,w:1,h:1,c:COLORS.amber}));
  }
  if(level>=3){
    blocks.push(shift({x:4,y:9,w:1,h:2,c:SHADE.outline}));
    blocks.push(shift({x:15,y:9,w:1,h:2,c:SHADE.outline}));
    blocks.push(shift({x:4,y:10,w:1,h:1,c:COLORS.phosphor}));
    blocks.push(shift({x:15,y:10,w:1,h:1,c:COLORS.phosphor}));
  }
  if(level>=4){
    blocks.push(shift({x:9,y:12,w:2,h:1,c:COLORS.amber}));
  }
  if(level>=5){
    blocks.push(shift({x:1,y:7,w:1,h:1,c:COLORS.violet}));
    blocks.push(shift({x:18,y:7,w:1,h:1,c:COLORS.violet}));
    blocks.push(shift({x:9,y:4,w:2,h:2,c:'#ffffff'}));
  }

  // side cannon pods — grow wider and more powerful-looking each weapon level
  if(offset > 0){
    const podColor = level>=5 ? COLORS.violet : (level>=4 ? COLORS.amber : COLORS.phosphor);
    const podH = level>=5 ? 8 : (level>=4 ? 6 : 4);
    const podY = level>=5 ? 6 : (level>=4 ? 7 : 8);
    const fillW = offset-2;
    blocks.push({x:0, y:podY, w:offset, h:podH, c:SHADE.outline});
    blocks.push({x:1, y:podY+1, w:fillW, h:podH-2, c:podColor});
    blocks.push({x:gridW-offset, y:podY, w:offset, h:podH, c:SHADE.outline});
    blocks.push({x:gridW-1-fillW, y:podY+1, w:fillW, h:podH-2, c:podColor});
    if(level>=5){
      blocks.push({x:0, y:podY+2, w:1, h:1, c:'#ffffff'});
      blocks.push({x:0, y:podY+podH-3, w:1, h:1, c:'#ffffff'});
      blocks.push({x:gridW-1, y:podY+2, w:1, h:1, c:'#ffffff'});
      blocks.push({x:gridW-1, y:podY+podH-3, w:1, h:1, c:'#ffffff'});
    }
  }

  return { blocks, gridW };
}
export const PLAYER_SPRITES = [1,2,3,4,5].map(lvl => {
  const {blocks, gridW} = playerBlocksForLevel(lvl);
  return buildSprite(gridW, 20, blocks);
});
const PLAYER_SCALE = 1.9;
export const PLAYER_DISPLAY_W = PLAYER_SPRITES.map(s => Math.round(s.width * PLAYER_SCALE));
export const PLAYER_DISPLAY_H = PLAYER_SPRITES.map((s,i) => PLAYER_DISPLAY_W[i] * (s.height / s.width));

const ALIEN_GRID_W = 28, ALIEN_GRID_H = 20, ALIEN_CX = 14;
const ALIEN_HALF_WIDTHS = [2,3,5,7,9,11,13,13,11,9,8,8,7,6,5,4,3,2,1,1];
function buildAlienSprite(base, dark, light){
  const blocks = [];
  for(let y=0; y<ALIEN_GRID_H; y++){
    const hw = ALIEN_HALF_WIDTHS[y];
    blocks.push({ x:ALIEN_CX-hw, y, w:hw*2, h:1, c:SHADE.outline });
    if(hw>=2){
      blocks.push({ x:ALIEN_CX-hw+1, y, w:hw-1, h:1, c:dark });
      blocks.push({ x:ALIEN_CX, y, w:hw-1, h:1, c:base });
    }
  }
  const wideHw = ALIEN_HALF_WIDTHS[6];
  blocks.push({ x:ALIEN_CX-1, y:3, w:2, h:7, c:light });
  blocks.push({ x:ALIEN_CX-2, y:6, w:4, h:3, c:light });
  blocks.push({ x:ALIEN_CX-wideHw, y:6, w:1, h:2, c:light });
  blocks.push({ x:ALIEN_CX+wideHw-1, y:6, w:1, h:2, c:light });
  blocks.push({ x:ALIEN_CX-1, y:18, w:2, h:2, c:light });
  return buildSprite(ALIEN_GRID_W, ALIEN_GRID_H, blocks);
}

export const ANSWER_SPRITE = buildAlienSprite(COLORS.violet, SHADE.violetDark, SHADE.violetLight);
export const ANSWER_DISPLAY_W = 40;
export const ANSWER_DISPLAY_H = ANSWER_DISPLAY_W * (ANSWER_SPRITE.height / ANSWER_SPRITE.width);

export const DECOY_SPRITE = buildAlienSprite(SHADE.decoy, SHADE.decoyDark, SHADE.decoyLight);

export function drawSpriteCentered(dctx, sprite, cx, cy, dispW, glowColor, glowBlur){
  const dispH = dispW * (sprite.height / sprite.width);
  dctx.save();
  dctx.imageSmoothingEnabled = false;
  if(glowColor){ dctx.shadowColor = glowColor; dctx.shadowBlur = glowBlur || 0; }
  dctx.drawImage(sprite, cx - dispW/2, cy - dispH/2, dispW, dispH);
  dctx.restore();
}

export function hexToRgba(hex, a){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
export function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
export function rand(a,b){ return a + Math.random()*(b-a); }
export function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
export function shuffleAnswerOptions(q){
  return shuffleArray(q.answers.map((text,i)=>({ text, correct:i===q.correct })));
}
export function pctOf(num, den){
  return den ? Math.round((num/den)*100) : 0;
}

const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
export const screenWrap = document.getElementById('screenWrap');
export const hitFlashEl = document.getElementById('hitFlash');
export const selSubject = document.getElementById('selSubject');

export function resizeCanvas(){
  const rect = screenWrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(
    (canvas.width / LOGICAL_W), 0, 0,
    (canvas.height / LOGICAL_H), 0, 0
  );
}

// ---------- pixel text renderer (canvas banners) ----------
const pcanvas = document.createElement('canvas');
const pctx = pcanvas.getContext('2d');
export function drawPixelText(dctx, text, cx, cy, opts){
  opts = opts || {};
  const scale = opts.scale || 4;
  const color = opts.color || COLORS.ink;
  const glow = opts.glow != null ? opts.glow : 16;
  const fontSize = opts.fontSize || 10;
  const pad = 4;
  pctx.font = `900 ${fontSize}px ${FONT_MONO}`;
  const textW = Math.max(1, Math.ceil(pctx.measureText(text).width));
  const w = textW + pad*2, h = fontSize + pad*2;
  pcanvas.width = w; pcanvas.height = h;
  pctx.font = `900 ${fontSize}px ${FONT_MONO}`;
  pctx.textBaseline = 'middle';
  pctx.textAlign = 'left';
  pctx.fillStyle = '#fff';
  pctx.fillText(text, pad, h/2 + 0.5);
  pctx.globalCompositeOperation = 'source-in';
  pctx.fillStyle = color;
  pctx.fillRect(0,0,w,h);
  pctx.globalCompositeOperation = 'source-over';

  dctx.save();
  dctx.imageSmoothingEnabled = false;
  dctx.shadowColor = color;
  dctx.shadowBlur = glow;
  const dw = w*scale, dh = h*scale;
  dctx.drawImage(pcanvas, cx - dw/2, cy - dh/2, dw, dh);
  dctx.restore();
  return dw;
}

// ---------- crisp answer-label text (in-world, must stay legible) ----------
export function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  c.closePath();
}
function wrapCanvasText(text, maxWidth){
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for(const w of words){
    const test = cur ? cur+' '+w : w;
    if(ctx.measureText(test).width > maxWidth && cur){ lines.push(cur); cur = w; }
    else cur = test;
  }
  if(cur) lines.push(cur);
  return lines;
}
export function drawAnswerLabel(text, cx, topY, maxWidth, color){
  ctx.save();
  ctx.font = `700 10px ${FONT_MONO}`;
  const lines = wrapCanvasText(text, maxWidth);
  const lineH = 13;
  let maxLineW = 0;
  for(const l of lines) maxLineW = Math.max(maxLineW, ctx.measureText(l).width);
  const boxW = Math.min(maxWidth+16, maxLineW+16);
  const boxH = lines.length*lineH + 8;
  const boxCX = clamp(cx, boxW/2+4, LOGICAL_W-boxW/2-4);
  ctx.fillStyle = 'rgba(6,8,18,0.72)';
  ctx.strokeStyle = hexToRgba(color, 0.4);
  ctx.lineWidth = 1;
  roundRect(ctx, boxCX-boxW/2, topY, boxW, boxH, 5);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = color; ctx.shadowBlur = 6;
  lines.forEach((line,i)=>{ ctx.fillText(line, boxCX, topY + 4 + i*lineH); });
  ctx.restore();
}

// ---------- audio ----------
let actx = null;
export function ensureAudio(){
  if(!actx){
    try{ actx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ actx = null; }
  } else if(actx.state === 'suspended'){
    actx.resume();
  }
}
function tone(freq, dur, type, vol, opts){
  if(G.muted || !actx) return;
  opts = opts || {};
  const t0 = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if(opts.sweepTo != null){
    osc.frequency.exponentialRampToValueAtTime(Math.max(1,opts.sweepTo), t0 + dur);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol||0.2), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(actx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function noise(dur, vol){
  if(G.muted || !actx) return;
  const t0 = actx.currentTime;
  const bufSize = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, bufSize, actx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<bufSize;i++){ data[i] = (Math.random()*2-1) * (1 - i/bufSize); }
  const src = actx.createBufferSource();
  src.buffer = buf;
  const gain = actx.createGain();
  gain.gain.setValueAtTime(vol||0.2, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0+dur);
  src.connect(gain).connect(actx.destination);
  src.start(t0);
}
export const sfx = {
  shoot(lvl){
    lvl = lvl||1;
    tone(760+(lvl-1)*45, 0.09, 'square', 0.05+lvl*0.007, {sweepTo:1400+(lvl-1)*120});
    if(lvl>=4){ noise(0.1,0.09); tone(140,0.14,'sawtooth',0.06,{sweepTo:55}); }
    if(lvl>=5) noise(0.05,0.05);
  },
  correct(){ noise(0.1,0.08); [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.12,'square',0.07),i*60)); },
  wrong(){ noise(0.22,0.16); tone(200,0.32,'sawtooth',0.09,{sweepTo:60}); },
  step(alt){ tone(alt?130:100, 0.05, 'square', 0.035); },
  decoyPop(){ noise(0.08,0.07); tone(300,0.08,'square',0.05,{sweepTo:120}); },
  complete(){ [523,659,784,988,1319].forEach((f,i)=>setTimeout(()=>tone(f,0.18,'square',0.08),i*100)); },
  weaponUp(){ [660,880,1175].forEach((f,i)=>setTimeout(()=>tone(f,0.1,'square',0.07),i*55)); },
  kick(){ noise(0.06,0.06); tone(150,0.12,'triangle',0.09,{sweepTo:70}); },
  chomp(){ tone(480,0.045,'square',0.05,{sweepTo:320}); }
};

// ---------- starfield ----------
const stars = [];
(function initStars(){
  const layers = [
    {n:40, speed:14, size:1, alpha:0.35},
    {n:28, speed:28, size:1.6, alpha:0.55},
    {n:16, speed:48, size:2.2, alpha:0.85},
  ];
  layers.forEach(L=>{
    for(let i=0;i<L.n;i++){
      stars.push({ x:rand(0,LOGICAL_W), y:rand(0,LOGICAL_H), speed:L.speed, size:L.size, alpha:L.alpha });
    }
  });
})();
export function updateStars(dt){
  const mult = REDUCED_MOTION ? 0.15 : 1;
  for(const s of stars){
    s.y += s.speed*dt*mult;
    if(s.y > LOGICAL_H){ s.y = -2; s.x = rand(0,LOGICAL_W); }
  }
}
export function drawStars(){
  for(const s of stars){
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// ---------- earth backdrop ----------
// NASA's Apollo 17 "Blue Marble" photograph (public domain, Dec 7 1972), embedded directly
// and given a soft feathered edge so it blends into the void instead of reading as a pasted photo
const EARTH_JPEG_B64 = "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";
const EARTH_CX = 100, EARTH_CY = 680, EARTH_R = 190;
let earthSprite = null;
(function loadEarthSprite(){
  const img = new Image();
  img.onload = function(){
    const size = 340;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, size, size);
    octx.globalCompositeOperation = 'destination-in';
    const grad = octx.createRadialGradient(size/2,size/2,size*0.44, size/2,size/2,size*0.5);
    grad.addColorStop(0,'rgba(255,255,255,1)');
    grad.addColorStop(1,'rgba(255,255,255,0)');
    octx.fillStyle = grad;
    octx.beginPath(); octx.arc(size/2,size/2,size*0.5,0,Math.PI*2); octx.fill();
    earthSprite = off;
  };
  img.src = 'data:image/jpeg;base64,' + EARTH_JPEG_B64;
})();
export function drawEarthBackdrop(){
  if(!earthSprite) return;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.shadowColor = 'rgba(120,180,255,0.4)';
  ctx.shadowBlur = 34;
  ctx.drawImage(earthSprite, EARTH_CX-EARTH_R, EARTH_CY-EARTH_R, EARTH_R*2, EARTH_R*2);
  ctx.restore();
}

// ---------- app / subject state ----------
export function loadHighScore(prefix){
  try{ return parseInt(localStorage.getItem('eh_highscore_'+(prefix||'')+G.currentSubject)||'0',10) || 0; }catch(e){ return 0; }
}
export function saveHighScore(prefix, value){
  try{ localStorage.setItem('eh_highscore_'+(prefix||'')+G.currentSubject, String(value)); }catch(e){}
}

// ---------- leaderboards ----------
const LEADERBOARD_SIZE = 10;
function leaderboardKey(prefix){ return 'eh_leaderboard_'+(prefix||'')+G.currentSubject; }
function loadLeaderboard(prefix){
  try{ const list = JSON.parse(localStorage.getItem(leaderboardKey(prefix))||'[]'); return Array.isArray(list) ? list : []; }
  catch(e){ return []; }
}
function saveLeaderboardList(prefix, list){
  try{ localStorage.setItem(leaderboardKey(prefix), JSON.stringify(list)); }catch(e){}
}
export function qualifiesForLeaderboard(prefix, scoreVal){
  if(scoreVal<=0) return false;
  const list = loadLeaderboard(prefix);
  if(list.length < LEADERBOARD_SIZE) return true;
  return scoreVal > list[list.length-1].score;
}
function addToLeaderboard(prefix, name, scoreVal){
  const list = loadLeaderboard(prefix);
  list.push({ name: (name||'PLAYER').trim().slice(0,12).toUpperCase() || 'PLAYER', score: scoreVal });
  list.sort((a,b)=>b.score-a.score);
  list.length = Math.min(list.length, LEADERBOARD_SIZE);
  saveLeaderboardList(prefix, list);
  return list;
}

export let modalOpen = false;
let pendingHighScore = null;
const hsModalEl = document.getElementById('hsModal');
const hsModalScoreEl = document.getElementById('hsModalScore');
const hsNameInputEl = document.getElementById('hsNameInput');
const hsSaveBtnEl = document.getElementById('hsSaveBtn');
const lbModalEl = document.getElementById('lbModal');
const lbModalTitleEl = document.getElementById('lbModalTitle');
const lbModalListEl = document.getElementById('lbModalList');
const lbCloseBtnEl = document.getElementById('lbCloseBtn');

export function openHighScoreEntry(prefix, scoreVal, gameLabel){
  pendingHighScore = { prefix, score:scoreVal, gameLabel };
  hsModalScoreEl.textContent = 'SCORE ' + String(scoreVal).padStart(6,'0');
  hsNameInputEl.value = '';
  modalOpen = true;
  hsModalEl.style.display = 'flex';
  setTimeout(()=>hsNameInputEl.focus(), 30);
}

function submitHighScoreEntry(){
  if(!pendingHighScore) return;
  const { prefix, score:scoreVal, gameLabel } = pendingHighScore;
  const list = addToLeaderboard(prefix, hsNameInputEl.value, scoreVal);
  hsModalEl.style.display = 'none';
  pendingHighScore = null;
  openLeaderboard(prefix, gameLabel, list);
}

hsSaveBtnEl.addEventListener('click', submitHighScoreEntry);
hsNameInputEl.addEventListener('keydown', e=>{ e.stopPropagation(); if(e.code==='Enter'){ e.preventDefault(); submitHighScoreEntry(); } });

function renderLeaderboardRows(list){
  lbModalListEl.innerHTML = '';
  if(!list.length){
    const empty = document.createElement('div');
    empty.className = 'lb-empty';
    empty.textContent = 'No scores yet — be the first!';
    lbModalListEl.appendChild(empty);
    return;
  }
  list.forEach((entry,i)=>{
    const row = document.createElement('div');
    row.className = 'lb-row';
    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(i+1);
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.name;
    const sc = document.createElement('span');
    sc.className = 'lb-score';
    sc.textContent = String(entry.score).padStart(6,'0');
    row.append(rank, name, sc);
    lbModalListEl.appendChild(row);
  });
}

export function openLeaderboard(prefix, gameLabel, list){
  list = list || loadLeaderboard(prefix);
  const subjName = SUBJECTS[G.currentSubject] ? SUBJECTS[G.currentSubject].shortName : '';
  lbModalTitleEl.textContent = gameLabel + (subjName ? ' · ' + subjName : '') + ' HIGH SCORES';
  renderLeaderboardRows(list);
  modalOpen = true;
  lbModalEl.style.display = 'flex';
}
function closeLeaderboard(){
  lbModalEl.style.display = 'none';
  modalOpen = false;
}
lbCloseBtnEl.addEventListener('click', closeLeaderboard);
lbModalEl.addEventListener('pointerdown', e=>{ if(e.target===lbModalEl) closeLeaderboard(); });

// ---------- session salary + payment information ----------
// A game can award the player a gross annual salary (Football Penalties: £15,000 per goal). The
// latest award is kept for the browser session by player-session.js:
//   { grossAnnualSalary, goals, perGoal, source, subject, recordedAt }
let sessionSalary = null;
export const formatGBP = (n) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(n);

export function saveSessionSalary(record){
  sessionSalary = record;
  saveSalary(record);
}
export function loadSessionSalary(){
  return sessionSalary || (sessionSalary = getSalary());
}

const payModalEl = document.getElementById('payModal');
const payslipEl = document.getElementById('payslipDoc');
let payslipActions = {};

const money = (n) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', minimumFractionDigits:2 }).format(n);

// "See Payment Information". How the reward is paid depends on the employment status given in
// HMRC Mode's Welcome form — getHmrcUser().employmentStatus from player-session.js (stored under
// sessionStorage 'examhub:hmrcUser'):
//   'Self-employed'                      → the Making Tax Digital app (openMtdApp)
//   'Employed', or no HMRC answers yet   → the PAYE payslip (openPayslip)
// Both offer PLAY AGAIN (`actions.onPlayAgain` restarts the game) and NEXT (back to HMRC Mode).
export function openPaymentInfo(record, actions = {}){
  record = record || loadSessionSalary();
  if(!record) return;
  const user = getHmrcUser();
  if(user && user.employmentStatus === EMPLOYMENT.SELF_EMPLOYED) openMtdApp(record, user, actions);
  else openPayslip(record, actions);
}

const goToHmrcMode = (record) => {
  // Back to the fairground with the same subject; the salary travels in sessionStorage.
  window.location.href = './hmrc-mode.html?subject=' + encodeURIComponent(record.subject || G.currentSubject);
};

// The reward as a paper-style UK payslip (light document look on purpose, in contrast to the
// game's neon HUD). Figures come from calculatePayslip() in payslip.js — illustrative only.
function openPayslip(record, actions){
  payslipActions = actions;
  const slip = calculatePayslip(record.grossAnnualSalary);
  const when = new Date(record.recordedAt);
  const payDate = when.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  // A stable-looking placeholder reference, derived from when the game finished.
  const employeeRef = 'EH-' + String(when.getTime() % 1000000).padStart(6, '0');
  const deductions = [
    ['Income Tax', slip.tax.total],
    ['National Insurance', slip.nationalInsurance.total],
  ];
  if(slip.studentLoan.amount > 0) deductions.push(['Student Loan (Plan 2)', slip.studentLoan.amount]);
  const deductionRows = deductions.map(([name, amount]) =>
    `<tr><td>${name}</td><td class="num">${money(amount)}</td></tr>`).join('');

  payslipEl.innerHTML = `
    <header class="ps-head">
      <div>
        <div class="ps-company">EXAM HUB FC LTD</div>
        <div class="ps-company-sub">Football Penalties Division · Revision Stadium</div>
      </div>
      <div class="ps-doc">
        <div class="ps-doc-title" id="payslipTitle">PAYSLIP</div>
        <div class="ps-doc-sub">Tax year 2024/25</div>
      </div>
    </header>
    <dl class="ps-meta">
      <div><dt>Employee</dt><dd>Player</dd></div>
      <div><dt>Employee ref</dt><dd>${employeeRef}</dd></div>
      <div><dt>Pay period</dt><dd>Annual</dd></div>
      <div><dt>Pay date</dt><dd>${payDate}</dd></div>
      <div><dt>Tax code</dt><dd>1257L</dd></div>
      <div><dt>NI number</dt><dd>QQ 12 34 56 C <span class="ps-note">(example)</span></dd></div>
    </dl>
    <div class="ps-tables">
      <table class="ps-table">
        <caption>Payments</caption>
        <thead><tr><th>Description</th><th class="num">Units</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
        <tbody><tr><td>Goal bonus</td><td class="num">${record.goals}</td><td class="num">${money(record.perGoal)}</td><td class="num">${money(slip.gross)}</td></tr></tbody>
        <tfoot><tr><th colspan="3">Total payments</th><td class="num">${money(slip.gross)}</td></tr></tfoot>
      </table>
      <table class="ps-table">
        <caption>Deductions</caption>
        <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
        <tbody>${deductionRows}</tbody>
        <tfoot><tr><th>Total deductions</th><td class="num">${money(slip.totalDeductions)}</td></tr></tfoot>
      </table>
    </div>
    <div class="ps-net">
      <span class="ps-net-label">NET PAY</span>
      <span class="ps-net-amount">${money(slip.net)}</span>
      <span class="ps-net-month">${money(slip.monthly.net)} per month</span>
    </div>
    <p class="ps-disclaimer">Illustrative figures for game purposes only, using simplified 2024/25 rates — not an HMRC calculation.</p>
    <div class="ps-actions">
      <button type="button" class="ps-btn ps-btn-secondary" id="payAgainBtn">PLAY AGAIN</button>
      <button type="button" class="ps-btn" id="payNextBtn">NEXT →</button>
    </div>`;
  payslipEl.querySelector('#payAgainBtn').addEventListener('click', ()=>{
    closePaymentInfo();
    if(payslipActions.onPlayAgain) payslipActions.onPlayAgain();
  });
  payslipEl.querySelector('#payNextBtn').addEventListener('click', ()=>goToHmrcMode(record));
  modalOpen = true;
  payModalEl.style.display = 'flex';
  payslipEl.scrollTop = 0;
  setTimeout(()=>payslipEl.querySelector('#payNextBtn').focus(), 30);
}
function closePaymentInfo(){
  payModalEl.style.display = 'none';
  modalOpen = false;
}
payModalEl.addEventListener('pointerdown', e=>{ if(e.target===payModalEl) closePaymentInfo(); });
payModalEl.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.preventDefault(); closePaymentInfo(); } });

// ---------- Making Tax Digital app (self-employed players) ----------
// A full-screen, phone-style simulation of HMRC's Making Tax Digital app, shown instead of the
// payslip when the player said they're self-employed. Two views:
//   1. a form — Income (pre-filled with the shootout reward, editable) and Expenses, numbers only;
//      "Send payment to HMRC" stays disabled until both are valid
//   2. a confirmation — the payment sent, worked out by calculateSelfAssessment() in payslip.js on
//      profit = income − expenses
//   3. a "Congrats champ!" page, reached with NEXT from the confirmation
// The bottom bar's PLAY AGAIN restarts the game from any page; NEXT moves confirmation → congrats,
// and otherwise (form, congrats) goes back to HMRC Mode.
// A game simulation — not the real HMRC app, and the figures are illustrative.
const mtdModalEl = document.getElementById('mtdModal');
const mtdScreenEl = document.getElementById('mtdScreen');
const mtdGreetingEl = document.getElementById('mtdGreeting');
const mtdClockEl = document.getElementById('mtdClock');
let mtdPage = 'form'; // 'form' | 'sent' | 'congrats' — which page the phone is showing

// Keeps only a plain amount: digits and one decimal point with up to 2 decimals (no minus signs,
// letters, commas or symbols). Returns the cleaned text.
function cleanAmount(text){
  let out = text.replace(/[^\d.]/g, '');
  const dot = out.indexOf('.');
  if(dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return out.slice(0, 12);
}
const amountValue = (text) => (text === '' || text === '.' ? null : Number(text));

function openMtdApp(record, user, actions){
  mtdGreetingEl.textContent = 'Hello, ' + user.name;
  mtdClockEl.textContent = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  mtdModalEl.querySelector('#mtdAgainBtn').onclick = ()=>{ closeMtdApp(); if(actions.onPlayAgain) actions.onPlayAgain(); };
  mtdModalEl.querySelector('#mtdNextBtn').onclick = ()=>{
    if(mtdPage === 'sent') showMtdCongrats();
    else goToHmrcMode(record);
  };
  showMtdForm(record);
  modalOpen = true;
  mtdModalEl.style.display = 'flex';
  setTimeout(()=>mtdScreenEl.querySelector('#mtdExpenses').focus(), 30);
}

function showMtdForm(record){
  mtdPage = 'form';
  mtdScreenEl.innerHTML = `
    <form class="mtd-card mtd-form" id="mtdForm" novalidate>
      <div>
        <h3>Report your self-employment income</h3>
        <p class="mtd-intro">Tax year 2024/25 · Football Penalties. Enter your figures, then send your payment.</p>
      </div>
      <div class="mtd-field">
        <label for="mtdIncome">Income</label>
        <span class="mtd-hint" id="mtdIncomeHint">What you earned this year. Your shootout earnings: ${record.goals} goal${record.goals === 1 ? '' : 's'} × ${money(record.perGoal)} = ${money(record.grossAnnualSalary)}.</span>
        <div class="mtd-input-wrap"><span class="mtd-currency" aria-hidden="true">£</span>
          <input class="mtd-input" id="mtdIncome" name="income" type="text" inputmode="decimal" autocomplete="off" aria-describedby="mtdIncomeHint mtdIncomeError" value="${record.grossAnnualSalary}"></div>
        <span class="mtd-error" id="mtdIncomeError" aria-live="polite"></span>
      </div>
      <div class="mtd-field">
        <label for="mtdExpenses">Expenses</label>
        <span class="mtd-hint" id="mtdExpensesHint">Allowable business costs, e.g. boots and travel to matches. Enter 0 if you had none.</span>
        <div class="mtd-input-wrap"><span class="mtd-currency" aria-hidden="true">£</span>
          <input class="mtd-input" id="mtdExpenses" name="expenses" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-describedby="mtdExpensesHint mtdExpensesError"></div>
        <span class="mtd-error" id="mtdExpensesError" aria-live="polite"></span>
      </div>
      <div class="mtd-summary"><span>Taxable profit</span><span id="mtdProfit">—</span></div>
      <button type="submit" class="mtd-send" id="mtdSend" disabled>Send payment to HMRC</button>
    </form>
    <p class="mtd-disclaimer">Simulated for game purposes — not the real HMRC app. Illustrative 2024/25 figures, not an HMRC calculation. UTR 12345 67890 is an example.</p>`;
  mtdScreenEl.scrollTop = 0;

  const form = mtdScreenEl.querySelector('#mtdForm');
  // Each field has two independent messages: `chars` (brief — something other than a number was
  // typed and removed) and `rule` (the value itself isn't acceptable). The current one is shown.
  const fields = ['Income', 'Expenses'].map(name => ({
    input: form.querySelector('#mtd' + name),
    error: form.querySelector('#mtd' + name + 'Error'),
    chars: '',
    rule: '',
    timer: null,
  }));
  const showMessage = (field) => {
    field.error.textContent = field.chars || field.rule;
    field.input.parentElement.classList.toggle('invalid', !!field.rule);
  };
  const [income, expenses] = fields;
  const sendBtn = form.querySelector('#mtdSend');
  const profitEl = form.querySelector('#mtdProfit');

  const validate = () => {
    const inc = amountValue(income.input.value);
    const exp = amountValue(expenses.input.value);
    let ok = inc !== null && exp !== null;
    expenses.rule = '';
    if(ok && exp > inc){ ok = false; expenses.rule = 'Expenses can’t be more than your income.'; }
    fields.forEach(showMessage);
    profitEl.textContent = inc !== null ? money(Math.max(0, inc - (exp || 0))) : '—';
    sendBtn.disabled = !ok;
    return ok ? { income: inc, expenses: exp } : null;
  };

  fields.forEach((field) => {
    field.input.addEventListener('input', ()=>{
      const cleaned = cleanAmount(field.input.value);
      if(cleaned !== field.input.value){
        // Something other than a plain amount was typed or pasted: drop it and say why, briefly.
        field.input.value = cleaned;
        field.chars = 'Numbers only — for example 1250 or 1250.50';
        clearTimeout(field.timer);
        field.timer = setTimeout(()=>{ field.chars = ''; showMessage(field); }, 2200);
      }
      validate();
    });
  });

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const values = validate();
    if(values) showMtdConfirmation(record, values);
  });
  validate();
}

function showMtdConfirmation(record, { income, expenses }){
  mtdPage = 'sent';
  const profit = Math.max(0, income - expenses);
  const sa = calculateSelfAssessment(profit);
  const reference = 'XM' + String(Date.now()).slice(-10);
  const row = (label, value, cls = '') => `<div class="mtd-row ${cls}"><span>${label}</span><span>${money(value)}</span></div>`;
  const taxRows = [
    row('Income Tax', sa.tax.total),
    row('Class 4 National Insurance', sa.class4NI.total),
    `<div class="mtd-row"><span>Class 2 National Insurance<small>Not compulsory from 2024/25</small></span><span>${money(sa.class2NI)}</span></div>`,
  ];
  if(sa.studentLoan.amount > 0) taxRows.push(row('Student Loan (Plan 2)', sa.studentLoan.amount));
  mtdScreenEl.innerHTML = `
    <section class="mtd-card mtd-success" role="status">
      <span class="mtd-success-icon" aria-hidden="true">✓</span>
      <div><strong>Payment sent to HMRC</strong><span>${money(sa.totalTax)} for tax year 2024/25 · Reference ${reference}</span></div>
    </section>
    <section class="mtd-card">
      <h3>Self-employment</h3>
      <p class="mtd-muted">Football Penalties · 2024/25</p>
      ${row('Income', income)}
      ${row('Expenses', expenses)}
      ${row('Taxable profit', profit, 'mtd-row-total')}
    </section>
    <section class="mtd-card">
      <h3>Your tax calculation</h3>
      ${taxRows.join('')}
      ${row('Total paid', sa.totalTax, 'mtd-row-total')}
    </section>
    <section class="mtd-card mtd-keep">
      <span>What you keep after tax</span>
      <strong>${money(sa.net)}</strong>
    </section>
    <p class="mtd-disclaimer">Simulated for game purposes — no real payment has been made. Illustrative 2024/25 figures, not an HMRC calculation.</p>`;
  mtdScreenEl.scrollTop = 0;
  mtdModalEl.querySelector('#mtdNextBtn').focus();
}
// The page after the payment confirmation: a success message, then NEXT back to HMRC Mode.
function showMtdCongrats(){
  mtdPage = 'congrats';
  mtdScreenEl.innerHTML = `
    <section class="mtd-card mtd-congrats" role="status">
      <div class="mtd-congrats-icon" aria-hidden="true">
        <svg viewBox="0 0 52 52" width="46" height="46"><path d="M14 27 l8 8 l16 -18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h2 class="mtd-congrats-title">Congrats champ!</h2>
      <p class="mtd-congrats-text">Your tax has been successfully updated</p>
    </section>`;
  mtdScreenEl.scrollTop = 0;
  mtdModalEl.querySelector('#mtdNextBtn').focus();
}

function closeMtdApp(){
  mtdModalEl.style.display = 'none';
  modalOpen = false;
}
mtdModalEl.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.preventDefault(); closeMtdApp(); } });

// ---------- entity spawns (shared particle/popup system, reused by every game mode) ----------
export function spawnExplosionInto(list,x,y,color,count,speed){
  count = count||14; speed = speed||140;
  for(let i=0;i<count;i++){
    const a = rand(0,Math.PI*2), sp = rand(speed*0.3, speed);
    list.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:rand(0.3,0.6), maxLife:0.6, color, size:rand(1.5,3) });
  }
}
export function spawnPopupInto(list,x,y,text,color){
  list.push({ x,y, text, color, life:0.9, maxLife:0.9 });
}
export function updateParticleList(list, dt){
  for(let i=list.length-1;i>=0;i--){
    const p = list[i];
    p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= (1-2*dt); p.vy *= (1-2*dt);
    p.life -= dt;
    if(p.life<=0) list.splice(i,1);
  }
}
export function updatePopupList(list, dt){
  for(let i=list.length-1;i>=0;i--){
    const u = list[i];
    u.y -= 26*dt; u.life -= dt;
    if(u.life<=0) list.splice(i,1);
  }
}
export function drawParticleList(dctx, list){
  for(const p of list){
    dctx.globalAlpha = clamp(p.life/p.maxLife,0,1);
    dctx.fillStyle = p.color;
    dctx.shadowColor = p.color; dctx.shadowBlur = 6;
    dctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  dctx.globalAlpha = 1; dctx.shadowBlur = 0;
}
export function drawPopupList(dctx, list){
  for(const u of list){
    dctx.globalAlpha = clamp(u.life/u.maxLife,0,1);
    drawPixelText(dctx, u.text, u.x, u.y, {scale:2.4, color:u.color, glow:10, fontSize:9});
  }
  dctx.globalAlpha = 1;
}


