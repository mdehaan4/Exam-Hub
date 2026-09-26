// Pac-Man revision mode: maze navigation quiz.

import {
  COLORS, FONT_MONO, SUBJECTS, clamp, drawParticleList, drawPixelText, drawPopupList, ensureAudio,
  hexToRgba, loadHighScore, modalOpen, openHighScoreEntry, openLeaderboard, pctOf,
  qualifiesForLeaderboard, roundRect, saveHighScore, sfx, shuffleAnswerOptions, shuffleArray,
  spawnExplosionInto, spawnPopupInto, updateParticleList, updatePopupList, G,
} from './shared.js?v=15';
import { QUESTIONS_PER_RUN, btnMute, goToHub, showScreen, toggleHint } from './arcade.js?v=15';

// ---------- pac-man revision mode ----------
const PAC_COLS = 13, PAC_ROWS = 11, PAC_CELL = 30;
const PAC_LOGICAL_W = PAC_COLS*PAC_CELL, PAC_LOGICAL_H = PAC_ROWS*PAC_CELL;
const PAC_MOVE_SPEED = 3.3;
const GHOST_COLORS = ['#EF0107', '#ff8fd6', '#4dd0ff'];

function buildMazeGrid(cols, rows){
  const cells = [];
  for(let r=0;r<rows;r++){
    const row = [];
    for(let c=0;c<cols;c++) row.push({N:false,E:false,S:false,W:false,visited:false});
    cells.push(row);
  }
  const DIRS = [[-1,0,'N','S'],[1,0,'S','N'],[0,1,'E','W'],[0,-1,'W','E']];
  const stack = [[0,0]];
  cells[0][0].visited = true;
  while(stack.length){
    const [r,c] = stack[stack.length-1];
    const options = [];
    for(const d of DIRS){
      const nr=r+d[0], nc=c+d[1];
      if(nr>=0 && nr<rows && nc>=0 && nc<cols && !cells[nr][nc].visited) options.push([nr,nc,d[2],d[3]]);
    }
    if(!options.length){ stack.pop(); continue; }
    const [nr,nc,a,b] = options[Math.floor(Math.random()*options.length)];
    cells[r][c][a] = true;
    cells[nr][nc][b] = true;
    cells[nr][nc].visited = true;
    stack.push([nr,nc]);
  }
  const extra = Math.floor(cols*rows*0.12);
  for(let i=0;i<extra;i++){
    const r = Math.floor(Math.random()*rows), c = Math.floor(Math.random()*cols);
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    const nr=r+d[0], nc=c+d[1];
    if(nr>=0 && nr<rows && nc>=0 && nc<cols){ cells[r][c][d[2]]=true; cells[nr][nc][d[3]]=true; }
  }
  return cells;
}

function mazeBFS(cells, startR, startC){
  const rows=cells.length, cols=cells[0].length;
  const dist = Array.from({length:rows},()=>Array(cols).fill(-1));
  dist[startR][startC] = 0;
  const q = [[startR,startC]];
  let qi = 0;
  while(qi<q.length){
    const [r,c] = q[qi++];
    const cell = cells[r][c];
    const neighbors = [];
    if(cell.N) neighbors.push([r-1,c]);
    if(cell.S) neighbors.push([r+1,c]);
    if(cell.E) neighbors.push([r,c+1]);
    if(cell.W) neighbors.push([r,c-1]);
    for(const [nr,nc] of neighbors){
      if(dist[nr][nc]===-1){ dist[nr][nc] = dist[r][c]+1; q.push([nr,nc]); }
    }
  }
  return dist;
}

function pickAnswerNodes(cells, startR, startC){
  const rows=cells.length, cols=cells[0].length;
  const dist = mazeBFS(cells, startR, startC);
  const midR = rows/2, midC = cols/2;
  const quadrants = [[],[],[],[]];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if(r===startR && c===startC) continue;
      const qi = (r<midR?0:2) + (c<midC?0:1);
      quadrants[qi].push([r,c]);
    }
  }
  return quadrants.map(list=>{
    let best = list[0], bestD = -1;
    for(const [r,c] of list){ if(dist[r][c]>bestD){ bestD = dist[r][c]; best = [r,c]; } }
    return best;
  });
}

function pacCanMove(r,c,dr,dc){
  if(r<0||r>=PAC_ROWS||c<0||c>=PAC_COLS) return false;
  const cell = pacCells[r][c];
  if(dr===-1) return cell.N;
  if(dr===1) return cell.S;
  if(dc===1) return cell.E;
  if(dc===-1) return cell.W;
  return false;
}
function cellCenter(r,c){ return { x:c*PAC_CELL+PAC_CELL/2, y:r*PAC_CELL+PAC_CELL/2 }; }

