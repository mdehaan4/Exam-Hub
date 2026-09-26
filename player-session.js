// What the app remembers about the player for the browser session (sessionStorage: it survives
// moving between this app's pages in the same tab, e.g. HMRC Mode → Football Penalties → back, and
// clears when the tab is closed). One place for the keys, so every page reads the same values.
//
//   examhub:hmrcUser           { name, age, employmentStatus: 'Employed' | 'Self-employed' }
//                              — HMRC Mode's Welcome form (hmrc-module/main.js)
//   examhub:hmrcReturn         { stall } — the fairground stall the player left from, to put them
//                              back beside it (hmrc-module/job-picker.js → main.js)
//   examhub:grossAnnualSalary  { grossAnnualSalary, goals, perGoal, source, subject, recordedAt }
//                              — the latest salary award (Football Penalties, arcade-module/penalty.js)

const KEYS = {
  hmrcUser: 'examhub:hmrcUser',
  hmrcReturn: 'examhub:hmrcReturn',
  salary: 'examhub:grossAnnualSalary',
};

function read(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable (private mode, blocked): the game still works, just forgets */ }
}

export const EMPLOYMENT = { EMPLOYED: 'Employed', SELF_EMPLOYED: 'Self-employed' };

// HMRC Mode's Welcome answers. The employment status decides how game rewards are paid out:
// 'Employed' → a PAYE payslip, 'Self-employed' → the Making Tax Digital app (see shared.js).
export function getHmrcUser() {
  const user = read(KEYS.hmrcUser);
  return user && user.name && Object.values(EMPLOYMENT).includes(user.employmentStatus) ? user : null;
}
export const saveHmrcUser = (user) => write(KEYS.hmrcUser, user);
export const getEmploymentStatus = () => (getHmrcUser() ? getHmrcUser().employmentStatus : null);

export const getHmrcReturn = () => read(KEYS.hmrcReturn);
export const saveHmrcReturn = (value) => write(KEYS.hmrcReturn, value);

export const getSalary = () => read(KEYS.salary);
export const saveSalary = (record) => write(KEYS.salary, record);
