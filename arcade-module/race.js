// Online multiplayer race mode: WebRTC-linked head-to-head quiz race.

import { SUBJECTS, pctOf, selSubject, shuffleAnswerOptions, shuffleArray, G } from './shared.js';
import { QUESTIONS_PER_RUN, goToHub, input, showScreen } from './arcade.js';
import { formatElapsed } from './exam.js';

// ---------- online multiplayer race ----------
const RACE_ICE_SERVERS = [
  { urls:'stun:stun.l.google.com:19302' },
  { urls:'stun:stun.relay.metered.ca:80' },
  { urls:'turn:global.relay.metered.ca:80', username:'openrelayproject', credential:'openrelayproject' },
  { urls:'turn:global.relay.metered.ca:80?transport=tcp', username:'openrelayproject', credential:'openrelayproject' },
  { urls:'turn:global.relay.metered.ca:443', username:'openrelayproject', credential:'openrelayproject' },
  { urls:'turns:global.relay.metered.ca:443?transport=tcp', username:'openrelayproject', credential:'openrelayproject' },
];

export const raceScreenEl = document.getElementById('raceScreen');
const raceViews = {
  lobby: document.getElementById('raceViewLobby'),
  host: document.getElementById('raceViewHost'),
  join: document.getElementById('raceViewJoin'),
  wait: document.getElementById('raceViewWait'),
  live: document.getElementById('raceViewLive'),
  finishWait: document.getElementById('raceViewFinishWait'),
  results: document.getElementById('raceViewResults'),
};
function showRaceView(name){
  Object.keys(raceViews).forEach(k=>{
    raceViews[k].style.display = (k!==name) ? 'none' : (k==='results' ? 'block' : 'flex');
  });
}

let racePC = null, raceChannel = null, raceRole = null;
let raceSubjectKey = null, raceOrder = [], raceIndex = 0, raceScore = 0, raceCorrectCount = 0, raceStartTime = 0;
let raceMyFinished = false, raceOppFinished = false, raceMyResult = null, raceOppResult = null, raceOppProgress = 0;

export function raceCleanupConnection(){
  if(raceConnectTimeoutHandle){ clearTimeout(raceConnectTimeoutHandle); raceConnectTimeoutHandle = null; }
  if(raceChannel){ try{ raceChannel.close(); }catch(e){} raceChannel = null; }
  if(racePC){ try{ racePC.close(); }catch(e){} racePC = null; }
  raceRole = null;
}

export function raceSupported(){ return typeof RTCPeerConnection !== 'undefined'; }