const pacCanvas = document.getElementById('pacCanvas');
const pacCtx = pacCanvas.getContext('2d');
const pacScreenWrapEl = document.getElementById('pacScreenWrap');
const pacHitFlashEl = document.getElementById('pacHitFlash');
const pacSubtitleEl = document.getElementById('pacSubtitle');
const pacScoreEl = document.getElementById('pacScoreVal');
const pacHighEl = document.getElementById('pacHighVal');
const pacStreakEl = document.getElementById('pacStreakVal');
const pacQuestionValEl = document.getElementById('pacQuestionVal');
const pacQTextEl = document.getElementById('pacQText');
const pacQNumEl = document.getElementById('pacQNum');
const btnPacMute = document.getElementById('btnPacMute');
export const btnPacHint = document.getElementById('btnPacHint');
const btnPacHubBtn = document.getElementById('btnPacHub');

export function resizePacCanvas(){
  const rect = pacScreenWrapEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  pacCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  pacCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  pacCtx.setTransform(
    (pacCanvas.width / PAC_LOGICAL_W), 0, 0,
    (pacCanvas.height / PAC_LOGICAL_H), 0, 0
  );
}

let pacState = 'title'; // title, play, resolve, complete
let pacCells = null, pacDots = null;
let pacStart = { r:0, c:0 };
let pacAnswerCells = [], pacAnswerCellSet = new Set();
let pacGhostHomes = [], pacGhosts = [];
let pacQuizOrder = [], pacIndex = 0, pacOptions = [];
let pacScore = 0, pacStreak = 0, pacCorrectCount = 0, pacHighScore = 0;
let pacStateTimer = 0;
let pacParticles = [], pacPopups = [];

let pacR = 0, pacC = 0, pacT = 0;
let pacDir = { dr:0, dc:0 }, pacNextDir = { dr:0, dc:0 };
let pacMouthPhase = 0, pacFacing = 0, pacRenderFacing = 0;
let pacInvuln = 0;
let pacTrail = [];
const PAC_TRAIL_LEN = 9;

function updatePacHud(){
  pacScoreEl.textContent = String(pacScore).padStart(6,'0');
  pacHighEl.textContent = String(Math.max(pacScore,pacHighScore)).padStart(6,'0');
  pacStreakEl.textContent = String(pacStreak);
  pacQuestionValEl.textContent = Math.min(pacIndex+1, pacQuizOrder.length) + '/' + pacQuizOrder.length;
}

function generatePacMaze(){
  pacCells = buildMazeGrid(PAC_COLS, PAC_ROWS);
  pacStart = { r: PAC_ROWS-1, c: Math.floor(PAC_COLS/2) };
  const nodes = pickAnswerNodes(pacCells, pacStart.r, pacStart.c);
  pacAnswerCells = nodes.map(([r,c])=>({r,c}));
  pacAnswerCellSet = new Set(pacAnswerCells.map(n=>n.r+','+n.c));

  const midR = Math.floor(PAC_ROWS/2), midC = Math.floor(PAC_COLS/2);
  pacGhostHomes = [
    { r:midR, c:midC },
    { r:clamp(midR-1,0,PAC_ROWS-1), c:clamp(midC-2,0,PAC_COLS-1) },
    { r:clamp(midR-1,0,PAC_ROWS-1), c:clamp(midC+2,0,PAC_COLS-1) },
  ];
  pacGhosts = pacGhostHomes.map((h,i)=>({
    r:h.r, c:h.c, t:0, dir:{dr:0,dc:0}, color: GHOST_COLORS[i], kit: i===0, bobPhase: Math.random()*10,
  }));
}

function loadPacQuestion(n){
  const q = SUBJECTS[G.currentSubject].questions[pacQuizOrder[n]];
  pacOptions = shuffleAnswerOptions(q);
  pacDots = pacCells.map((row,r)=>row.map((cell,c)=>{
    if(r===pacStart.r && c===pacStart.c) return false;
    return !pacAnswerCellSet.has(r+','+c);
  }));
  pacQTextEl.textContent = q.q;
  pacQNumEl.textContent = String(n+1).padStart(2,'0') + ' / ' + String(pacQuizOrder.length).padStart(2,'0');

  pacR = pacStart.r; pacC = pacStart.c; pacT = 0;
  pacDir = {dr:0,dc:0}; pacNextDir = {dr:0,dc:0};
  pacFacing = 0; pacRenderFacing = 0;
  pacTrail = [];
  pacGhosts.forEach((g,i)=>{ g.r = pacGhostHomes[i].r; g.c = pacGhostHomes[i].c; g.t = 0; g.dir = {dr:0,dc:0}; });
}

function resetPacman(){
  pacScore = 0; pacStreak = 0; pacCorrectCount = 0;
  pacParticles = []; pacPopups = [];
  pacQuizOrder = shuffleArray(Array.from({length:SUBJECTS[G.currentSubject].questions.length}, (_,i)=>i)).slice(0, QUESTIONS_PER_RUN);
  pacIndex = 0;
  generatePacMaze();
  loadPacQuestion(0);
  updatePacHud();
  pacState = 'play';
}

