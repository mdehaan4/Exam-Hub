// Entry point: wires up the hub screen and boots the game loop.

import { ensureAudio, resizeCanvas } from './shared.js';
import { frame, showScreen, startArcade } from './arcade.js';
import { startForestMode } from './forest.js';
import { startExam } from './exam.js';
import { startPenalty, resizePenaltyCanvas } from './penalty.js';
import { startPacman, resizePacCanvas } from './pacman.js';
import { RACE_LINK_MARKER, raceExtractCode, raceStartJoin, raceSupported, startRace } from './race.js';
import { selSubject } from './shared.js';

window.addEventListener('resize', () => { resizeCanvas(); resizePenaltyCanvas(); resizePacCanvas(); });

// ---------- hub ----------
const selMode = document.getElementById('selMode');
const hubPanelEl = document.querySelector('.hub-panel');
const hubDescEl = document.getElementById('hubDesc');
const HUB_DESCRIPTIONS = {
  arcade: 'Space Invaders style: fly through 10 questions sampled at random. Shoot the ship carrying the correct answer — wrong guesses are shown, but nothing is lost. Correct answers upgrade your weapon.',
  exam: 'All 20 questions, one at a time, with the correct answer and an explanation shown after each. Finishes with a pass/fail score and a topic-by-topic breakdown.',
  penalty: 'Football penalty shootout style: a best-of-5 shootout sampled at random. Pick the goal zone showing the correct answer to score — pick wrong and the keeper saves it. Nothing is lost either way.',
  pacman: 'Pac-Man style: navigate a maze through 10 questions sampled at random. Eat the answer node with the correct text — wrong guesses are shown, but nothing is lost. Dodge the ghosts along the way.',
  forest: 'A Pokémon-inspired city walk: explore a street scene with shops and buildings, walk down the road, and chat with computer-controlled walkers while collecting the feeling of a starter RPG.',
  'racing-demo': 'Launch the standalone browser racing game with a chase camera, drifting car handling, and modern 3D visuals.',
  hmrc: 'A top-down, Pokémon-style walkabout: explore an indoor fairground hall on foot with WASD or the arrow keys. (Early build — just the hall and movement for now.)',
  'tax-battle': 'A Pokémon-inspired quiz battle: a trainer explores encounters, answers tax and tech questions, and wins badges by picking the correct answer in a turn-based fight.',
  chess: 'Classic two-player chess on one screen: drag or click pieces, with full rules — castling, en passant, promotion, check, checkmate and stalemate. No quiz questions, just chess.',
  race: 'Head-to-head against a friend on the same 10 questions in real time — one of you hosts, the other joins, by swapping two links. No account needed. Works only on the GitHub Pages version of this app, not this preview.',
};
function updateHubDesc(){
  hubDescEl.textContent = HUB_DESCRIPTIONS[selMode.value];
  hubPanelEl.classList.toggle('racing-demo', selMode.value === 'racing-demo');
}
selMode.addEventListener('change', updateHubDesc);
updateHubDesc();

document.getElementById('btnStart').addEventListener('click', ()=>{
  ensureAudio();
  const subject = selSubject.value;
  if(selMode.value==='arcade') startArcade(subject);
  else if(selMode.value==='penalty') startPenalty(subject);
  else if(selMode.value==='pacman') startPacman(subject);
  else if(selMode.value==='forest') startForestMode(subject);
  else if(selMode.value==='racing-demo') {
    window.location.href = './racing-demo.html?subject=' + encodeURIComponent(subject);
    return;
  }
  else if(selMode.value==='hmrc') {
    window.location.href = './hmrc-mode.html?subject=' + encodeURIComponent(subject);
    return;
  }
  else if(selMode.value==='tax-battle') {
    window.location.href = './tax-battle-mode.html?subject=' + encodeURIComponent(subject);
    return;
  }
  else if(selMode.value==='chess') {
    window.location.href = './chess.html';
    return;
  }
  else if(selMode.value==='race') startRace(subject);
  else startExam(subject);
});

const incomingRaceCode = (function(){
  if(!raceSupported() || location.hash.indexOf(RACE_LINK_MARKER)!==0) return null;
  const code = raceExtractCode(location.hash);
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  return code;
})();

if(incomingRaceCode){
  raceStartJoin();
  document.getElementById('raceJoinOfferInput').value = incomingRaceCode;
  raceJoinGenerate();
  showScreen('race');
} else {
  showScreen('hub');
}
requestAnimationFrame(frame);

requestAnimationFrame(frame);