function waitIceGatherComplete(pc){
  return new Promise(resolve=>{
    if(pc.iceGatheringState==='complete'){ resolve(); return; }
    let done = false;
    const finish = ()=>{
      if(done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', onChange);
      pc.removeEventListener('icecandidate', onCandidate);
      resolve();
    };
    const onChange = ()=>{ if(pc.iceGatheringState==='complete') finish(); };
    const onCandidate = e=>{ if(!e.candidate) finish(); };
    pc.addEventListener('icegatheringstatechange', onChange);
    pc.addEventListener('icecandidate', onCandidate);
    setTimeout(finish, 6000);
  });
}

function bufferToBase64(bytes){
  let binary = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){ binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk)); }
  return btoa(binary);
}
function base64ToBuffer(b64){
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function compressToCode(desc){
  const json = JSON.stringify({ type:desc.type, sdp:desc.sdp });
  if(typeof CompressionStream !== 'undefined'){
    try{
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return 'Z' + bufferToBase64(new Uint8Array(buf));
    }catch(e){ /* fall through to uncompressed */ }
  }
  return 'J' + btoa(json);
}
async function decodeFromCode(code){
  code = code.trim();
  const marker = code[0], body = code.slice(1);
  if(marker==='Z'){
    if(typeof DecompressionStream === 'undefined'){
      throw new Error("This browser can't read compressed codes — ask your opponent to try Chrome, Edge, or a recent Safari/Firefox.");
    }
    const stream = new Blob([base64ToBuffer(body)]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(buf));
  }
  if(marker==='J') return JSON.parse(atob(body));
  return JSON.parse(atob(code)); // backward compatibility with older unmarked codes
}

function raceCopyTextarea(id, btn){
  const el = document.getElementById(id);
  const finish = ()=>{
    if(!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(()=>{ btn.textContent = orig; }, 1200);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(el.value).then(finish).catch(()=>{
      el.select();
      try{ document.execCommand('copy'); finish(); }catch(e){}
    });
  } else {
    el.select();
    try{ document.execCommand('copy'); finish(); }catch(e){}
  }
}

function raceCopyText(text, btn){
  const finish = ()=>{
    if(!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(()=>{ btn.textContent = orig; }, 1200);
  };
  const fallback = ()=>{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); finish(); }catch(e){}
    document.body.removeChild(ta);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(finish).catch(fallback);
  } else {
    fallback();
  }
}

export const RACE_LINK_MARKER = '#race=';
function raceBuildLink(code){
  return location.origin + location.pathname + RACE_LINK_MARKER + encodeURIComponent(code);
}
export function raceExtractCode(input){
  input = input.trim();
  const idx = input.indexOf(RACE_LINK_MARKER);
  if(idx !== -1) return decodeURIComponent(input.slice(idx + RACE_LINK_MARKER.length));
  return input;
}

function raceSetStatus(id, text, isError){
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

let raceConnectTimeoutHandle = null;
function raceWatchConnection(statusId){
  if(raceConnectTimeoutHandle){ clearTimeout(raceConnectTimeoutHandle); raceConnectTimeoutHandle = null; }
  if(!racePC) return;
  racePC.oniceconnectionstatechange = ()=>{
    if(!racePC) return;
    const st = racePC.iceConnectionState;
    if(st==='checking') raceSetStatus(statusId, 'Connecting…');
    else if(st==='failed') raceSetStatus(statusId, "Connection failed — this can happen on restrictive networks. Double-check both codes were copied in full and try again.", true);
    else if(st==='disconnected') raceSetStatus(statusId, 'Connection lost.', true);
  };
  raceConnectTimeoutHandle = setTimeout(()=>{
    if(raceChannel && raceChannel.readyState==='open') return;
    raceSetStatus(statusId, "Still trying to connect. If this doesn't finish within a few more seconds, double-check the codes and try again — some networks block peer-to-peer connections entirely.", true);
  }, 12000);
}

function setupRaceChannelHandlers(){
  raceChannel.onopen = ()=>{
    if(raceConnectTimeoutHandle){ clearTimeout(raceConnectTimeoutHandle); raceConnectTimeoutHandle = null; }
    showRaceView('wait');
    document.getElementById('btnRaceStart').style.display = raceRole==='host' ? 'block' : 'none';
    raceSetStatus('raceWaitStatus', raceRole==='host'
      ? 'Connected! Click Start when you\'re both ready.'
      : 'Connected! Waiting for the host to start…');
  };
  raceChannel.onclose = ()=>{ raceOnDisconnect(); };
  raceChannel.onmessage = e=>{
    let msg;
    try{ msg = JSON.parse(e.data); }catch(err){ return; }
    if(msg.t==='start') raceOnStartMessage(msg);
    else if(msg.t==='progress'){
      raceOppProgress = msg.index;
      if(raceViews.live.style.display!=='none') raceUpdateFills();
    }
    else if(msg.t==='finish') raceOnOppFinish(msg);
  };
}

function raceOnDisconnect(){
  if(raceViews.wait.style.display!=='none') raceSetStatus('raceWaitStatus', 'Opponent disconnected.', true);
  if(raceViews.live.style.display!=='none' || raceViews.finishWait.style.display!=='none'){
    raceSetStatus('raceFinishWaitStatus', 'Opponent disconnected mid-race.', true);
    showRaceView('finishWait');
  }
}

async function raceStartHost(){
  if(!raceSupported()){
    raceSetStatus('raceLobbyStatus', 'Online multiplayer needs a live browser connection (WebRTC), which this preview blocks. Open the GitHub Pages version of this app to race.', true);
    document.getElementById('raceLobbyStatus').style.display = 'block';
    return;
  }
  raceCleanupConnection();
  raceRole = 'host';
  racePC = new RTCPeerConnection({ iceServers: RACE_ICE_SERVERS });
  raceChannel = racePC.createDataChannel('race');
  setupRaceChannelHandlers();
  showRaceView('host');
  document.getElementById('raceHostOfferCode').value = '';
  document.getElementById('raceHostAnswerInput').value = '';
  raceSetStatus('raceHostStatus', 'Generating code…');
  try{
    const offer = await racePC.createOffer();
    await racePC.setLocalDescription(offer);
    await waitIceGatherComplete(racePC);
    const code = await compressToCode(racePC.localDescription);
    document.getElementById('raceHostOfferCode').value = code;
    raceCopyText(raceBuildLink(code), null);
    raceSetStatus('raceHostStatus', 'Invite link copied to your clipboard — send it to your opponent.');
  }catch(err){
    raceSetStatus('raceHostStatus', 'Could not create connection: ' + err.message, true);
  }
}

async function raceHostConnect(){
  const input = document.getElementById('raceHostAnswerInput').value;
  if(!input.trim()){ raceSetStatus('raceHostStatus', "Paste your opponent's reply link or code first.", true); return; }
  try{
    const desc = await decodeFromCode(raceExtractCode(input));
    await racePC.setRemoteDescription(desc);
    raceSetStatus('raceHostStatus', 'Connecting…');
    raceWatchConnection('raceHostStatus');
  }catch(err){
    raceSetStatus('raceHostStatus', "That reply looks invalid or incomplete. Ask your opponent to use the Copy Reply Link button and paste the whole thing.", true);
  }
}

export function raceStartJoin(){
  if(!raceSupported()){
    raceSetStatus('raceLobbyStatus', 'Online multiplayer needs a live browser connection (WebRTC), which this preview blocks. Open the GitHub Pages version of this app to race.', true);
    document.getElementById('raceLobbyStatus').style.display = 'block';
    return;
  }
  raceCleanupConnection();
  raceRole = 'guest';
  racePC = new RTCPeerConnection({ iceServers: RACE_ICE_SERVERS });
  racePC.ondatachannel = e=>{ raceChannel = e.channel; setupRaceChannelHandlers(); };
  showRaceView('join');
  document.getElementById('raceJoinOfferInput').value = '';
  document.getElementById('raceJoinAnswerCode').value = '';
  document.getElementById('raceJoinStep2').style.display = 'none';
  raceSetStatus('raceJoinStatus', '');
}

async function raceJoinGenerate(){
  const input = document.getElementById('raceJoinOfferInput').value;
  if(!input.trim()){ raceSetStatus('raceJoinStatus', "Paste the host's link or code first.", true); return; }
  try{
    const desc = await decodeFromCode(raceExtractCode(input));
    await racePC.setRemoteDescription(desc);
    const answer = await racePC.createAnswer();
    await racePC.setLocalDescription(answer);
    await waitIceGatherComplete(racePC);
    const code = await compressToCode(racePC.localDescription);
    document.getElementById('raceJoinAnswerCode').value = code;
    document.getElementById('raceJoinStep2').style.display = 'flex';
    raceCopyText(raceBuildLink(code), null);
    raceSetStatus('raceJoinStatus', 'Reply link copied to your clipboard — send it back to your opponent, then wait here.');
    raceWatchConnection('raceJoinStatus');
  }catch(err){
    raceSetStatus('raceJoinStatus', "That invite looks invalid or incomplete. Ask your opponent to use the Copy Invite Link button and send the whole link.", true);
  }
}

const raceCategoryEl = document.getElementById('raceCategory');
const raceQuestionEl = document.getElementById('raceQuestion');
const raceOptionsEl = document.getElementById('raceOptions');
const raceMyFillEl = document.getElementById('raceMyFill');
const raceOppFillEl = document.getElementById('raceOppFill');

function raceUpdateFills(){
  raceMyFillEl.style.width = pctOf(raceIndex, raceOrder.length) + '%';
  raceOppFillEl.style.width = pctOf(raceOppProgress, raceOrder.length) + '%';
}

function raceLoadQuestion(){
  const q = SUBJECTS[raceSubjectKey].questions[raceOrder[raceIndex]];
  raceCategoryEl.textContent = q.category;
  raceQuestionEl.textContent = q.q;
  const opts = shuffleAnswerOptions(q);
  raceOptionsEl.innerHTML = '';
  opts.forEach(o=>{
    const btn = document.createElement('button');
    btn.className = 'exam-option';
    btn.type = 'button';
    btn.textContent = o.text;
    btn.addEventListener('click', ()=>raceAnswer(o, btn));
    raceOptionsEl.appendChild(btn);
  });
  raceUpdateFills();
}

function raceAnswer(chosen, btnEl){
  Array.from(raceOptionsEl.children).forEach(b=>{ b.disabled = true; });
  if(chosen.correct){ raceScore += 100; raceCorrectCount += 1; btnEl.classList.add('is-correct'); }
  else { btnEl.classList.add('is-wrong'); }
  raceIndex += 1;
  if(raceChannel && raceChannel.readyState==='open'){
    raceChannel.send(JSON.stringify({ t:'progress', index: raceIndex }));
  }
  raceUpdateFills();
  setTimeout(()=>{
    if(raceIndex >= raceOrder.length) raceFinishMine();
    else raceLoadQuestion();
  }, 260);
}

function raceBeginLocal(){
  raceIndex = 0; raceScore = 0; raceCorrectCount = 0;
  raceMyFinished = false; raceOppFinished = false;
  raceMyResult = null; raceOppResult = null;
  raceOppProgress = 0;
  raceStartTime = Date.now();
  showRaceView('live');
  raceLoadQuestion();
}

function btnRaceStartClick(){
  if(raceRole!=='host' || !raceChannel || raceChannel.readyState!=='open') return;
  raceSubjectKey = selSubject.value;
  G.currentSubject = raceSubjectKey;
  raceOrder = shuffleArray(Array.from({length:SUBJECTS[raceSubjectKey].questions.length}, (_,i)=>i)).slice(0, QUESTIONS_PER_RUN);
  raceChannel.send(JSON.stringify({ t:'start', subjectKey: raceSubjectKey, order: raceOrder }));
  raceBeginLocal();
}

function raceOnStartMessage(msg){
  raceSubjectKey = msg.subjectKey;
  raceOrder = msg.order;
  raceBeginLocal();
}

function raceFinishMine(){
  raceMyFinished = true;
  const elapsedMs = Date.now() - raceStartTime;
  raceMyResult = { correct: raceCorrectCount, total: raceOrder.length, elapsedMs };
  if(raceChannel && raceChannel.readyState==='open'){
    raceChannel.send(JSON.stringify({ t:'finish', correct: raceCorrectCount, total: raceOrder.length, elapsedMs }));
  }
  if(raceOppFinished) raceShowResults();
  else {
    raceSetStatus('raceFinishWaitStatus', 'You finished! Waiting for your opponent…');
    showRaceView('finishWait');
  }
}

function raceOnOppFinish(msg){
  raceOppFinished = true;
  raceOppResult = { correct: msg.correct, total: msg.total, elapsedMs: msg.elapsedMs };
  raceOppProgress = msg.total;
  if(raceViews.live.style.display!=='none') raceUpdateFills();
  if(raceMyFinished) raceShowResults();
}

function raceShowResults(){
  showRaceView('results');
  const myPct = pctOf(raceMyResult.correct, raceMyResult.total);
  const oppPct = pctOf(raceOppResult.correct, raceOppResult.total);
  document.getElementById('raceMyScore').textContent = myPct + '%';
  document.getElementById('raceMyDetail').textContent = raceMyResult.correct + ' of ' + raceMyResult.total + ' correct · ' + formatElapsed(raceMyResult.elapsedMs);
  document.getElementById('raceOppScore').textContent = oppPct + '%';
  document.getElementById('raceOppDetail').textContent = raceOppResult.correct + ' of ' + raceOppResult.total + ' correct · ' + formatElapsed(raceOppResult.elapsedMs);

  const myCard = document.getElementById('raceMyCard');
  const oppCard = document.getElementById('raceOppCard');
  myCard.classList.remove('winner'); oppCard.classList.remove('winner');
  const banner = document.getElementById('raceWinnerBanner');
  let iWon = null;
  if(myPct !== oppPct) iWon = myPct > oppPct;
  else if(raceMyResult.elapsedMs !== raceOppResult.elapsedMs) iWon = raceMyResult.elapsedMs < raceOppResult.elapsedMs;

  if(iWon===null){ banner.textContent = "It's a tie!"; }
  else if(iWon){ banner.textContent = 'You win!'; myCard.classList.add('winner'); }
  else { banner.textContent = 'Opponent wins!'; oppCard.classList.add('winner'); }
}

function raceRematch(){
  if(raceRole==='host') btnRaceStartClick();
  else {
    showRaceView('wait');
    document.getElementById('btnRaceStart').style.display = 'none';
    raceSetStatus('raceWaitStatus', 'Waiting for the host to start a rematch…');
  }
}

export function startRace(subjectKey){
  G.currentSubject = subjectKey;
  raceCleanupConnection();
  document.getElementById('raceLobbyStatus').style.display = 'none';
  showRaceView('lobby');
  showScreen('race');
}

document.getElementById('btnRaceHost').addEventListener('click', raceStartHost);
document.getElementById('btnRaceJoin').addEventListener('click', raceStartJoin);
document.getElementById('btnCopyHostLink').addEventListener('click', function(){ raceCopyText(raceBuildLink(document.getElementById('raceHostOfferCode').value), this); });
document.getElementById('btnCopyHostOffer').addEventListener('click', function(){ raceCopyTextarea('raceHostOfferCode', this); });
document.getElementById('btnRaceHostConnect').addEventListener('click', raceHostConnect);
document.getElementById('btnRaceJoinGenerate').addEventListener('click', raceJoinGenerate);
document.getElementById('btnCopyJoinLink').addEventListener('click', function(){ raceCopyText(raceBuildLink(document.getElementById('raceJoinAnswerCode').value), this); });
document.getElementById('btnCopyJoinAnswer').addEventListener('click', function(){ raceCopyTextarea('raceJoinAnswerCode', this); });
document.getElementById('btnRaceStart').addEventListener('click', btnRaceStartClick);
document.getElementById('btnRaceRematch').addEventListener('click', raceRematch);
document.getElementById('btnRaceHome').addEventListener('click', goToHub);
document.getElementById('btnRaceHub').addEventListener('click', goToHub);
['raceHostOfferCode','raceJoinAnswerCode'].forEach(id=>{
  document.getElementById(id).addEventListener('focus', function(){ this.select(); });
});

