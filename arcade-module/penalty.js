// Penalty shootout mode: quiz-driven penalty kicks.

import {
  COLORS, FONT_MONO, SUBJECTS, clamp, drawParticleList, drawPixelText, drawPopupList, ensureAudio,
  hexToRgba, loadHighScore, modalOpen, openHighScoreEntry, openLeaderboard, pctOf,
  qualifiesForLeaderboard, roundRect, saveHighScore, sfx, shuffleAnswerOptions, shuffleArray,
  spawnExplosionInto, spawnPopupInto, updateParticleList, updatePopupList, G,
} from './shared.js';
import { btnMute, goToHub, showScreen, toggleHint } from './arcade.js';

// ---------- penalty shootout mode ----------
const PEN_LOGICAL_W = 600, PEN_LOGICAL_H = 440;
const PENALTY_SHOTS = 5;
const PEN_FLIGHT_TIME = 0.5;
const GOAL = { x:110, y:70, w:380, h:150 };
const KEEPER_HOME = { x:300, y:GOAL.y+GOAL.h-6 };
const KICK_SPOT = { x:300, y:390 };

function penZoneCenter(i){
  const col = i % 2, row = Math.floor(i/2);
  return {
    x: GOAL.x + GOAL.w * (col===0 ? 0.24 : 0.76),
    y: GOAL.y + GOAL.h * (row===0 ? 0.3 : 0.75),
  };
}

const penCanvas = document.getElementById('penCanvas');
const penCtx = penCanvas.getContext('2d');
const penScreenWrapEl = document.getElementById('penScreenWrap');
const penHitFlashEl = document.getElementById('penHitFlash');
const penSubtitleEl = document.getElementById('penSubtitle');
const penScoreEl = document.getElementById('penScoreVal');
const penHighEl = document.getElementById('penHighVal');
const penStreakEl = document.getElementById('penStreakVal');
const penShotValEl = document.getElementById('penShotVal');
const penQTextEl = document.getElementById('penQText');
const penQNumEl = document.getElementById('penQNum');
const btnPenMute = document.getElementById('btnPenMute');
export const btnPenHint = document.getElementById('btnPenHint');
const btnPenHubBtn = document.getElementById('btnPenHub');

export function resizePenaltyCanvas(){
  const rect = penScreenWrapEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  penCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  penCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  penCtx.setTransform(
    (penCanvas.width / PEN_LOGICAL_W), 0, 0,
    (penCanvas.height / PEN_LOGICAL_H), 0, 0
  );
}

let penState = 'title'; // title, aim, flight, resolve, complete
let penScore = 0, penStreak = 0, penCorrect = 0, penHighScore = 0;
let penQuizOrder = [], penIndex = 0, penOptions = [];
let penSelectedZone = 0, penShotZone = -1, penShotCorrect = false, penKeeperTargetZone = 0;
let penFlightT = 0, penStateTimer = 0, penShake = 0;
let penParticles = [], penPopups = [];

function updatePenaltyHud(){
  penScoreEl.textContent = String(penScore).padStart(6,'0');
  penHighEl.textContent = String(Math.max(penScore,penHighScore)).padStart(6,'0');
  penStreakEl.textContent = String(penStreak);
  penShotValEl.textContent = Math.min(penIndex+1, PENALTY_SHOTS) + '/' + PENALTY_SHOTS;
}

function loadPenaltyQuestion(n){
  const q = SUBJECTS[G.currentSubject].questions[penQuizOrder[n]];
  penOptions = shuffleAnswerOptions(q);
  penShotZone = -1;
  penSelectedZone = 0;
  penQTextEl.textContent = q.q;
  penQNumEl.textContent = String(n+1).padStart(2,'0') + ' / ' + String(penQuizOrder.length).padStart(2,'0');
}

function resetPenalty(){
  penScore = 0; penStreak = 0; penCorrect = 0;
  penParticles = []; penPopups = [];
  penQuizOrder = shuffleArray(Array.from({length:SUBJECTS[G.currentSubject].questions.length}, (_,i)=>i)).slice(0, PENALTY_SHOTS);
  penIndex = 0;
  loadPenaltyQuestion(0);
  updatePenaltyHud();
  penState = 'aim';
}

