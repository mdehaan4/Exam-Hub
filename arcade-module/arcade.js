// Default arcade mode: the space-invaders-style quiz shooter, plus its own game loop.

import {
  ANSWER_DISPLAY_H, ANSWER_DISPLAY_W, ANSWER_SPRITE, COLORS, DECOY_SPRITE, LOGICAL_H, LOGICAL_W,
  PLAYER_DISPLAY_H, PLAYER_DISPLAY_W, PLAYER_SPRITES, REDUCED_MOTION, SHADE, SUBJECTS,
  clamp, ctx, drawAnswerLabel, drawEarthBackdrop, drawParticleList, drawPixelText, drawPopupList,
  drawSpriteCentered, drawStars, ensureAudio, hexToRgba, hitFlashEl, loadHighScore, modalOpen,
  openHighScoreEntry, openLeaderboard, pctOf, qualifiesForLeaderboard, rand, resizeCanvas, saveHighScore,
  screenWrap, sfx, shuffleAnswerOptions, shuffleArray, spawnExplosionInto, spawnPopupInto,
  updateParticleList, updatePopupList, updateStars, G,
} from './shared.js?v=15';
import { forestScreenEl, renderForest, updateForest } from './forest.js?v=15';
import { stopExamTimer } from './exam.js?v=15';
import { btnPenHint, renderPenalty, updatePenalty } from './penalty.js?v=15';
import { btnPacHint, renderPacman, updatePacman } from './pacman.js?v=15';
import { raceCleanupConnection, raceScreenEl } from './race.js?v=15';

// ---------- game state ----------
let state = 'title'; // title, question, resolve, paused, complete
let prevState = 'question';
let stateTimer = 0;
let score = 0, streak = 0, correctCount = 0;
let highScore = 0;

const player = { x:LOGICAL_W/2, y:700, speed:300, cooldown:0, thrust:0, kills:0, weaponLevel:1 };
const KILL_THRESHOLDS = [0, 2, 4, 6, 8];
const BULLET_SPEED = 560;
function weaponLevelForKills(k){
  let lvl = 1;
  for(let i=0;i<KILL_THRESHOLDS.length;i++){ if(k>=KILL_THRESHOLDS[i]) lvl = i+1; }
  return lvl;
}
function maxBulletsForLevel(lvl){ return [3,4,8,10,14][clamp(lvl-1,0,4)]; }
function cooldownForLevel(lvl){ return [0.22,0.19,0.16,0.15,0.13][clamp(lvl-1,0,4)]; }
function registerKill(){
  player.kills += 1;
  const lvl = weaponLevelForKills(player.kills);
  if(lvl > player.weaponLevel){
    player.weaponLevel = lvl;
    spawnPopup(player.x, player.y - PLAYER_DISPLAY_H[lvl-1]/2 - 12, 'WEAPON LV.'+lvl, COLORS.amber);
    sfx.weaponUp();
    addShake(4);
    updateHud();
  }
}
let playerBullets = [];
let particles = [], popups = [];
let shake = 0;

let quizOrder = [];
let qIndex = 0;
let formationShips = [];
let lastResult = 'correct'; // correct, wrong, timeout

const FORMATION_ROWS = 4;
const FORMATION_COLS = 4;
const FORMATION_MARGIN = 90;
const FORMATION_CELL_W = (LOGICAL_W - FORMATION_MARGIN*2) / (FORMATION_COLS-1);
const FORMATION_CELL_H = 84;
const FORMATION_TOP_Y = 120;
const TOO_CLOSE_Y = 560;
export const QUESTIONS_PER_RUN = 10;
const formation = { originX:FORMATION_MARGIN, originY:FORMATION_TOP_Y, offsetX:0, offsetY:0, dir:1, moveTimer:0, stepX:12, dropY:18, animFrame:0 };

export const input = { left:false, right:false, fire:false };

function shipPos(s){
  return {
    x: formation.originX + s.col*FORMATION_CELL_W + formation.offsetX,
    y: formation.originY + s.row*FORMATION_CELL_H + formation.offsetY,
  };
}

