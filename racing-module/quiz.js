import { SUBJECTS } from '../question-bank.js';

// The arcade hub passes ?subject=<key> when it links to racing-demo.html (see
// arcade-module/main.js). Falls back to a sane default so the page still works standalone.
const DEFAULT_SUBJECT = 'gitlab';

function resolveSubjectKey() {
  const param = new URLSearchParams(window.location.search).get('subject');
  return (param && SUBJECTS[param]) ? param : DEFAULT_SUBJECT;
}

export const subjectKey = resolveSubjectKey();
export const subject = SUBJECTS[subjectKey];

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Every question in question-bank.js has correct:0 — the correct answer is always authored
// first. Returning answers in that raw order would make the answer's ORIGINAL position (and,
// now, its assigned color — see answerColors.js) a 100%-reliable tell. This shuffles the
// answer/color slot assignment per question while keeping correctIndex pointing at the right one.
function shuffleAnswers(answers, correctIndex) {
  const order = answers.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    answers: order.map(i => answers[i]),
    correctIndex: order.indexOf(correctIndex),
  };
}

// Returns a function that picks the next question for `key`, without repeating one until every
// question in the subject has been drawn once, then reshuffles for a fresh pass — making sure the
// new pass doesn't start with the question that just ended the old one. Returns null for an
// unknown or empty subject. Each picker keeps its own pool.
export function createQuestionPicker(key) {
  const subj = SUBJECTS[key];
  let pool = [];
  let last = null;
  return function pickQuestion() {
    if (!subj || !subj.questions || subj.questions.length === 0) return null;
    if (pool.length === 0) {
      pool = shuffle(subj.questions);
      // pool.pop() draws from the end, so move a repeat of `last` away from it.
      if (pool.length > 1 && pool[pool.length - 1] === last) [pool[0], pool[pool.length - 1]] = [pool[pool.length - 1], pool[0]];
    }
    const raw = pool.pop();
    last = raw;
    const { answers, correctIndex } = shuffleAnswers(raw.answers, raw.correct);
    return {
      subjectKey: key,
      subjectName: subj.name,
      category: raw.category,
      text: raw.q,
      answers,
      correctIndex,
      explanation: raw.explanation,
    };
  };
}

// The racing game's picker, for the subject in this page's ?subject= parameter. Call this whenever
// the game needs a new question — at race start, on a checkpoint, on a boost pickup, etc.
export const pickNextQuestion = createQuestionPicker(subjectKey);