function flashPenHit(){
  penHitFlashEl.style.transition = 'none';
  penHitFlashEl.style.opacity = '1';
  requestAnimationFrame(()=>{
    penHitFlashEl.style.transition = 'opacity .4s ease-out';
    penHitFlashEl.style.opacity = '0';
  });
}

function takeShot(zoneIndex){
  if(penState!=='aim') return;
  ensureAudio();
  penSelectedZone = zoneIndex;
  penShotZone = zoneIndex;
  const chosen = penOptions[zoneIndex];
  penShotCorrect = !!(chosen && chosen.correct);
  const others = [0,1,2,3].filter(i=>i!==zoneIndex);
  penKeeperTargetZone = penShotCorrect ? others[Math.floor(Math.random()*others.length)] : zoneIndex;
  penFlightT = 0;
  penState = 'flight';
  sfx.kick();
}

function resolvePenaltyShot(){
  const correct = penShotCorrect;
  const zonePos = penZoneCenter(penShotZone);
  if(correct){
    penScore += 100;
    penCorrect += 1;
    penStreak += 1;
    spawnExplosionInto(penParticles, zonePos.x, zonePos.y, COLORS.phosphor, 22, 190);
    spawnPopupInto(penPopups, zonePos.x, zonePos.y-24, 'GOAL! +100', COLORS.phosphor);
    sfx.correct();
  } else {
    penStreak = 0;
    penShake = 12;
    flashPenHit();
    spawnExplosionInto(penParticles, zonePos.x, zonePos.y, COLORS.signal, 14, 140);
    spawnPopupInto(penPopups, zonePos.x, zonePos.y-24, 'SAVED', COLORS.signal);
    const correctIdx = penOptions.findIndex(o=>o.correct);
    if(correctIdx>=0){
      const cp = penZoneCenter(correctIdx);
      spawnPopupInto(penPopups, cp.x, cp.y-24, 'CORRECT ANSWER', COLORS.phosphor);
    }
    sfx.wrong();
  }
  updatePenaltyHud();
  penState = 'resolve';
  penStateTimer = correct ? 1.3 : 2.3;
}

function finishPenalty(){
  penHighScore = Math.max(penHighScore, penScore);
  saveHighScore('penalty_', penHighScore);
  updatePenaltyHud();
  sfx.complete();
  penState = 'complete';
  if(qualifiesForLeaderboard('penalty_', penScore)) openHighScoreEntry('penalty_', penScore, 'PENALTY SHOOTOUT');
}

export function updatePenalty(dt){
  updateParticleList(penParticles, dt);
  updatePopupList(penPopups, dt);
  if(penShake>0) penShake = Math.max(0, penShake - dt*40);

  if(penState==='flight'){
    penFlightT += dt;
    if(penFlightT >= PEN_FLIGHT_TIME){
      penFlightT = PEN_FLIGHT_TIME;
      resolvePenaltyShot();
    }
    return;
  }
  if(penState==='resolve'){
    penStateTimer -= dt;
    if(penStateTimer<=0){
      if(penIndex+1 >= penQuizOrder.length) finishPenalty();
      else { penIndex += 1; loadPenaltyQuestion(penIndex); penState = 'aim'; }
    }
  }
}

export function wrapTextLines(dctx, text, maxWidth){
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for(const w of words){
    const test = cur ? cur+' '+w : w;
    if(dctx.measureText(test).width > maxWidth && cur){ lines.push(cur); cur = w; }
    else cur = test;
  }
  if(cur) lines.push(cur);
  return lines;
}