function finishPacman(){
  pacHighScore = Math.max(pacHighScore, pacScore);
  saveHighScore('pacman_', pacHighScore);
  updatePacHud();
  sfx.complete();
  pacState = 'complete';
  if(qualifiesForLeaderboard('pacman_', pacScore)) openHighScoreEntry('pacman_', pacScore, 'PAC-MAN REVISION');
}

function flashPacHit(){
  pacHitFlashEl.style.transition = 'none';
  pacHitFlashEl.style.opacity = '1';
  requestAnimationFrame(()=>{
    pacHitFlashEl.style.transition = 'opacity .4s ease-out';
    pacHitFlashEl.style.opacity = '0';
  });
}

function resolvePacAnswer(idx){
  const chosen = pacOptions[idx];
  const correct = !!(chosen && chosen.correct);
  const pos = cellCenter(pacAnswerCells[idx].r, pacAnswerCells[idx].c);
  if(correct){
    pacScore += 100;
    pacCorrectCount += 1;
    pacStreak += 1;
    spawnExplosionInto(pacParticles, pos.x, pos.y, COLORS.phosphor, 22, 180);
    spawnPopupInto(pacPopups, pos.x, pos.y-24, 'CORRECT +100', COLORS.phosphor);
    sfx.correct();
  } else {
    pacStreak = 0;
    flashPacHit();
    spawnExplosionInto(pacParticles, pos.x, pos.y, COLORS.signal, 16, 150);
    spawnPopupInto(pacPopups, pos.x, pos.y-24, 'INCORRECT', COLORS.signal);
    const correctIdx = pacOptions.findIndex(o=>o.correct);
    if(correctIdx>=0){
      const cp = cellCenter(pacAnswerCells[correctIdx].r, pacAnswerCells[correctIdx].c);
      spawnPopupInto(pacPopups, cp.x, cp.y-24, 'CORRECT ANSWER', COLORS.phosphor);
    }
    sfx.wrong();
  }
  updatePacHud();
  pacDir = {dr:0,dc:0}; pacNextDir = {dr:0,dc:0};
  pacState = 'resolve';
  pacStateTimer = correct ? 1.3 : 2.3;
}

function onPacArriveCell(r,c){
  if(pacState!=='play') return;
  if(pacDots[r][c]){
    pacDots[r][c] = false;
    pacScore += 10;
    sfx.chomp();
    updatePacHud();
    const dp = cellCenter(r,c);
    spawnExplosionInto(pacParticles, dp.x, dp.y, COLORS.amber, 5, 55);
  }
  const ansIdx = pacAnswerCells.findIndex(a=>a.r===r && a.c===c);
  if(ansIdx>=0) resolvePacAnswer(ansIdx);
}

function updatePacFacing(){
  if(pacDir.dc===1) pacFacing = 0;
  else if(pacDir.dr===1) pacFacing = Math.PI/2;
  else if(pacDir.dc===-1) pacFacing = Math.PI;
  else if(pacDir.dr===-1) pacFacing = -Math.PI/2;
}

function updatePacMovement(dt){
  const moving = pacDir.dr!==0 || pacDir.dc!==0;
  if(!moving){
    if((pacNextDir.dr||pacNextDir.dc) && pacCanMove(pacR,pacC,pacNextDir.dr,pacNextDir.dc)){
      pacDir = { dr:pacNextDir.dr, dc:pacNextDir.dc };
      updatePacFacing();
    }
    return;
  }
  pacT += PAC_MOVE_SPEED*dt;
  if(pacT>=1){
    pacT -= 1;
    pacR += pacDir.dr; pacC += pacDir.dc;
    if((pacNextDir.dr||pacNextDir.dc) && pacCanMove(pacR,pacC,pacNextDir.dr,pacNextDir.dc)){
      pacDir = { dr:pacNextDir.dr, dc:pacNextDir.dc };
    } else if(!pacCanMove(pacR,pacC,pacDir.dr,pacDir.dc)){
      pacDir = { dr:0, dc:0 };
      pacT = 0;
    }
    updatePacFacing();
    onPacArriveCell(pacR,pacC);
  }
}

const GHOST_DETECT_RANGE = 5;
const GHOST_CHASE_CHANCE = 0.4;
const GHOST_SPEED_MULT = 0.5;

