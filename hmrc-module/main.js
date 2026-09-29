import { createHMRCGame } from './three-game.js?v=4';
import { createJobPicker } from './job-picker.js?v=4';
import { getHmrcUser, saveHmrcUser, getHmrcReturn, saveHmrcReturn } from '../player-session.js?v=1';

// The Welcome answers (incl. employment status) and the stall the player left from are kept for
// the session in player-session.js, so a player who leaves the fairground for a game picked at a
// stall — and comes back, e.g. via the payslip's NEXT — returns to free movement instead of
// starting over. The employment status also decides how Football Penalties pays out.

export const subjectKey = new URLSearchParams(window.location.search).get('subject');

let onboardingData = {
  name: '',
  age: null,
  employmentStatus: '',
};

const root = document.getElementById('game-root');
const onboardingOverlay = document.getElementById('onboardingOverlay');
const onboardingForm = document.getElementById('onboardingForm');
const nameInput = document.getElementById('playerName');
const ageInput = document.getElementById('playerAge');
const employmentInput = document.getElementById('employmentStatus');
const nameError = document.getElementById('nameError');
const ageError = document.getElementById('ageError');
const employmentError = document.getElementById('employmentError');

const validateOnboarding = () => {
  let isValid = true;
  const nameValue = nameInput.value.trim();
  const ageValue = Number(ageInput.value);
  const employmentValue = employmentInput.value;

  nameError.textContent = '';
  ageError.textContent = '';
  employmentError.textContent = '';

  if (!nameValue) {
    nameError.textContent = 'Please enter your name.';
    isValid = false;
  }

  if (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120) {
    ageError.textContent = 'Please enter a valid age between 1 and 120.';
    isValid = false;
  }

  if (employmentValue !== 'Employed' && employmentValue !== 'Self-employed') {
    employmentError.textContent = 'Please select your employment status.';
    isValid = false;
  }

  return isValid;
};

const initGame = () => {
  if (!root) {
    return;
  }

  root.classList.add('visible');
  onboardingOverlay.classList.add('hidden');
  // The stalls' job picker locks movement while it's open (see job-picker.js / three-game.js).
  let game = null;
  const picker = createJobPicker({
    subject: subjectKey || 'gitlab',
    onOpenChange: (open) => game?.setInputLocked(open),
  });
  game = createHMRCGame(root, { onNearbyStallChange: (stall) => picker.setNearbyStall(stall) });
  window.__hmrcPicker = picker;

  const returning = getHmrcReturn();
  saveHmrcReturn(null); // used once
  const stall = returning && game.stalls.find((s) => s.banner === returning.stall);
  if (stall) game.placePlayerAwayFromStall(stall);
};

const handleSubmit = (event) => {
  event.preventDefault();

  if (!validateOnboarding()) {
    return;
  }

  onboardingData = {
    name: nameInput.value.trim(),
    age: Number(ageInput.value),
    employmentStatus: employmentInput.value,
  };

  window.hmrcUser = onboardingData;
  saveHmrcUser(onboardingData);
  initGame();
};

if (onboardingForm) {
  onboardingForm.addEventListener('submit', handleSubmit);
}

if (!root || !onboardingOverlay || !onboardingForm) {
  console.warn('HMRC onboarding UI not ready.');
}

if (root) {
  root.classList.remove('visible');
}

// A returning player (this session) sees the Welcome form again, pre-filled with their saved
// answers, so they can switch between Employed and Self-employed — which changes how Football
// Penalties pays them — or just press Continue. If they came back from a game picked at a stall,
// they're still put back beside it once they continue (initGame).
const savedUser = getHmrcUser();
if (savedUser) {
  nameInput.value = savedUser.name;
  ageInput.value = savedUser.age;
  employmentInput.value = savedUser.employmentStatus;
  onboardingOverlay.querySelector('h2').textContent = 'Welcome back';
  onboardingOverlay.querySelector('p').textContent = 'Check your details. You can switch between employed and self-employed before you continue.';
  onboardingForm.querySelector('.submit-btn').textContent = 'Continue';
  employmentInput.focus();
}