function drawPenaltySky(dctx){
  const grad = dctx.createLinearGradient(0,0,0,GOAL.y+GOAL.h+20);
  grad.addColorStop(0, '#0a1224');
  grad.addColorStop(1, '#132038');
  dctx.fillStyle = grad;
  dctx.fillRect(0,0,PEN_LOGICAL_W, GOAL.y+GOAL.h+20);

  [90, 300, 510].forEach(fx=>{
    const g = dctx.createRadialGradient(fx,20,4, fx,20,140);
    g.addColorStop(0,'rgba(255,250,220,0.35)');
    g.addColorStop(1,'rgba(255,250,220,0)');
    dctx.fillStyle = g;
    dctx.fillRect(fx-140,-40,280,220);
  });

  dctx.save();
  dctx.filter = 'blur(1.5px)';
  dctx.fillStyle = 'rgba(6,9,20,0.9)';
  dctx.fillRect(0,40,PEN_LOGICAL_W,18);
  dctx.fillStyle = 'rgba(20,26,46,0.9)';
  const cw = PEN_LOGICAL_W/40;
  for(let i=0;i<40;i++){
    const h = 6 + (Math.sin(i*1.7)+1)*5;
    dctx.fillRect(i*cw, 58-h, cw-1, h);
  }
  dctx.restore();
}

function drawPenaltyPitch(dctx){
  const topY = GOAL.y+GOAL.h-10;
  const grad = dctx.createLinearGradient(0,topY,0,PEN_LOGICAL_H);
  grad.addColorStop(0,'#2c7a44');
  grad.addColorStop(0.55,'#3d9c58');
  grad.addColorStop(1,'#2a7440');
  dctx.fillStyle = grad;
  dctx.fillRect(0,topY,PEN_LOGICAL_W,PEN_LOGICAL_H-topY);

  dctx.save();
  dctx.beginPath();
  dctx.rect(0,topY,PEN_LOGICAL_W,PEN_LOGICAL_H-topY);
  dctx.clip();
  const bands = 7;
  for(let i=0;i<bands;i++){
    const f0 = i/bands, f1 = (i+1)/bands;
    const y0 = topY + (PEN_LOGICAL_H-topY) * f0 * f0;
    const y1 = topY + (PEN_LOGICAL_H-topY) * f1 * f1;
    dctx.fillStyle = i%2===0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    dctx.fillRect(0,y0,PEN_LOGICAL_W,y1-y0);
  }
  // soft ambient shadow where the pitch meets the goal
  const shadowGrad = dctx.createLinearGradient(0,topY,0,topY+36);
  shadowGrad.addColorStop(0,'rgba(0,0,0,0.28)');
  shadowGrad.addColorStop(1,'rgba(0,0,0,0)');
  dctx.fillStyle = shadowGrad;
  dctx.fillRect(0,topY,PEN_LOGICAL_W,36);
  dctx.restore();

  dctx.save();
  dctx.strokeStyle = 'rgba(255,255,255,0.55)';
  dctx.lineWidth = 2;
  dctx.beginPath();
  dctx.ellipse(KICK_SPOT.x, KICK_SPOT.y+34, 92, 24, 0, Math.PI, 0, true);
  dctx.stroke();
  dctx.restore();

  // penalty spot with its own soft ground shadow
  dctx.save();
  dctx.fillStyle = 'rgba(0,0,0,0.22)';
  dctx.beginPath();
  dctx.ellipse(KICK_SPOT.x, KICK_SPOT.y+2, 6, 2.4, 0, 0, Math.PI*2);
  dctx.fill();
  dctx.fillStyle = '#f4f6fb';
  dctx.beginPath();
  dctx.arc(KICK_SPOT.x, KICK_SPOT.y, 3, 0, Math.PI*2);
  dctx.fill();
  dctx.restore();
}

