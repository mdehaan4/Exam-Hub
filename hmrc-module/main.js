import { createHMRCGame } from './three-game.js';

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
  createHMRCGame(root);
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
