// Entry point: wires up the hub screen and boots the game loop.
//
// Cache-busting: every import between the arcade-module files carries the same ?v=N as this file's
// <script> tag in index.html. When any of these files changes, bump N in all of them together
// (they must match exactly — a file imported under two different URLs would load twice, with two
// separate copies of its state).

import { ensureAudio, resizeCanvas } from './shared.js?v=17';
import { frame, showScreen, startArcade } from './arcade.js?v=17';
import { startForestMode } from './forest.js?v=17';
import { startExam } from './exam.js?v=17';
import { startPenalty, resizePenaltyCanvas } from './penalty.js?v=17';
import { startPacman, resizePacCanvas } from './pacman.js?v=17';
import { RACE_LINK_MARKER, raceExtractCode, raceStartJoin, raceSupported, startRace } from './race.js?v=17';
import { selSubject, SUBJECTS } from './shared.js?v=17';
import { GAMES, findGame, createGameTile } from '../game-list.js?v=2';

window.addEventListener('resize', () => { resizeCanvas(); resizePenaltyCanvas(); resizePacCanvas(); });

// ---------- hub ----------
// The subject is picked from the dropdown; games are picked from a grid of picture tiles. The
// game list and tiles are shared with the HMRC job picker (game-list.js).
function startMode(mode){
  ensureAudio();
  const subject = selSubject.value;
  const game = findGame(mode);
  if(game && game.page) {
    window.location.href = game.page + '?subject=' + encodeURIComponent(subject);
    return;
  }
  if(mode==='arcade') startArcade(subject);
  else if(mode==='penalty') startPenalty(subject);
  else if(mode==='pacman') startPacman(subject);
  else if(mode==='forest') startForestMode(subject);
  else if(mode==='race') startRace(subject);
  else startExam(subject);
}

const gameGridEl = document.getElementById('gameGrid');
GAMES.forEach((game, i) => {
  const tile = createGameTile(game, i);
  tile.setAttribute('role', 'listitem');
  tile.addEventListener('click', () => startMode(game.id));
  gameGridEl.appendChild(tile);
});

// Header counts, from the data so they stay right as subjects and games are added.
const subjectList = Object.values(SUBJECTS);
document.getElementById('statSubjects').textContent = `${subjectList.length} Subjects`;
document.getElementById('statGames').textContent = `${GAMES.length} Games`;
document.getElementById('statQuestions').textContent = `${subjectList.reduce((n, s) => n + s.questions.length, 0)} Questions`;

const incomingRaceCode = (function(){
  if(!raceSupported() || location.hash.indexOf(RACE_LINK_MARKER)!==0) return null;
  const code = raceExtractCode(location.hash);
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  return code;
})();

// Other pages (e.g. the HMRC job picker) launch the games that run inside this page with
// ?play=<game>&subject=<subject>; start it straight away, then tidy the URL so Back/reload
// lands on the hub.
const launchParams = new URLSearchParams(location.search);
const launchGame = findGame(launchParams.get('play'));
if(SUBJECTS[launchParams.get('subject')]) selSubject.value = launchParams.get('subject');
if(launchParams.has('play')){
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}

if(launchGame && !launchGame.page){
  startMode(launchGame.id);
} else if(incomingRaceCode){
  raceStartJoin();
  document.getElementById('raceJoinOfferInput').value = incomingRaceCode;
  raceJoinGenerate();
  showScreen('race');
} else {
  showScreen('hub');
}
requestAnimationFrame(frame);

requestAnimationFrame(frame);