function drawPenaltyGoal(dctx){
  const postW = 9, r = 4;
  const postGrad = dctx.createLinearGradient(GOAL.x-postW, 0, GOAL.x+postW, 0);
  postGrad.addColorStop(0, '#aeb9c9');
  postGrad.addColorStop(0.5, '#ffffff');
  postGrad.addColorStop(1, '#aeb9c9');

  dctx.save();
  dctx.shadowColor = 'rgba(0,0,0,0.4)';
  dctx.shadowBlur = 10;
  dctx.shadowOffsetY = 3;
  dctx.fillStyle = postGrad;
  roundRect(dctx, GOAL.x-postW, GOAL.y-postW, postW, GOAL.h+postW*2, r); dctx.fill();
  roundRect(dctx, GOAL.x+GOAL.w, GOAL.y-postW, postW, GOAL.h+postW*2, r); dctx.fill();
  dctx.restore();

  dctx.save();
  dctx.shadowColor = 'rgba(0,0,0,0.35)';
  dctx.shadowBlur = 8;
  dctx.shadowOffsetY = 2;
  const barGrad = dctx.createLinearGradient(0, GOAL.y-postW, 0, GOAL.y);
  barGrad.addColorStop(0, '#ffffff');
  barGrad.addColorStop(1, '#c7d0dd');
  dctx.fillStyle = barGrad;
  roundRect(dctx, GOAL.x-postW, GOAL.y-postW, GOAL.w+postW*2, postW, r); dctx.fill();
  dctx.restore();

  // net: gentle sag via quadratic curves instead of dead-straight lines
  dctx.save();
  dctx.beginPath();
  dctx.rect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
  dctx.clip();
  dctx.strokeStyle = 'rgba(255,255,255,0.16)';
  dctx.lineWidth = 1;
  const step = 16, sag = 3;
  dctx.beginPath();
  for(let x=GOAL.x; x<=GOAL.x+GOAL.w; x+=step){
    dctx.moveTo(x, GOAL.y);
    dctx.quadraticCurveTo(x+sag, GOAL.y+GOAL.h/2, x, GOAL.y+GOAL.h);
  }
  for(let y=GOAL.y; y<=GOAL.y+GOAL.h; y+=step){
    dctx.moveTo(GOAL.x, y);
    dctx.quadraticCurveTo(GOAL.x+GOAL.w/2, y+sag, GOAL.x+GOAL.w, y);
  }
  dctx.stroke();
  dctx.restore();
}

function drawPenZoneSign(dctx, i){
  const opt = penOptions[i];
  if(!opt) return;
  const pos = penZoneCenter(i);
  const isChosen = penShotZone === i;
  let color = COLORS.ink;
  if(penState==='resolve'){
    if(opt.correct) color = COLORS.phosphor;
    else if(isChosen) color = COLORS.signal;
  } else if(penState==='aim' && G.debugReveal && opt.correct){
    color = COLORS.phosphor;
  }

  dctx.save();
  dctx.font = `700 11px ${FONT_MONO}`;
  const maxWidth = 130;
  const lines = wrapTextLines(dctx, opt.text, maxWidth);
  const lineH = 14;
  let maxLineW = 0;
  for(const l of lines) maxLineW = Math.max(maxLineW, dctx.measureText(l).width);
  const boxW = Math.min(maxWidth+16, maxLineW+16);
  const boxH = lines.length*lineH + 10;
  const topY = pos.y - boxH/2;

  dctx.shadowColor = 'rgba(0,0,0,0.4)';
  dctx.shadowBlur = 10;
  dctx.shadowOffsetY = 3;
  const cardGrad = dctx.createLinearGradient(0, topY, 0, topY+boxH);
  cardGrad.addColorStop(0, 'rgba(16,20,34,0.88)');
  cardGrad.addColorStop(1, 'rgba(8,10,20,0.88)');
  dctx.fillStyle = cardGrad;
  dctx.strokeStyle = hexToRgba(color, 0.6);
  dctx.lineWidth = 1.5;
  roundRect(dctx, pos.x-boxW/2, topY, boxW, boxH, 10);
  dctx.fill(); dctx.stroke();
  dctx.shadowColor = 'transparent';

  // colored accent bar across the top of the card
  dctx.fillStyle = color;
  roundRect(dctx, pos.x-boxW/2, topY, boxW, 3, 1.5);
  dctx.fill();

  dctx.fillStyle = color;
  dctx.textAlign = 'center';
  dctx.textBaseline = 'middle';
  lines.forEach((line,li)=>{
    dctx.fillText(line, pos.x, topY + 8 + lineH/2 + li*lineH);
  });
  dctx.restore();
}

