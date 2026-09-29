// Exam mode: linear mock-exam flow with review/history.

import { SUBJECTS, pctOf, shuffleAnswerOptions, shuffleArray, G } from './shared.js?v=17';
import { examScreenEl, goToHub, scoreEl, showScreen } from './arcade.js?v=17';

// ---------- exam mode ----------
let examQuestions = [];
let examIndex = 0;
let examAnswered = false;
let examResultsLog = [];
let examStartTime = 0;
let examElapsedMs = 0;
let examTimerHandle = null;
let examHistory = [];
let historyViewPos = null;
let currentQuestionSnapshot = null;
let currentLiveOpts = null;
let examFlagged = new Set();

const examWordmarkEl = document.getElementById('examWordmark');
const examProgramEl = document.getElementById('examProgram');
const examStrapEl = document.getElementById('examStrap');
const examNavbarEl = document.getElementById('examNavbar');
const btnExamFlag = document.getElementById('btnExamFlag');
const btnExamPrev = document.getElementById('btnExamPrev');
const examSubjectTitleEl = document.getElementById('examSubjectTitle');
const examCountEl = document.getElementById('examCount');
const examTimerEl = document.getElementById('examTimer');
const examProgressWrapEl = document.getElementById('examProgressWrap');
const examProgressFillEl = document.getElementById('examProgressFill');
const examCardEl = document.getElementById('examCard');
const examCategoryEl = document.getElementById('examCategory');
const examQuestionEl = document.getElementById('examQuestion');
const examOptionsEl = document.getElementById('examOptions');
const examExplanationEl = document.getElementById('examExplanation');
const examTagEl = document.getElementById('examTag');
const examExplanationTextEl = document.getElementById('examExplanationText');
const btnExamNext = document.getElementById('btnExamNext');
const examResultsEl = document.getElementById('examResults');
const resultsBannerEl = document.getElementById('resultsBanner');
const resultsScoreEl = document.getElementById('resultsScore');
const resultsTimeEl = document.getElementById('resultsTime');
const resultsCategoriesEl = document.getElementById('resultsCategories');