function pickGhostDirection(g){
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  const reverse = [-g.dir.dr,-g.dir.dc];
  let choices = dirs.filter(([dr,dc])=>pacCanMove(g.r,g.c,dr,dc) && !(dr===reverse[0]&&dc===reverse[1]));
  if(!choices.length) choices = dirs.filter(([dr,dc])=>pacCanMove(g.r,g.c,dr,dc));
  if(!choices.length){ g.dir = {dr:0,dc:0}; return; }
  const distToPac = Math.abs(g.r-pacR) + Math.abs(g.c-pacC);
  const aware = distToPac <= GHOST_DETECT_RANGE;
  let pick;
  if(!aware || Math.random()>GHOST_CHASE_CHANCE){
    pick = choices[Math.floor(Math.random()*choices.length)];
  } else {
    let best = choices[0], bestD = Infinity;
    for(const [dr,dc] of choices){
      const d = Math.abs((g.r+dr)-pacR) + Math.abs((g.c+dc)-pacC);
      if(d<bestD){ bestD = d; best = [dr,dc]; }
    }
    pick = best;
  }
  g.dir = { dr:pick[0], dc:pick[1] };
}

function updateGhost(g, dt){
  const moving = g.dir.dr!==0 || g.dir.dc!==0;
  if(!moving){
    pickGhostDirection(g);
    return;
  }
  g.t += (PAC_MOVE_SPEED*GHOST_SPEED_MULT)*dt;
  if(g.t>=1){
    g.t -= 1;
    g.r += g.dir.dr; g.c += g.dir.dc;
    pickGhostDirection(g);
  }
}

function pacPixelPos(){
  return {
    x: (pacC + pacDir.dc*pacT)*PAC_CELL + PAC_CELL/2,
    y: (pacR + pacDir.dr*pacT)*PAC_CELL + PAC_CELL/2,
  };
}
function ghostPixelPos(g){
  return {
    x: (g.c + g.dir.dc*g.t)*PAC_CELL + PAC_CELL/2,
    y: (g.r + g.dir.dr*g.t)*PAC_CELL + PAC_CELL/2,
  };
}

function caughtByGhost(){
  const pp = pacPixelPos();
  spawnPopupInto(pacPopups, pp.x, pp.y-20, 'CAUGHT!', COLORS.signal);
  flashPacHit();
  sfx.wrong();
  pacR = pacStart.r; pacC = pacStart.c; pacT = 0;
  pacDir = {dr:0,dc:0}; pacNextDir = {dr:0,dc:0};
  pacFacing = 0; pacRenderFacing = 0;
  pacTrail = [];
  pacGhosts.forEach((g,i)=>{ g.r = pacGhostHomes[i].r; g.c = pacGhostHomes[i].c; g.t = 0; g.dir = {dr:0,dc:0}; });
  pacInvuln = 1.2;
}