function penKeeperCurrentPos(){
  if(penState!=='flight' && penState!=='resolve'){
    return { x: KEEPER_HOME.x, y: KEEPER_HOME.y, lean:0 };
  }
  const target = penZoneCenter(penKeeperTargetZone);
  const row = Math.floor(penKeeperTargetZone/2);
  const diveTargetY = KEEPER_HOME.y - (row===0 ? 42 : 10);
  const rawT = penState==='flight' ? clamp(penFlightT/(PEN_FLIGHT_TIME*0.85),0,1) : 1;
  const e = 1 - Math.pow(1-rawT,2);
  const x = KEEPER_HOME.x + (target.x-KEEPER_HOME.x)*e;
  return {
    x,
    y: KEEPER_HOME.y + (diveTargetY-KEEPER_HOME.y)*e,
    lean: clamp((x-KEEPER_HOME.x)/60, -1, 1),
  };
}
function drawPenKeeper(dctx){
  const p = penKeeperCurrentPos();
  const lean = p.lean;
  dctx.save();
  dctx.translate(p.x, p.y);

  dctx.save();
  dctx.globalAlpha = 0.3;
  dctx.fillStyle = '#000';
  dctx.filter = 'blur(2px)';
  dctx.beginPath();
  dctx.ellipse(lean*6, 17, 13, 4.5, 0, 0, Math.PI*2);
  dctx.fill();
  dctx.restore();

  dctx.rotate(lean*0.32);

  const kit0 = '#ffe27a', kit1 = '#f0b73a';
  const shorts0 = '#2a2a30', shorts1 = '#141418';

  // legs
  const legGrad = dctx.createLinearGradient(0,-2,0,16);
  legGrad.addColorStop(0,shorts0); legGrad.addColorStop(1,shorts1);
  dctx.fillStyle = legGrad;
  roundRect(dctx,-8,0,6,17,3); dctx.fill();
  roundRect(dctx,2,0,6,17,3); dctx.fill();

  // far arm (behind torso)
  dctx.save();
  dctx.translate(9,-6); dctx.rotate(0.55 - lean*0.5);
  const armGrad = dctx.createLinearGradient(0,-16,0,4);
  armGrad.addColorStop(0,kit0); armGrad.addColorStop(1,kit1);
  dctx.fillStyle = armGrad;
  roundRect(dctx,-3,-14,6,16,3); dctx.fill();
  dctx.fillStyle = '#f4f6fb';
  dctx.beginPath(); dctx.arc(0,-16,4,0,Math.PI*2); dctx.fill();
  dctx.restore();

  // torso
  const torsoGrad = dctx.createLinearGradient(-9,-20,9,4);
  torsoGrad.addColorStop(0,kit0); torsoGrad.addColorStop(1,kit1);
  dctx.fillStyle = torsoGrad;
  roundRect(dctx,-9,-20,18,22,8); dctx.fill();

  // head
  const headGrad = dctx.createRadialGradient(-3,-31,2, 0,-28,9);
  headGrad.addColorStop(0,'#f6cd9e'); headGrad.addColorStop(1,'#d99a68');
  dctx.fillStyle = headGrad;
  dctx.beginPath(); dctx.arc(0,-28,8,0,Math.PI*2); dctx.fill();
  dctx.fillStyle = 'rgba(20,16,12,0.85)';
  dctx.beginPath(); dctx.arc(0,-33,7,Math.PI,0); dctx.fill();

  // near arm (in front of torso)
  dctx.save();
  dctx.translate(-9,-6); dctx.rotate(-0.55 - lean*0.5);
  const armGrad2 = dctx.createLinearGradient(0,-16,0,4);
  armGrad2.addColorStop(0,kit0); armGrad2.addColorStop(1,kit1);
  dctx.fillStyle = armGrad2;
  roundRect(dctx,-3,-14,6,16,3); dctx.fill();
  dctx.fillStyle = '#f4f6fb';
  dctx.beginPath(); dctx.arc(0,-16,4,0,Math.PI*2); dctx.fill();
  dctx.restore();

  dctx.restore();
}

