console.log('ANSWER COLORS FILE LOADED - VERSION 3');

// Single source of truth for answer color-coding. Both the bottom-screen answer list (main.js
// showQuestionHud) and the 3D road text (main.js spawnQuestionZone) look up a color by the same
// slot index — the index into a question's answers array, AFTER quiz.js has shuffled it — so
// they read this one array and can never disagree with each other.
//
// Fixed per SLOT, not per answer identity or correctness: slot 0 is always red, slot 1 is always
// blue, etc., regardless of which answer text lands there. quiz.js randomizes which answer gets
// which slot on every question, so the color itself never correlates with which one is correct —
// see the shuffleAnswers() note in quiz.js for why that matters (every question in
// question-bank.js has correct:0, so an unshuffled index-based color would leak the answer).
//
// Six distinct, high-contrast hues — the question bank tops out at 4 answers, so this leaves
// headroom without needing to change if that ever grows.
export const ANSWER_COLORS = [
  { name: 'red', hex: 0xff5555 },
  { name: 'blue', hex: 0x4dc9ff },
  { name: 'yellow', hex: 0xffd166 },
  { name: 'green', hex: 0x4ecb71 },
  { name: 'purple', hex: 0xb18aff },
  { name: 'orange', hex: 0xff9f43 },
];

export function answerColorForSlot(slotIndex) {
  const color = ANSWER_COLORS[slotIndex % ANSWER_COLORS.length];
  console.log(`[COLORS] 1-ASSIGN slot ${slotIndex} (answer #${slotIndex + 1}) -> ${color.name} ${hexToCssColor(color.hex)}`);
  return color;
}

export function hexToCssColor(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