export function updatePacman(dt){
  updateParticleList(pacParticles, dt);
  updatePopupList(pacPopups, dt);

  if(pacState==='resolve'){
    pacStateTimer -= dt;
    if(pacStateTimer<=0){
      if(pacIndex+1 >= pacQuizOrder.length) finishPacman();
      else { pacIndex += 1; loadPacQuestion(pacIndex); pacState = 'play'; }
    }
    return;
  }
  if(pacState!=='play') return;

  pacMouthPhase += dt;
  if(pacInvuln>0) pacInvuln = Math.max(0, pacInvuln-dt);
  updatePacMovement(dt);
  pacGhosts.forEach(g=>updateGhost(g,dt));

  let diff = pacFacing - pacRenderFacing;
  diff = ((diff + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI;
  pacRenderFacing += diff * Math.min(1, dt*14);

  if(pacDir.dr!==0 || pacDir.dc!==0){
    const pp = pacPixelPos();
    pacTrail.push({ x:pp.x, y:pp.y });
    if(pacTrail.length > PAC_TRAIL_LEN) pacTrail.shift();
  }

  if(pacInvuln<=0){
    const pp = pacPixelPos();
    const threshold = (PAC_CELL*0.46)*(PAC_CELL*0.46);
    for(const g of pacGhosts){
      const gp = ghostPixelPos(g);
      const dx = pp.x-gp.x, dy = pp.y-gp.y;
      if(dx*dx+dy*dy < threshold){ caughtByGhost(); break; }
    }
  }
}

function drawMazeBackground(dctx){
  const grad = dctx.createLinearGradient(0,0,0,PAC_LOGICAL_H);
  grad.addColorStop(0, '#080b18');
  grad.addColorStop(1, '#141a38');
  dctx.fillStyle = grad;
  dctx.fillRect(0,0,PAC_LOGICAL_W,PAC_LOGICAL_H);

  dctx.save();
  dctx.strokeStyle = 'rgba(90,120,220,0.07)';
  dctx.lineWidth = 1;
  dctx.beginPath();
  for(let x=0;x<=PAC_LOGICAL_W;x+=PAC_CELL){ dctx.moveTo(x,0); dctx.lineTo(x,PAC_LOGICAL_H); }
  for(let y=0;y<=PAC_LOGICAL_H;y+=PAC_CELL){ dctx.moveTo(0,y); dctx.lineTo(PAC_LOGICAL_W,y); }
  dctx.stroke();
  dctx.restore();

  const vignette = dctx.createRadialGradient(
    PAC_LOGICAL_W/2, PAC_LOGICAL_H/2, PAC_LOGICAL_H*0.2,
    PAC_LOGICAL_W/2, PAC_LOGICAL_H/2, PAC_LOGICAL_H*0.75
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  dctx.fillStyle = vignette;
  dctx.fillRect(0,0,PAC_LOGICAL_W,PAC_LOGICAL_H);
}

function buildMazeWallPath(){
  const path = new Path2D();
  for(let r=0;r<PAC_ROWS;r++){
    for(let c=0;c<PAC_COLS;c++){
      const x0 = c*PAC_CELL, y0 = r*PAC_CELL;
      if(!pacCells[r][c].N){ path.moveTo(x0,y0); path.lineTo(x0+PAC_CELL,y0); }
      if(!pacCells[r][c].W){ path.moveTo(x0,y0); path.lineTo(x0,y0+PAC_CELL); }
    }
  }
  for(let c=0;c<PAC_COLS;c++){ const x0=c*PAC_CELL; path.moveTo(x0,PAC_ROWS*PAC_CELL); path.lineTo(x0+PAC_CELL,PAC_ROWS*PAC_CELL); }
  for(let r=0;r<PAC_ROWS;r++){ const y0=r*PAC_CELL; path.moveTo(PAC_COLS*PAC_CELL,y0); path.lineTo(PAC_COLS*PAC_CELL,y0+PAC_CELL); }
  return path;
}

function drawMazeWalls(dctx){
  const path = buildMazeWallPath();
  const pulse = 0.7 + Math.sin(performance.now()*0.0022)*0.3;

  dctx.save();
  dctx.lineCap = 'round';
  dctx.lineJoin = 'round';

  const wallGrad = dctx.createLinearGradient(0,0,0,PAC_LOGICAL_H);
  wallGrad.addColorStop(0, '#5b9bff');
  wallGrad.addColorStop(1, '#1e3f9e');
  dctx.strokeStyle = wallGrad;
  dctx.shadowColor = `rgba(91,155,255,${(0.5+pulse*0.3).toFixed(2)})`;
  dctx.shadowBlur = 22;
  dctx.lineWidth = 7;
  dctx.stroke(path);

  dctx.shadowBlur = 0;
  dctx.save();
  dctx.translate(-1,-1.1);
  dctx.strokeStyle = 'rgba(220,238,255,0.6)';
  dctx.lineWidth = 2.2;
  dctx.stroke(path);
  dctx.restore();

  dctx.restore();
}

function drawDots(dctx){
  dctx.save();
  for(let r=0;r<PAC_ROWS;r++){
    for(let c=0;c<PAC_COLS;c++){
      if(!pacDots[r][c]) continue;
      const p = cellCenter(r,c);
      const g = dctx.createRadialGradient(p.x,p.y,0, p.x,p.y,4.4);
      g.addColorStop(0, '#fff6d0');
      g.addColorStop(1, '#ffc93f');
      dctx.fillStyle = g;
      dctx.shadowColor = 'rgba(255,201,63,0.8)';
      dctx.shadowBlur = 6;
      dctx.beginPath();
      dctx.arc(p.x,p.y,3.2,0,Math.PI*2);
      dctx.fill();
    }
  }
  dctx.restore();
}

function drawAnswerNodes(dctx){
  const pulse = 1 + Math.sin(performance.now()*0.006)*0.08;
  pacAnswerCells.forEach((node,i)=>{
    const opt = pacOptions[i];
    if(!opt) return;
    const pos = cellCenter(node.r, node.c);
    let color = COLORS.violet;
    if(pacState==='resolve'){
      const isEaten = (node.r===pacR && node.c===pacC);
      if(opt.correct) color = COLORS.phosphor;
      else if(isEaten) color = COLORS.signal;
      else color = COLORS.ink;
    } else if(pacState==='play' && G.debugReveal && opt.correct){
      color = COLORS.phosphor;
    }

    dctx.save();
    dctx.translate(pos.x, pos.y);
    dctx.fillStyle = hexToRgba(color, 0.9);
    dctx.shadowColor = hexToRgba(color, 0.8);
    dctx.shadowBlur = 12;
    dctx.beginPath();
    dctx.arc(0,0, PAC_CELL*0.3*pulse, 0, Math.PI*2);
    dctx.fill();
    dctx.restore();

    dctx.save();
    dctx.font = `700 10px ${FONT_MONO}`;
    const maxWidth = PAC_CELL*2.4;
    const lines = wrapTextLines(dctx, opt.text, maxWidth);
    const lineH = 12;
    let maxLineW = 0;
    for(const l of lines) maxLineW = Math.max(maxLineW, dctx.measureText(l).width);
    const boxW = Math.min(maxWidth+14, maxLineW+14);
    const boxH = lines.length*lineH + 8;
    const margin = 4;
    const boxCX = clamp(pos.x, boxW/2+margin, PAC_LOGICAL_W-boxW/2-margin);
    let topY = pos.y - PAC_CELL*0.55 - boxH;
    if(topY < margin){
      const belowY = pos.y + PAC_CELL*0.55;
      topY = (belowY+boxH <= PAC_LOGICAL_H-margin) ? belowY : clamp(topY, margin, PAC_LOGICAL_H-boxH-margin);
    }
    const cardGrad = dctx.createLinearGradient(0,topY,0,topY+boxH);
    cardGrad.addColorStop(0, 'rgba(16,20,34,0.88)');
    cardGrad.addColorStop(1, 'rgba(8,10,20,0.88)');
    dctx.fillStyle = cardGrad;
    dctx.strokeStyle = hexToRgba(color, 0.6);
    dctx.lineWidth = 1.3;
    roundRect(dctx, boxCX-boxW/2, topY, boxW, boxH, 8);
    dctx.fill(); dctx.stroke();

    dctx.fillStyle = color;
    dctx.textAlign = 'center';
    dctx.textBaseline = 'middle';
    lines.forEach((line,li)=>{
      dctx.fillText(line, boxCX, topY + 6 + lineH/2 + li*lineH);
    });
    dctx.restore();
  });
}

function drawPacTrail(dctx){
  const n = pacTrail.length;
  if(!n) return;
  dctx.save();
  for(let i=0;i<n;i++){
    const t = pacTrail[i];
    const age = (i+1)/n;
    dctx.globalAlpha = age*0.35;
    dctx.fillStyle = '#ffdb4d';
    dctx.shadowColor = 'rgba(255,219,77,0.6)';
    dctx.shadowBlur = 6;
    dctx.beginPath();
    dctx.arc(t.x, t.y, PAC_CELL*0.16*age, 0, Math.PI*2);
    dctx.fill();
  }
  dctx.restore();
}

function drawPacman(dctx, x, y, dir, mouthPhase, travelT){
  const bounce = 1 + Math.sin(Math.min(1,travelT||0)*Math.PI)*0.08;
  const r = PAC_CELL*0.34*bounce;
  const angle = Math.abs(Math.sin(mouthPhase*8)) * 0.72;
  dctx.save();
  dctx.translate(x,y);

  dctx.save();
  dctx.rotate(dir);
  const grad = dctx.createRadialGradient(-r*0.35,-r*0.35,r*0.15, 0,0,r);
  grad.addColorStop(0,'#fffbe0');
  grad.addColorStop(0.55,'#ffdb4d');
  grad.addColorStop(1,'#f0a800');
  dctx.fillStyle = grad;
  dctx.shadowColor = 'rgba(255,210,63,0.85)';
  dctx.shadowBlur = 12;
  dctx.beginPath();
  dctx.arc(0,0,r, angle, Math.PI*2-angle);
  dctx.lineTo(0,0);
  dctx.closePath();
  dctx.fill();
  dctx.restore();

  dctx.shadowBlur = 0;
  dctx.globalAlpha = 0.45;
  dctx.fillStyle = '#ffffff';
  dctx.beginPath();
  dctx.ellipse(-r*0.32,-r*0.36, r*0.26, r*0.15, -0.5, 0, Math.PI*2);
  dctx.fill();
  dctx.globalAlpha = 1;

  dctx.restore();
}

function drawGhost(dctx, x, y, color, facingDX, bobPhase, kit){
  const r = PAC_CELL*0.32;
  const bob = Math.sin((bobPhase||0)) * 2.4;
  const sway = Math.sin((bobPhase||0)*0.6) * 1.4;
  dctx.save();
  dctx.translate(x+sway, y+bob);
  dctx.fillStyle = color;
  dctx.shadowColor = hexToRgba(color,0.55);
  dctx.shadowBlur = 10;

  const bottomY = r*0.78;
  const waves = 5;
  const segW = (2*r)/waves;
  dctx.beginPath();
  dctx.arc(0,0,r,Math.PI,0,false);
  let px = r;
  dctx.lineTo(px, bottomY-r*0.1);
  for(let i=0;i<waves;i++){
    const midX = px - segW/2;
    const nextX = px - segW;
    const wobble = Math.sin((bobPhase||0)*2.2 + i*1.3) * r*0.08;
    const dipY = (i%2===0) ? bottomY+r*0.22+wobble : bottomY-r*0.1+wobble;
    dctx.quadraticCurveTo(midX, dipY, nextX, bottomY-r*0.1);
    px = nextX;
  }
  dctx.closePath();
  dctx.fill();

  if(kit){
    dctx.save();
    dctx.shadowBlur = 0;
    dctx.fillStyle = '#ffffff';
    dctx.beginPath(); dctx.ellipse(-r*0.86,-r*0.05, r*0.26, r*0.5, 0.18, 0, Math.PI*2); dctx.fill();
    dctx.beginPath(); dctx.ellipse(r*0.86,-r*0.05, r*0.26, r*0.5, -0.18, 0, Math.PI*2); dctx.fill();
    dctx.beginPath();
    dctx.moveTo(-r*0.22,-r*0.98);
    dctx.lineTo(r*0.22,-r*0.98);
    dctx.lineTo(0,-r*0.68);
    dctx.closePath();
    dctx.fill();
    dctx.fillStyle = '#ffd400';
    dctx.beginPath(); dctx.arc(-r*0.4,-r*0.28,r*0.1,0,Math.PI*2); dctx.fill();
    dctx.restore();
  }

  dctx.shadowBlur = 0;
  dctx.globalAlpha = 0.28;
  dctx.fillStyle = '#ffffff';
  dctx.beginPath();
  dctx.ellipse(-r*0.28,-r*0.42, r*0.36, r*0.22, -0.4, 0, Math.PI*2);
  dctx.fill();
  dctx.globalAlpha = 1;

  const eyeDX = facingDX>=0 ? 1 : -1;
  const eyeOpen = Math.max(0.08, Math.pow(Math.abs(Math.sin((bobPhase||0)*0.25)), 6));
  dctx.fillStyle = '#eef4ff';
  dctx.shadowColor = 'rgba(0,0,0,0.25)';
  dctx.shadowBlur = 2;
  dctx.beginPath(); dctx.ellipse(-r*0.32,-r*0.08,r*0.24,r*0.3*eyeOpen,0,0,Math.PI*2); dctx.fill();
  dctx.beginPath(); dctx.ellipse(r*0.32,-r*0.08,r*0.24,r*0.3*eyeOpen,0,0,Math.PI*2); dctx.fill();
  dctx.shadowBlur = 0;
  dctx.fillStyle = '#22345a';
  dctx.beginPath(); dctx.arc(-r*0.32+eyeDX*r*0.09,-r*0.05,r*0.12*eyeOpen,0,Math.PI*2); dctx.fill();
  dctx.beginPath(); dctx.arc(r*0.32+eyeDX*r*0.09,-r*0.05,r*0.12*eyeOpen,0,Math.PI*2); dctx.fill();
  dctx.fillStyle = '#ffffff';
  dctx.globalAlpha = 0.7;
  dctx.beginPath(); dctx.arc(-r*0.32+eyeDX*r*0.09-1,-r*0.08,r*0.04*eyeOpen,0,Math.PI*2); dctx.fill();
  dctx.beginPath(); dctx.arc(r*0.32+eyeDX*r*0.09-1,-r*0.08,r*0.04*eyeOpen,0,Math.PI*2); dctx.fill();
  dctx.globalAlpha = 1;
  dctx.restore();
}

export function renderPacman(){
  pacCtx.save();
  pacCtx.clearRect(0,0,PAC_LOGICAL_W,PAC_LOGICAL_H);

  drawMazeBackground(pacCtx);
  drawMazeWalls(pacCtx);

  if(pacState==='play'||pacState==='resolve'){
    drawDots(pacCtx);
    drawAnswerNodes(pacCtx);
    drawPacTrail(pacCtx);
    pacGhosts.forEach(g=>{
      const p = ghostPixelPos(g);
      drawGhost(pacCtx, p.x, p.y, g.color, g.dir.dc || 1, performance.now()*0.003 + g.bobPhase, g.kit);
    });
    if(pacInvuln<=0 || Math.floor(pacInvuln*10)%2===0){
      const pp = pacPixelPos();
      drawPacman(pacCtx, pp.x, pp.y, pacRenderFacing, pacMouthPhase, pacT);
    }
  }

  drawParticleList(pacCtx, pacParticles);
  drawPopupList(pacCtx, pacPopups);

  if(pacState==='title'||pacState==='complete'){
    pacCtx.fillStyle = 'rgba(5,6,13,0.55)';
    pacCtx.fillRect(0,0,PAC_LOGICAL_W,PAC_LOGICAL_H);
  }

  if(pacState==='title'){
    drawPixelText(pacCtx, 'PRESS ENTER', PAC_LOGICAL_W/2, PAC_LOGICAL_H/2-40, {scale:2.8, color:COLORS.phosphor, glow:20, fontSize:12});
    if(Math.floor(performance.now()/500)%2===0){
      drawPixelText(pacCtx, 'TO BEGIN THE MAZE', PAC_LOGICAL_W/2, PAC_LOGICAL_H/2-6, {scale:1.9, color:COLORS.ink, glow:8, fontSize:10});
    }
    drawPixelText(pacCtx, QUESTIONS_PER_RUN + ' QUESTIONS', PAC_LOGICAL_W/2, PAC_LOGICAL_H/2+26, {scale:1.9, color:COLORS.violet, glow:10, fontSize:10});
    drawPixelText(pacCtx, 'HIGH SCORE ' + String(pacHighScore).padStart(6,'0'), PAC_LOGICAL_W/2, PAC_LOGICAL_H/2+56, {scale:1.6, color:COLORS.amber, glow:8, fontSize:9});
  }

  if(pacState==='complete'){
    const pct = pctOf(pacCorrectCount, pacQuizOrder.length);
    drawPixelText(pacCtx, 'MAZE COMPLETE', PAC_LOGICAL_W/2, PAC_LOGICAL_H/2-56, {scale:2.8, color:COLORS.phosphor, glow:22, fontSize:13});
    drawPixelText(pacCtx, 'SCORE ' + String(pacScore).padStart(6,'0'), PAC_LOGICAL_W/2, PAC_LOGICAL_H/2-18, {scale:1.9, color:COLORS.ink, glow:10, fontSize:10});
    drawPixelText(pacCtx, pacCorrectCount + ' / ' + pacQuizOrder.length + ' CORRECT (' + pct + '%)', PAC_LOGICAL_W/2, PAC_LOGICAL_H/2+12, {scale:1.7, color:COLORS.violet, glow:8, fontSize:9});
    if(Math.floor(performance.now()/500)%2===0){
      drawPixelText(pacCtx, 'PRESS ENTER TO RETRY', PAC_LOGICAL_W/2, PAC_LOGICAL_H/2+44, {scale:1.5, color:COLORS.ink, glow:6, fontSize:9});
    }
  }

  pacCtx.restore();
}

pacScreenWrapEl.addEventListener('pointerdown', ()=>{
  if(G.appMode!=='pacman' || modalOpen) return;
  ensureAudio();
  if(pacState==='title'||pacState==='complete') resetPacman();
});

window.addEventListener('keydown', e=>{
  if(G.appMode!=='pacman' || modalOpen) return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.code)) e.preventDefault();
  ensureAudio();
  if(e.code==='Enter'){
    if(pacState==='title'||pacState==='complete') resetPacman();
    return;
  }
  if(e.code==='KeyH') toggleHint();
  if(pacState!=='play') return;
  if(e.code==='ArrowLeft'||e.code==='KeyA') pacNextDir = {dr:0,dc:-1};
  if(e.code==='ArrowRight'||e.code==='KeyD') pacNextDir = {dr:0,dc:1};
  if(e.code==='ArrowUp'||e.code==='KeyW') pacNextDir = {dr:-1,dc:0};
  if(e.code==='ArrowDown'||e.code==='KeyS') pacNextDir = {dr:1,dc:0};
});

function bindPacDpad(el, dr, dc){
  el.addEventListener('pointerdown', e=>{
    e.preventDefault();
    if(G.appMode!=='pacman' || modalOpen) return;
    ensureAudio();
    if(pacState==='title'||pacState==='complete'){ resetPacman(); return; }
    pacNextDir = {dr,dc};
  });
}
bindPacDpad(document.getElementById('btnPacUp'), -1, 0);
bindPacDpad(document.getElementById('btnPacDown'), 1, 0);
bindPacDpad(document.getElementById('btnPacLeft'), 0, -1);
bindPacDpad(document.getElementById('btnPacRight'), 0, 1);

btnPacMute.textContent = 'SND: ' + (G.muted?'OFF':'ON');
btnPacMute.addEventListener('click', ()=>{
  G.muted = !G.muted;
  const label = 'SND: ' + (G.muted?'OFF':'ON');
  btnPacMute.textContent = label;
  btnMute.textContent = label;
});
btnPacHint.textContent = 'HINT: ' + (G.debugReveal?'ON':'OFF');
btnPacHint.addEventListener('click', toggleHint);
btnPacHubBtn.addEventListener('click', goToHub);
document.getElementById('btnPacScores').addEventListener('click', ()=>{ ensureAudio(); openLeaderboard('pacman_', 'PAC-MAN REVISION'); });

export function startPacman(subjectKey){
  G.currentSubject = subjectKey;
  const subj = SUBJECTS[subjectKey];
  pacSubtitleEl.textContent = subj.shortName + ' · MOCK REVISION';
  pacHighScore = loadHighScore('pacman_');
  pacScore = 0; pacStreak = 0; pacCorrectCount = 0;
  pacState = 'title';
  generatePacMaze();
  btnPacMute.textContent = 'SND: ' + (G.muted?'OFF':'ON');
  updatePacHud();
  showScreen('pacman');
  resizePacCanvas();
}