function penBallCurrentPos(){
  if(penState!=='flight' && penState!=='resolve'){
    return { x:KICK_SPOT.x, y:KICK_SPOT.y, groundY:KICK_SPOT.y, scale:1, rot:0 };
  }
  const target = penZoneCenter(penShotZone);
  const rawT = penState==='flight' ? clamp(penFlightT/PEN_FLIGHT_TIME,0,1) : 1;
  const e = 1 - Math.pow(1-rawT,2);
  const groundY = KICK_SPOT.y + (target.y-KICK_SPOT.y)*e;
  return {
    x: KICK_SPOT.x + (target.x-KICK_SPOT.x)*e,
    y: groundY - Math.sin(e*Math.PI)*26,
    groundY,
    scale: 1.5 - e*0.95,
    rot: e * Math.PI * 3.2,
  };
}
function drawPenBall(dctx){
  const p = penBallCurrentPos();
  const r = 8*p.scale;

  dctx.save();
  dctx.globalAlpha = clamp(0.32*p.scale, 0.08, 0.32);
  dctx.fillStyle = '#000';
  dctx.filter = 'blur(1.5px)';
  dctx.beginPath();
  dctx.ellipse(p.x, p.groundY+3, r*1.3, r*0.4, 0, 0, Math.PI*2);
  dctx.fill();
  dctx.restore();

  dctx.save();
  dctx.translate(p.x, p.y);
  dctx.rotate(p.rot);
  const g = dctx.createRadialGradient(-r*0.35,-r*0.35,r*0.15, 0,0,r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c7ccd6');
  dctx.fillStyle = g;
  dctx.beginPath(); dctx.arc(0,0,r,0,Math.PI*2); dctx.fill();
  dctx.strokeStyle = 'rgba(30,32,40,0.55)';
  dctx.lineWidth = Math.max(0.6, r*0.1);
  dctx.beginPath(); dctx.arc(0,0,r*0.42,0,Math.PI*2); dctx.stroke();
  for(let k=0;k<5;k++){
    const a = (k/5)*Math.PI*2;
    dctx.beginPath();
    dctx.moveTo(Math.cos(a)*r*0.42, Math.sin(a)*r*0.42);
    dctx.lineTo(Math.cos(a)*r*0.92, Math.sin(a)*r*0.92);
    dctx.stroke();
  }
  dctx.restore();
}

export function renderPenalty(){
  penCtx.save();
  penCtx.clearRect(0,0,PEN_LOGICAL_W,PEN_LOGICAL_H);
  if(penShake>0){
    penCtx.translate((Math.random()-0.5)*penShake, (Math.random()-0.5)*penShake);
  }

  drawPenaltySky(penCtx);
  drawPenaltyPitch(penCtx);
  drawPenaltyGoal(penCtx);

  if(penState==='aim'||penState==='flight'||penState==='resolve'){
    for(let i=0;i<4;i++) drawPenZoneSign(penCtx, i);
  }

  drawPenKeeper(penCtx);
  if(penState==='aim'||penState==='flight'||penState==='resolve') drawPenBall(penCtx);

  drawParticleList(penCtx, penParticles);
  drawPopupList(penCtx, penPopups);

  if(penState==='title'||penState==='complete'){
    penCtx.fillStyle = 'rgba(5,6,13,0.5)';
    penCtx.fillRect(0,0,PEN_LOGICAL_W,PEN_LOGICAL_H);
  }

  if(penState==='title'){
    drawPixelText(penCtx, 'PRESS ENTER', PEN_LOGICAL_W/2, 300, {scale:3.2, color:COLORS.amber, glow:20, fontSize:12});
    if(Math.floor(performance.now()/500)%2===0){
      drawPixelText(penCtx, 'TO BEGIN THE SHOOTOUT', PEN_LOGICAL_W/2, 332, {scale:2.0, color:COLORS.ink, glow:8, fontSize:10});
    }
    drawPixelText(penCtx, PENALTY_SHOTS + ' PENALTIES', PEN_LOGICAL_W/2, 364, {scale:2.0, color:COLORS.violet, glow:10, fontSize:10});
    drawPixelText(penCtx, 'HIGH SCORE ' + String(penHighScore).padStart(6,'0'), PEN_LOGICAL_W/2, 396, {scale:1.7, color:COLORS.amber, glow:8, fontSize:9});
  }

  if(penState==='complete'){
    const pct = pctOf(penCorrect, penQuizOrder.length);
    drawPixelText(penCtx, 'SHOOTOUT COMPLETE', PEN_LOGICAL_W/2, 190, {scale:3.0, color:COLORS.amber, glow:22, fontSize:13});
    drawPixelText(penCtx, 'SCORE ' + String(penScore).padStart(6,'0'), PEN_LOGICAL_W/2, 228, {scale:2.0, color:COLORS.ink, glow:10, fontSize:10});
    drawPixelText(penCtx, penCorrect + ' / ' + penQuizOrder.length + ' SCORED (' + pct + '%)', PEN_LOGICAL_W/2, 258, {scale:1.8, color:COLORS.violet, glow:8, fontSize:9});
    if(Math.floor(performance.now()/500)%2===0){
      drawPixelText(penCtx, 'PRESS ENTER TO RETRY', PEN_LOGICAL_W/2, 288, {scale:1.6, color:COLORS.ink, glow:6, fontSize:9});
    }
  }

  penCtx.restore();
}

function penClientToLogical(clientX, clientY){
  const rect = penScreenWrapEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * PEN_LOGICAL_W,
    y: (clientY - rect.top) / rect.height * PEN_LOGICAL_H,
  };
}
function penNearestZone(x,y){
  let best = 0, bestD = Infinity;
  for(let i=0;i<4;i++){
    const p = penZoneCenter(i);
    const d = (p.x-x)*(p.x-x) + (p.y-y)*(p.y-y);
    if(d<bestD){ bestD = d; best = i; }
  }
  return best;
}