function loadQuestion(n){
  const q = SUBJECTS[G.currentSubject].questions[quizOrder[n]];
  const answerOpts = shuffleAnswerOptions(q);
  // one unique column per row, so two answer ships (right or wrong) never stack
  // in the same column and block a shot to the one above
  const answerCols = shuffleArray(Array.from({length:FORMATION_COLS}, (_,i)=>i));

  formation.offsetX = 0; formation.offsetY = 0; formation.dir = 1; formation.moveTimer = 0; formation.animFrame = 0;
  formationShips = [];
  for(let row=0; row<FORMATION_ROWS; row++){
    const answerCol = answerCols[row % answerCols.length];
    for(let col=0; col<FORMATION_COLS; col++){
      const isAnswer = col===answerCol;
      const o = answerOpts[row];
      formationShips.push({
        row, col,
        decoy: !isAnswer,
        text: isAnswer ? o.text : '',
        correct: isAnswer ? o.correct : false,
        revealed: false,
        alive: true,
        bobPhase: (row*FORMATION_COLS+col)*0.7 + Math.random()*2,
      });
    }
  }
  qTextEl.textContent = q.q;
  qNumEl.textContent = String(n+1).padStart(2,'0') + ' / ' + String(quizOrder.length).padStart(2,'0');
}

function resetGame(){
  score = 0; streak = 0; correctCount = 0;
  player.x = LOGICAL_W/2;
  player.kills = 0; player.weaponLevel = 1;
  playerBullets = []; particles = []; popups = [];
  quizOrder = shuffleArray(Array.from({length:SUBJECTS[G.currentSubject].questions.length}, (_,i)=>i)).slice(0, QUESTIONS_PER_RUN);
  qIndex = 0;
  loadQuestion(0);
  updateHud();
  state = 'question';
}


function spawnExplosion(x,y,color,count,speed){ spawnExplosionInto(particles,x,y,color,count,speed); }
function spawnPopup(x,y,text,color){ spawnPopupInto(popups,x,y,text,color); }
function addShake(v){ shake = Math.min(shake+v, 16); }
// ---------- quiz resolution ----------
function clearRestOfFormation(exceptShip){
  for(const s of formationShips){
    if(!s.alive || s === exceptShip) continue;
    const p = shipPos(s);
    spawnExplosion(p.x, p.y, s.decoy?SHADE.decoy:SHADE.violetDark, 6, 60);
  }
}

function resolveAnswer(hitShip){
  const correct = hitShip.correct;
  lastResult = correct ? 'correct' : 'wrong';
  const hp = shipPos(hitShip);

  clearRestOfFormation(hitShip);
  spawnExplosion(hp.x, hp.y, correct?COLORS.phosphor:COLORS.signal, correct?22:18, correct?190:160);
  spawnPopup(hp.x, hp.y-22, correct?'CORRECT +100':'INCORRECT', correct?COLORS.phosphor:COLORS.signal);
  sfx[correct?'correct':'wrong']();
  playerBullets = [];

  if(correct){
    score += 100;
    correctCount += 1;
    streak += 1;
    registerKill();
    formationShips = [];
    stateTimer = 1.1;
  } else {
    streak = 0;
    addShake(12);
    flashHit();
    const correctShip = formationShips.find(s=>s.correct);
    formationShips = correctShip ? [correctShip] : [];
    if(correctShip){
      correctShip.revealed = true;
      const cp = shipPos(correctShip);
      spawnPopup(cp.x, cp.y-22, 'CORRECT ANSWER', COLORS.phosphor);
    }
    stateTimer = 2.3;
  }
  updateHud();
  state = 'resolve';
}

function resolveTimeout(){
  lastResult = 'timeout';
  streak = 0;
  addShake(14);
  flashHit();
  sfx.wrong();
  spawnPopup(player.x, player.y - PLAYER_DISPLAY_H[player.weaponLevel-1]/2 - 14, 'TOO SLOW', COLORS.signal);
  clearRestOfFormation(null);
  const correctShip = formationShips.find(s=>s.correct);
  formationShips = correctShip ? [correctShip] : [];
  if(correctShip){
    correctShip.revealed = true;
    const cp = shipPos(correctShip);
    spawnPopup(cp.x, cp.y-22, 'CORRECT ANSWER', COLORS.phosphor);
  }
  playerBullets = [];
  updateHud();
  stateTimer = 2.3;
  state = 'resolve';
}