export function formatElapsed(ms){
  const totalSec = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(totalSec/60);
  const s = totalSec%60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

export function stopExamTimer(){
  if(examTimerHandle){ clearInterval(examTimerHandle); examTimerHandle = null; }
}

function startExamTimer(){
  stopExamTimer();
  examStartTime = Date.now();
  examElapsedMs = 0;
  examTimerEl.textContent = '00:00';
  examTimerHandle = setInterval(()=>{
    examElapsedMs = Date.now() - examStartTime;
    examTimerEl.textContent = formatElapsed(examElapsedMs);
  }, 1000);
}

function applyExamTheme(theme){
  const s = examScreenEl.style;
  s.setProperty('--biz-accent', theme.accent);
  s.setProperty('--biz-accent-2', theme.accent2);
  s.setProperty('--biz-accent-dim', theme.accentDim);
  examWordmarkEl.textContent = theme.wordmark;
  examProgramEl.textContent = theme.program + ' · ' + theme.provider;
}

export function startExam(subjectKey){
  G.currentSubject = subjectKey;
  const subj = SUBJECTS[subjectKey];
  applyExamTheme(subj.theme);
  examSubjectTitleEl.textContent = subj.name.toUpperCase();
  examQuestions = shuffleArray(subj.questions.slice());
  examIndex = 0;
  examResultsLog = [];
  examHistory = [];
  historyViewPos = null;
  currentQuestionSnapshot = null;
  currentLiveOpts = null;
  examFlagged = new Set();
  examCardEl.style.display = 'flex';
  examProgressWrapEl.style.display = 'block';
  examStrapEl.style.display = 'flex';
  examNavbarEl.style.display = 'flex';
  examResultsEl.style.display = 'none';
  showScreen('exam');
  loadExamQuestion();
  startExamTimer();
}

function updateFlagButtonVisual(){
  const flagged = historyViewPos === null && examFlagged.has(examIndex);
  btnExamFlag.classList.toggle('is-flagged', flagged);
}

function updateNavButtons(){
  if(historyViewPos !== null){
    btnExamPrev.disabled = historyViewPos <= 0;
    btnExamNext.style.display = 'block';
    btnExamNext.textContent = 'Next  →';
  } else {
    btnExamPrev.disabled = examHistory.length === 0;
    if(currentQuestionSnapshot){
      btnExamNext.style.display = 'block';
      const isLastQuestion = (examIndex+1 >= examQuestions.length);
      btnExamNext.textContent = isLastQuestion ? 'View Results  →' : 'Next Question  →';
    } else {
      btnExamNext.style.display = 'none';
    }
  }
}

function renderLockedOptions(opts, chosenIdx){
  examOptionsEl.innerHTML = '';
  opts.forEach((o,i)=>{
    const btn = document.createElement('button');
    btn.className = 'exam-option';
    btn.type = 'button';
    btn.textContent = o.text;
    btn.disabled = true;
    if(o.correct) btn.classList.add('is-correct');
    else if(i===chosenIdx) btn.classList.add('is-wrong');
    examOptionsEl.appendChild(btn);
  });
  const wasCorrect = opts[chosenIdx].correct;
  examTagEl.textContent = wasCorrect ? 'Correct' : 'Incorrect';
  examTagEl.className = 'exam-explanation-tag ' + (wasCorrect?'correct':'wrong');
  examExplanationEl.style.display = 'block';
}

function loadExamQuestion(){
  historyViewPos = null;
  examAnswered = false;
  currentQuestionSnapshot = null;
  const q = examQuestions[examIndex];
  examCountEl.textContent = (examIndex+1) + ' of ' + examQuestions.length;
  examProgressFillEl.style.width = pctOf(examIndex, examQuestions.length) + '%';
  examCategoryEl.textContent = q.category;
  examQuestionEl.textContent = q.q;

  const opts = shuffleAnswerOptions(q);
  currentLiveOpts = opts;
  examOptionsEl.innerHTML = '';
  opts.forEach(o=>{
    const btn = document.createElement('button');
    btn.className = 'exam-option';
    btn.type = 'button';
    btn.textContent = o.text;
    btn.addEventListener('click', ()=>selectExamAnswer(o, opts, btn, q));
    examOptionsEl.appendChild(btn);
  });
  examExplanationEl.style.display = 'none';
  updateFlagButtonVisual();
  updateNavButtons();
}

function selectExamAnswer(chosen, allOpts, btnEl, q){
  if(examAnswered) return;
  examAnswered = true;
  const correct = chosen.correct;
  const chosenIdx = allOpts.indexOf(chosen);
  examResultsLog.push({ category:q.category, correct });

  const buttons = Array.from(examOptionsEl.children);
  buttons.forEach((b,i)=>{
    b.disabled = true;
    if(allOpts[i].correct) b.classList.add('is-correct');
    else if(b===btnEl) b.classList.add('is-wrong');
  });

  examTagEl.textContent = correct ? 'Correct' : 'Incorrect';
  examTagEl.className = 'exam-explanation-tag ' + (correct?'correct':'wrong');
  examExplanationTextEl.textContent = q.explanation;
  examExplanationEl.style.display = 'block';

  currentQuestionSnapshot = { index:examIndex, category:q.category, q:q.q, explanation:q.explanation, opts:allOpts, chosenIdx };
  updateNavButtons();

  const isLastQuestion = (examIndex+1 >= examQuestions.length);
  if(isLastQuestion){
    examElapsedMs = Date.now() - examStartTime;
    examTimerEl.textContent = formatElapsed(examElapsedMs);
    stopExamTimer();
  }
}

function renderHistoryEntry(pos){
  historyViewPos = pos;
  const h = examHistory[pos];
  examCountEl.textContent = (h.index+1) + ' of ' + examQuestions.length;
  examProgressFillEl.style.width = pctOf(h.index, examQuestions.length) + '%';
  examCategoryEl.textContent = h.category;
  examQuestionEl.textContent = h.q;
  renderLockedOptions(h.opts, h.chosenIdx);
  examExplanationTextEl.textContent = h.explanation;
  updateFlagButtonVisual();
  updateNavButtons();
}

function renderLiveFromState(){
  historyViewPos = null;
  const q = examQuestions[examIndex];
  examCountEl.textContent = (examIndex+1) + ' of ' + examQuestions.length;
  examProgressFillEl.style.width = pctOf(examIndex, examQuestions.length) + '%';
  examCategoryEl.textContent = q.category;
  examQuestionEl.textContent = q.q;
  if(currentQuestionSnapshot){
    renderLockedOptions(currentQuestionSnapshot.opts, currentQuestionSnapshot.chosenIdx);
    examExplanationTextEl.textContent = q.explanation;
  } else {
    examOptionsEl.innerHTML = '';
    currentLiveOpts.forEach(o=>{
      const btn = document.createElement('button');
      btn.className = 'exam-option';
      btn.type = 'button';
      btn.textContent = o.text;
      btn.addEventListener('click', ()=>selectExamAnswer(o, currentLiveOpts, btn, q));
      examOptionsEl.appendChild(btn);
    });
    examExplanationEl.style.display = 'none';
  }
  updateFlagButtonVisual();
  updateNavButtons();
}

function examNext(){
  if(historyViewPos !== null){
    if(historyViewPos < examHistory.length - 1) renderHistoryEntry(historyViewPos + 1);
    else renderLiveFromState();
    return;
  }
  examHistory.push(currentQuestionSnapshot);
  currentQuestionSnapshot = null;
  examIndex += 1;
  if(examIndex >= examQuestions.length) showExamResults();
  else loadExamQuestion();
}

function examPrev(){
  if(historyViewPos !== null){
    if(historyViewPos > 0) renderHistoryEntry(historyViewPos - 1);
    return;
  }
  if(examHistory.length === 0) return;
  renderHistoryEntry(examHistory.length - 1);
}

btnExamPrev.addEventListener('click', examPrev);
btnExamFlag.addEventListener('click', ()=>{
  if(historyViewPos !== null) return;
  if(examFlagged.has(examIndex)) examFlagged.delete(examIndex);
  else examFlagged.add(examIndex);
  updateFlagButtonVisual();
});

function showExamResults(){
  stopExamTimer();
  examCardEl.style.display = 'none';
  examProgressWrapEl.style.display = 'none';
  examStrapEl.style.display = 'none';
  examNavbarEl.style.display = 'none';
  examResultsEl.style.display = 'flex';

  const total = examResultsLog.length;
  const correct = examResultsLog.filter(r=>r.correct).length;
  const pct = pctOf(correct, total);
  const passed = pct >= 75;

  resultsBannerEl.textContent = passed ? 'Passed' : 'Not Passed';
  resultsBannerEl.className = 'results-banner ' + (passed?'pass':'fail');

  resultsScoreEl.textContent = '';
  const pctStrong = document.createElement('b');
  pctStrong.textContent = pct + '%';
  resultsScoreEl.append(pctStrong, ' · ' + correct + ' of ' + total + ' correct (pass mark 75%)');
  resultsTimeEl.textContent = 'Time taken: ' + formatElapsed(examElapsedMs);

  const byCat = {};
  examResultsLog.forEach(r=>{
    if(!byCat[r.category]) byCat[r.category] = { correct:0, total:0 };
    byCat[r.category].total += 1;
    if(r.correct) byCat[r.category].correct += 1;
  });

  resultsCategoriesEl.innerHTML = '';
  Object.keys(byCat).sort().forEach(cat=>{
    const c = byCat[cat];
    const p = pctOf(c.correct, c.total);
    const color = p>=75 ? 'var(--biz-pass)' : (p>=50 ? 'var(--biz-amber)' : 'var(--biz-fail)');

    const row = document.createElement('div');
    row.className = 'cat-row';

    const top = document.createElement('div');
    top.className = 'cat-row-top';
    const nameEl = document.createElement('span');
    nameEl.className = 'cat-name';
    nameEl.textContent = cat;
    const scoreEl = document.createElement('span');
    scoreEl.className = 'cat-score';
    scoreEl.textContent = c.correct + '/' + c.total + ' · ' + p + '%';
    top.append(nameEl, scoreEl);

    const bar = document.createElement('div');
    bar.className = 'cat-bar';
    const barFill = document.createElement('div');
    barFill.className = 'cat-bar-fill';
    barFill.style.width = p + '%';
    barFill.style.background = color;
    bar.appendChild(barFill);

    row.append(top, bar);
    resultsCategoriesEl.appendChild(row);
  });
}

btnExamNext.addEventListener('click', examNext);
document.getElementById('btnExamHub').addEventListener('click', goToHub);
document.getElementById('btnExamRetry').addEventListener('click', ()=>startExam(G.currentSubject));
document.getElementById('btnExamHome').addEventListener('click', goToHub);
document.getElementById('btnHub').addEventListener('click', goToHub);