penScreenWrapEl.addEventListener('pointerdown', e=>{
  if(G.appMode!=='penalty' || modalOpen) return;
  ensureAudio();
  if(penState==='title'||penState==='complete'){ resetPenalty(); return; }
  if(penState!=='aim') return;
  const pt = penClientToLogical(e.clientX, e.clientY);
  penSelectedZone = penNearestZone(pt.x, pt.y);
  takeShot(penSelectedZone);
});

window.addEventListener('keydown', e=>{
  if(G.appMode!=='penalty' || modalOpen) return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Digit1','Digit2','Digit3','Digit4'].includes(e.code)) e.preventDefault();
  ensureAudio();
  if(e.code==='Enter'){
    if(penState==='title'||penState==='complete'){ resetPenalty(); }
    else if(penState==='aim'){ takeShot(penSelectedZone); }
    return;
  }
  if(e.code==='KeyH') toggleHint();
  if(penState!=='aim') return;
  if(e.code==='Digit1') penSelectedZone = 0;
  if(e.code==='Digit2') penSelectedZone = 1;
  if(e.code==='Digit3') penSelectedZone = 2;
  if(e.code==='Digit4') penSelectedZone = 3;
  if(e.code==='ArrowLeft' && penSelectedZone%2===1) penSelectedZone -= 1;
  if(e.code==='ArrowRight' && penSelectedZone%2===0) penSelectedZone += 1;
  if(e.code==='ArrowUp' && penSelectedZone>=2) penSelectedZone -= 2;
  if(e.code==='ArrowDown' && penSelectedZone<2) penSelectedZone += 2;
});

btnPenMute.textContent = 'SND: ' + (G.muted?'OFF':'ON');
btnPenMute.addEventListener('click', ()=>{
  G.muted = !G.muted;
  const label = 'SND: ' + (G.muted?'OFF':'ON');
  btnPenMute.textContent = label;
  btnMute.textContent = label;
});
btnPenHint.textContent = 'HINT: ' + (G.debugReveal?'ON':'OFF');
btnPenHint.addEventListener('click', toggleHint);
btnPenHubBtn.addEventListener('click', goToHub);
document.getElementById('btnPenScores').addEventListener('click', ()=>{ ensureAudio(); openLeaderboard('penalty_', 'PENALTY SHOOTOUT'); });

export function startPenalty(subjectKey){
  G.currentSubject = subjectKey;
  const subj = SUBJECTS[subjectKey];
  penSubtitleEl.textContent = subj.shortName + ' · MOCK REVISION';
  penHighScore = loadHighScore('penalty_');
  penScore = 0; penStreak = 0; penCorrect = 0;
  penShotZone = -1;
  penState = 'title';
  btnPenMute.textContent = 'SND: ' + (G.muted?'OFF':'ON');
  updatePenaltyHud();
  showScreen('penalty');
  resizePenaltyCanvas();
}