function finishGame(){
  highScore = Math.max(highScore, score);
  saveHighScore('', highScore);
  formationShips = [];
  updateHud();
  sfx.complete();
  state = 'complete';
  if(qualifiesForLeaderboard('', score)) openHighScoreEntry('', score, 'INVADERS');
}

function flashHit(){
  hitFlashEl.style.transition = 'none';
  hitFlashEl.style.opacity = '1';
  requestAnimationFrame(()=>{
    hitFlashEl.style.transition = 'opacity .4s ease-out';
    hitFlashEl.style.opacity = '0';
  });
}

// ---------- input ----------
window.addEventListener('keydown', e=>{
  if(G.appMode!=='arcade' || modalOpen) return;
  ensureAudio();
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left = true;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right = true;
  if(e.code==='Space') input.fire = true;
  if(e.code==='KeyP') togglePause();
  if(e.code==='KeyM') toggleMute();
  if(e.code==='KeyH') toggleHint();
  if(e.code==='Enter'){
    if(state==='title'||state==='complete') resetGame();
  }
});
window.addEventListener('keyup', e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left = false;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right = false;
  if(e.code==='Space') input.fire = false;
});

function bindHold(el, onDown, onUp){
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); ensureAudio(); onDown(); });
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointerleave', onUp);
  el.addEventListener('pointercancel', onUp);
}
bindHold(document.getElementById('btnLeft'), ()=>input.left=true, ()=>input.left=false);
bindHold(document.getElementById('btnRight'), ()=>input.right=true, ()=>input.right=false);
bindHold(document.getElementById('btnFire'), ()=>input.fire=true, ()=>input.fire=false);

screenWrap.addEventListener('pointerdown', ()=>{
  if(G.appMode!=='arcade' || modalOpen) return;
  ensureAudio();
  if(state==='title'||state==='complete') resetGame();
});

export const btnMute = document.getElementById('btnMute');
const btnPause = document.getElementById('btnPause');
const btnHint = document.getElementById('btnHint');
function toggleMute(){ G.muted = !G.muted; btnMute.textContent = 'SND: ' + (G.muted?'OFF':'ON'); }
function togglePause(){
  if(state==='question'||state==='resolve'){ prevState=state; state='paused'; btnPause.textContent='RESUME'; }
  else if(state==='paused'){ state=prevState; btnPause.textContent='PAUSE'; }
}
export function toggleHint(){
  G.debugReveal = !G.debugReveal;
  const label = 'HINT: ' + (G.debugReveal?'ON':'OFF');
  btnHint.textContent = label;
  if(btnPacHint) btnPacHint.textContent = label;
  if(btnPenHint) btnPenHint.textContent = label;
}
btnMute.addEventListener('click', toggleMute);
btnPause.addEventListener('click', ()=>{ ensureAudio(); togglePause(); });
btnHint.addEventListener('click', toggleHint);
document.getElementById('btnScores').addEventListener('click', ()=>{ ensureAudio(); openLeaderboard('', 'INVADERS'); });

// ---------- HUD ----------
export const scoreEl = document.getElementById('scoreVal');
const highEl = document.getElementById('highVal');
const streakEl = document.getElementById('streakVal');
const wpnEl = document.getElementById('wpnVal');
const qTextEl = document.getElementById('qText');
const qNumEl = document.getElementById('qNum');
function updateHud(){
  scoreEl.textContent = String(score).padStart(6,'0');
  highEl.textContent = String(Math.max(score,highScore)).padStart(6,'0');
  streakEl.textContent = String(streak);
  wpnEl.textContent = 'LV.' + player.weaponLevel;
}

