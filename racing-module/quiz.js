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

let pool = [];

// Picks the next question without repeating one until every question in the subject has been
// drawn once, then reshuffles and starts a fresh pass. Call this whenever the game needs a new
// question — at race start, on a checkpoint, on a boost pickup, etc.
export function pickNextQuestion() {
  if (!subject || !subject.questions || subject.questions.length === 0) return null;
  if (pool.length === 0) pool = shuffle(subject.questions);
  const raw = pool.pop();
  return {
    subjectKey,
    subjectName: subject.name,
    category: raw.category,
    text: raw.q,
    answers: raw.answers,
    correctIndex: raw.correct,
    explanation: raw.explanation,
  };
}