// ---------- drawing helpers ----------
function shipIsHighlighted(ship){
  return !ship.decoy && (ship.revealed || (G.debugReveal && ship.correct));
}

// sprites for every ship are drawn first, labels are drawn in a second pass afterward —
// this guarantees a decoy in a neighboring row can never paint over another row's answer text
function drawFormationShipSprite(ship, t){
  const pos = shipPos(ship);
  const march = formation.animFrame===1 ? 2 : 0;
  const bob = REDUCED_MOTION ? 0 : Math.sin(t*0.002 + ship.bobPhase)*3;
  const y = pos.y + bob + march*0.5;
  ship._drawX = pos.x;
  ship._drawY = y;

  if(ship.decoy){
    drawSpriteCentered(ctx, DECOY_SPRITE, pos.x, y, ANSWER_DISPLAY_W*0.88, SHADE.decoy, 7);
    return;
  }

  const highlighted = shipIsHighlighted(ship);
  if(highlighted){
    ctx.save();
    ctx.strokeStyle = COLORS.phosphor;
    ctx.shadowColor = COLORS.phosphor; ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    const pulse = 4 + Math.sin(t*0.008)*2;
    ctx.beginPath();
    ctx.arc(pos.x, y, ANSWER_DISPLAY_W*0.62+pulse, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
  const glow = highlighted ? COLORS.phosphor : COLORS.violet;
  drawSpriteCentered(ctx, ANSWER_SPRITE, pos.x, y, ANSWER_DISPLAY_W, glow, 14);
}

function drawFormationShipLabel(ship){
  if(ship.decoy) return;
  const highlighted = shipIsHighlighted(ship);
  drawAnswerLabel(ship.text, ship._drawX, ship._drawY + ANSWER_DISPLAY_H/2 + 10, 136, highlighted?COLORS.phosphor:COLORS.ink);
}

function drawPlayer(){
  const {x,y} = player;
  const lvl = clamp(player.weaponLevel,1,5);
  const overcharged = lvl>=5;
  if(player.thrust>0){
    const flameLen = 7+Math.random()*11+(lvl-1);
    const flameW = 6 + (lvl-1)*1.6;
    const flameColor = overcharged ? '#e8d9ff' : COLORS.amber;
    ctx.save();
    ctx.shadowColor = flameColor; ctx.shadowBlur = 10;
    ctx.fillStyle = hexToRgba(flameColor,0.85);
    const fy = y + PLAYER_DISPLAY_H[lvl-1]/2 - 3;
    ctx.beginPath();
    ctx.moveTo(x-flameW, fy); ctx.lineTo(x, fy+flameLen); ctx.lineTo(x+flameW, fy);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const glowColor = overcharged ? COLORS.violet : COLORS.phosphor;
  drawSpriteCentered(ctx, PLAYER_SPRITES[lvl-1], x, y, PLAYER_DISPLAY_W[lvl-1], glowColor, 14+lvl*1.5);
}

function drawBullet(b, color){
  const w = b.w || 2.4;
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 7+w*2.2;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y-6-w); ctx.lineTo(b.x, b.y+6);
  ctx.stroke();
  if(b.pierce){
    ctx.strokeStyle = COLORS.ink; ctx.lineWidth = Math.max(1,w-2);
    ctx.beginPath(); ctx.moveTo(b.x,b.y-4-w); ctx.lineTo(b.x,b.y+3); ctx.stroke();
  }
  ctx.restore();
}

function drawRocketBullet(b, color){
  const angle = Math.atan2(b.vy, b.vx||0.0001);
  const len = 9 + (b.w||4)*1.6;
  const wid = 3 + (b.w||4)*0.9;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle + Math.PI/2);

  const flick = 0.65 + Math.random()*0.5;
  ctx.shadowColor = COLORS.amber; ctx.shadowBlur = 9;
  ctx.fillStyle = hexToRgba(COLORS.amber, 0.85*flick);
  ctx.beginPath();
  ctx.moveTo(-wid*0.35, len*0.32);
  ctx.lineTo(0, len*0.32 + 7*flick);
  ctx.lineTo(wid*0.35, len*0.32);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = color; ctx.shadowBlur = 9;
  ctx.fillStyle = hexToRgba(color, 0.92);
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -len*0.55);
  ctx.lineTo(wid*0.42, -len*0.05);
  ctx.lineTo(wid*0.42, len*0.24);
  ctx.lineTo(wid*0.85, len*0.34);
  ctx.lineTo(wid*0.3, len*0.2);
  ctx.lineTo(-wid*0.3, len*0.2);
  ctx.lineTo(-wid*0.85, len*0.34);
  ctx.lineTo(-wid*0.42, len*0.24);
  ctx.lineTo(-wid*0.42, -len*0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(-wid*0.12, -len*0.4, wid*0.24, len*0.35);
  if(b.pierce){
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(0, -len*0.5, 1.6, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// ---------- update ----------
function firePlayer(){
  if(player.cooldown>0) return;
  const lvl = player.weaponLevel;
  if(playerBullets.length >= maxBulletsForLevel(lvl)) return;

  const y0 = player.y - PLAYER_DISPLAY_H[lvl-1]/2 + 6;
  const kind = lvl>=4 ? 'rocket' : 'laser';
  const color = lvl>=5 ? COLORS.violet : (lvl>=4 ? COLORS.amber : COLORS.phosphor);
  const mk = (x,vx,w,pierce) => playerBullets.push({ x, y:y0, vx:vx||0, vy:-BULLET_SPEED-lvl*10, w:w||3, pierce:pierce||0, kind, color });

  if(lvl===1){
    mk(player.x, 0, 3);
  } else if(lvl===2){
    mk(player.x, 0, 4);
  } else if(lvl===3){
    mk(player.x-7, 0, 3);
    mk(player.x+7, 0, 3);
  } else if(lvl===4){
    mk(player.x, 0, 5);
    mk(player.x-10, -60, 4);
    mk(player.x+10, 60, 4);
  } else {
    mk(player.x-12, -45, 5, 1);
    mk(player.x-4, 0, 6, 1);
    mk(player.x+4, 0, 6, 1);
    mk(player.x+12, 45, 5, 1);
  }
  player.cooldown = cooldownForLevel(lvl);
  sfx.shoot(lvl);
}

function currentMoveInterval(){
  const total = formationShips.length;
  const alive = formationShips.reduce((n,s)=>n+(s.alive?1:0),0);
  const frac = Math.max(alive/Math.max(total,1), 0.15);
  return Math.max(220, 620*frac);
}

function updateFormation(dt){
  formation.moveTimer -= dt*1000;
  if(formation.moveTimer > 0) return;
  formation.moveTimer = currentMoveInterval();
  formation.animFrame = 1-formation.animFrame;
  sfx.step(formation.animFrame===1);

  let minX = Infinity, maxX = -Infinity;
  for(const s of formationShips){
    if(!s.alive) continue;
    const p = shipPos(s);
    if(p.x < minX) minX = p.x;
    if(p.x > maxX) maxX = p.x;
  }
  if(minX===Infinity) return;

  const proposedX = formation.offsetX + formation.dir*formation.stepX;
  const shift = proposedX - formation.offsetX;
  const newMin = minX+shift, newMax = maxX+shift;
  if(newMin < 30 || newMax > LOGICAL_W-30){
    formation.dir *= -1;
    formation.offsetY += formation.dropY;
  } else {
    formation.offsetX = proposedX;
  }

  const bottomRowY = formation.originY + (FORMATION_ROWS-1)*FORMATION_CELL_H + formation.offsetY;
  if(bottomRowY >= TOO_CLOSE_Y){
    resolveTimeout();
  }
}

function update(dt){
  updateStars(dt);

  if(shake>0){ shake = Math.max(0, shake - dt*40); }

  updateParticleList(particles, dt);
  updatePopupList(popups, dt);

  if(state==='paused') return;
  if(state==='title') return;
  if(state==='complete') return;

  if(state==='resolve'){
    stateTimer -= dt;
    if(stateTimer<=0){
      if(qIndex+1 >= quizOrder.length){ finishGame(); }
      else { qIndex += 1; loadQuestion(qIndex); state='question'; }
    }
    return;
  }

  if(state!=='question') return;

  player.thrust = 0;
  if(input.left){ player.x -= player.speed*dt; player.thrust=1; }
  if(input.right){ player.x += player.speed*dt; player.thrust=1; }
  player.x = clamp(player.x, 24, LOGICAL_W-24);
  if(player.cooldown>0) player.cooldown -= dt;
  if(input.fire) firePlayer();

  updateFormation(dt);
  if(state!=='question') return;

  for(let i=playerBullets.length-1;i>=0;i--){
    const b = playerBullets[i];
    b.x += (b.vx||0)*dt;
    b.y += b.vy*dt;
    if(b.y < -10 || b.x < -20 || b.x > LOGICAL_W+20){ playerBullets.splice(i,1); continue; }
    if(b.kind==='rocket' && Math.random()<0.7){
      particles.push({ x:b.x+(Math.random()-0.5)*3, y:b.y+7, vx:(Math.random()-0.5)*12, vy:50, life:0.22, maxLife:0.22, color:COLORS.amber, size:rand(1,2.2) });
    }
    for(const ship of formationShips){
      if(!ship.alive) continue;
      const p = shipPos(ship);
      if(Math.abs(b.x-p.x)<18 && Math.abs(b.y-p.y)<14){
        playerBullets.splice(i,1);
        if(ship.decoy){
          ship.alive = false;
          spawnExplosion(p.x, p.y, SHADE.decoy, 8, 90);
          sfx.decoyPop();
        } else {
          resolveAnswer(ship);
          return;
        }
        break;
      }
    }
  }
}

// ---------- render ----------
function render(){
  const t = performance.now();
  ctx.save();
  ctx.clearRect(0,0,LOGICAL_W,LOGICAL_H);
  if(shake>0){
    ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  }
  drawStars();
  drawEarthBackdrop();

  if(state==='question'||state==='resolve'||state==='paused'){
    for(const ship of formationShips){ if(ship.alive) drawFormationShipSprite(ship, t); }
    for(const ship of formationShips){ if(ship.alive) drawFormationShipLabel(ship); }
  }

  if(state==='question'){
    for(const b of playerBullets){
      if(b.kind==='rocket') drawRocketBullet(b, b.color); else drawBullet(b, b.color);
    }
  }

  if(state==='question'||state==='resolve'||state==='paused'){
    drawPlayer();
  }

  drawParticleList(ctx, particles);
  drawPopupList(ctx, popups);

  if(state==='title'){
    drawPixelText(ctx, 'PRESS ENTER', LOGICAL_W/2, LOGICAL_H-160, {scale:3.6, color:COLORS.phosphor, glow:20, fontSize:12});
    if(Math.floor(performance.now()/500)%2===0){
      drawPixelText(ctx, 'TO BEGIN REVISION', LOGICAL_W/2, LOGICAL_H-124, {scale:2.4, color:COLORS.ink, glow:8, fontSize:10});
    }
    drawPixelText(ctx, QUESTIONS_PER_RUN + ' QUESTIONS', LOGICAL_W/2, LOGICAL_H-84, {scale:2.4, color:COLORS.violet, glow:10, fontSize:10});
    drawPixelText(ctx, 'HIGH SCORE ' + String(highScore).padStart(6,'0'), LOGICAL_W/2, LOGICAL_H-48, {scale:2.0, color:COLORS.amber, glow:8, fontSize:9});
  }

  if(state==='resolve'){
    const label = lastResult==='correct' ? 'CORRECT' : (lastResult==='timeout' ? 'TOO SLOW' : 'INCORRECT');
    const rColor = lastResult==='correct' ? COLORS.phosphor : COLORS.signal;
    drawPixelText(ctx, label, LOGICAL_W/2, 350, {scale: lastResult==='correct'?5:4.4, color: rColor, glow:26, fontSize:14});
  }

  if(state==='paused'){
    drawPixelText(ctx, 'PAUSED', LOGICAL_W/2, LOGICAL_H/2, {scale:5.5, color:COLORS.ink, glow:20, fontSize:14});
  }

  if(state==='complete'){
    const pct = pctOf(correctCount, quizOrder.length);
    drawPixelText(ctx, 'REVISION COMPLETE', LOGICAL_W/2, LOGICAL_H/2-60, {scale:4.2, color:COLORS.phosphor, glow:24, fontSize:13});
    drawPixelText(ctx, 'SCORE ' + String(score).padStart(6,'0'), LOGICAL_W/2, LOGICAL_H/2-10, {scale:2.6, color:COLORS.ink, glow:10, fontSize:10});
    drawPixelText(ctx, correctCount + ' / ' + quizOrder.length + ' CORRECT (' + pct + '%)', LOGICAL_W/2, LOGICAL_H/2+20, {scale:2.3, color:COLORS.amber, glow:10, fontSize:9});
    drawPixelText(ctx, pct>=75?'READY FOR THE EXAM':'KEEP STUDYING', LOGICAL_W/2, LOGICAL_H/2+48, {scale:2.2, color: pct>=75?COLORS.phosphor:COLORS.signal, glow:10, fontSize:9});
    if(Math.floor(performance.now()/500)%2===0){
      drawPixelText(ctx, 'PRESS ENTER TO RETRY', LOGICAL_W/2, LOGICAL_H/2+88, {scale:2.0, color:COLORS.ink, glow:8, fontSize:9});
    }
  }

  ctx.restore();
}

// ---------- main loop ----------
let last = performance.now();
export function frame(now){
  const dt = Math.min((now-last)/1000, 0.05);
  last = now;
  if(G.appMode==='arcade'){
    update(dt);
    render();
  } else if(G.appMode==='penalty'){
    updatePenalty(dt);
    renderPenalty();
  } else if(G.appMode==='pacman'){
    updatePacman(dt);
    renderPacman();
  } else if(G.appMode==='forest'){
    updateForest(dt);
    renderForest();
  }
  requestAnimationFrame(frame);
}

// ---------- screen / mode switching ----------
const hubScreenEl = document.getElementById('hubScreen');
export const examScreenEl = document.getElementById('examScreen');
const cabinetEl = document.getElementById('cabinet');
const penaltyScreenEl = document.getElementById('penaltyScreen');
const pacScreenEl = document.getElementById('pacScreen');
const marqueeEl = document.querySelector('#cabinet .marquee-title');
const subtitleEl = document.querySelector('#cabinet .subtitle');

export function showScreen(name){
  G.appMode = name;
  hubScreenEl.style.display = name==='hub' ? 'flex' : 'none';
  cabinetEl.style.display = name==='arcade' ? 'flex' : 'none';
  examScreenEl.style.display = name==='exam' ? 'flex' : 'none';
  penaltyScreenEl.style.display = name==='penalty' ? 'flex' : 'none';
  pacScreenEl.style.display = name==='pacman' ? 'flex' : 'none';
  forestScreenEl.style.display = name==='forest' ? 'flex' : 'none';
  raceScreenEl.style.display = name==='race' ? 'flex' : 'none';
  document.body.classList.toggle('mode-arcade', name==='arcade' || name==='penalty' || name==='pacman');
  document.body.classList.toggle('mode-exam', name==='exam');
}

export function goToHub(){
  stopExamTimer();
  raceCleanupConnection();
  showScreen('hub');
}

export function startArcade(subjectKey){
  G.currentSubject = subjectKey;
  const subj = SUBJECTS[subjectKey];
  marqueeEl.textContent = subj.invaderTitle;
  marqueeEl.setAttribute('data-text', subj.invaderTitle);
  subtitleEl.textContent = subj.shortName + ' · MOCK REVISION';
  highScore = loadHighScore('');
  score = 0; streak = 0; correctCount = 0;
  player.weaponLevel = 1; player.kills = 0;
  state = 'title';
  updateHud();
  showScreen('arcade');
  resizeCanvas();
}

