// Payslip calculation for the games' salary rewards (e.g. Football Penalties: £15,000 per goal).
//
// ILLUSTRATIVE FIGURES FOR GAME PURPOSES ONLY — this is NOT an exact HMRC calculation.
// It uses simplified 2024/25 England/Wales/NI bands applied to one annual gross figure:
//   - Income Tax: £12,570 Personal Allowance, then 20% / 40% / 45% at the thresholds below.
//     Simplified: the Personal Allowance is NOT tapered away above £100,000 as it really is;
//     Scottish rates, tax codes, pension contributions and benefits in kind are ignored.
//   - National Insurance: Class 1 employee rates applied annually (8% main rate, 2% above the
//     upper limit). Real NI is worked out per pay period, not on the annual total.
//   - Student Loan: Plan 2 only, 9% above the annual threshold. Real repayments are per pay period.
//   - Amounts are rounded to the penny; real PAYE rounds tax and NI in specific ways per period.
// Pure function, no DOM — usable from any page (penalty shootout, HMRC Mode, ...).

const PERSONAL_ALLOWANCE = 12570;
const BASIC_RATE_LIMIT = 50270;       // basic rate applies to income from £12,571 up to this
const HIGHER_RATE_LIMIT = 125140;     // higher rate up to this; additional rate above it

const TAX_BANDS = [
  { name: 'Personal Allowance', from: 0, to: PERSONAL_ALLOWANCE, rate: 0 },
  { name: 'Basic rate', from: PERSONAL_ALLOWANCE, to: BASIC_RATE_LIMIT, rate: 0.20 },
  { name: 'Higher rate', from: BASIC_RATE_LIMIT, to: HIGHER_RATE_LIMIT, rate: 0.40 },
  { name: 'Additional rate', from: HIGHER_RATE_LIMIT, to: Infinity, rate: 0.45 },
];

const NI_BANDS = [
  { name: 'Below Primary Threshold', from: 0, to: 12570, rate: 0 },
  { name: 'Main rate', from: 12570, to: 50270, rate: 0.08 },
  { name: 'Above Upper Earnings Limit', from: 50270, to: Infinity, rate: 0.02 },
];

const STUDENT_LOAN_PLAN_2 = { threshold: 27295, rate: 0.09 };

const pennies = (amount) => Math.round(amount * 100) / 100;

// Applies banded rates to `gross`: each band taxes only the slice of income that falls inside it.
function applyBands(gross, bands) {
  const lines = bands.map(({ name, from, to, rate }) => {
    const income = Math.max(0, Math.min(gross, to) - from);
    return { name, rate, from, to, income: pennies(income), amount: pennies(income * rate) };
  });
  return { total: pennies(lines.reduce((sum, line) => sum + line.amount, 0)), bands: lines };
}

/**
 * Works out an illustrative annual payslip from a gross salary.
 *
 * @param {number} grossAnnual  gross annual pay in pounds (e.g. goals × £15,000)
 * @param {{ studentLoan?: boolean }} [options]  studentLoan: whether the player repays a Plan 2
 *   student loan (default true). Nothing is deducted below the threshold either way.
 * @returns {{
 *   gross: number,
 *   tax: { total: number, bands: Array<{ name, rate, from, to, income, amount }> },
 *   nationalInsurance: { total: number, bands: Array<{ name, rate, from, to, income, amount }> },
 *   studentLoan: { applies: boolean, plan: string, threshold: number, rate: number, amount: number },
 *   totalDeductions: number,
 *   net: number,
 *   monthly: { gross: number, tax: number, nationalInsurance: number, studentLoan: number, net: number },
 * }} all amounts in pounds, rounded to the penny
 */
export function calculatePayslip(grossAnnual, { studentLoan = true } = {}) {
  const gross = pennies(Math.max(0, Number(grossAnnual) || 0));

  const tax = applyBands(gross, TAX_BANDS);
  const nationalInsurance = applyBands(gross, NI_BANDS);
  const loanAmount = studentLoan
    ? pennies(Math.max(0, gross - STUDENT_LOAN_PLAN_2.threshold) * STUDENT_LOAN_PLAN_2.rate)
    : 0;

  const totalDeductions = pennies(tax.total + nationalInsurance.total + loanAmount);
  const net = pennies(gross - totalDeductions);

  return {
    gross,
    tax,
    nationalInsurance,
    studentLoan: {
      applies: studentLoan,
      plan: 'Plan 2',
      threshold: STUDENT_LOAN_PLAN_2.threshold,
      rate: STUDENT_LOAN_PLAN_2.rate,
      amount: loanAmount,
    },
    totalDeductions,
    net,
    monthly: {
      gross: pennies(gross / 12),
      tax: pennies(tax.total / 12),
      nationalInsurance: pennies(nationalInsurance.total / 12),
      studentLoan: pennies(loanAmount / 12),
      net: pennies(net / 12),
    },
  };
}

// ---------- self-employed (Self Assessment / Making Tax Digital) ----------
// ILLUSTRATIVE, like calculatePayslip above — NOT an exact HMRC calculation. For a self-employed
// player (HMRC Mode's employment status), the reward is trading profit rather than salary:
//   - Income Tax: same simplified bands as above.
//   - Class 4 NI (2024/25): 6% on profits £12,570–£50,270, 2% above.
//   - Class 2 NI: £0 — from 6 April 2024 it is no longer compulsory; profits above £6,725 get the
//     NI credit without paying it.
//   - Student Loan Plan 2: 9% above £27,295, collected through Self Assessment.
//   - Simplified: no expenses or trading allowance, and payments on account are not shown.
//     The 2024/25 bill is due by 31 January 2026.
const CLASS_4_BANDS = [
  { name: 'Below Lower Profits Limit', from: 0, to: 12570, rate: 0 },
  { name: 'Main rate', from: 12570, to: 50270, rate: 0.06 },
  { name: 'Above Upper Profits Limit', from: 50270, to: Infinity, rate: 0.02 },
];

/**
 * Works out an illustrative Self Assessment tax bill from a year's self-employed profit.
 * @param {number} profit  taxable trading profit for the year, in pounds
 * @param {{ studentLoan?: boolean }} [options]  as for calculatePayslip
 * @returns {{ profit, tax, class4NI, class2NI, studentLoan, totalTax, net, dueDate, quarters }}
 *   tax / class4NI are { total, bands }; quarters is the profit split across the four MTD
 *   quarterly updates (6 Apr–5 Jul, 6 Jul–5 Oct, 6 Oct–5 Jan, 6 Jan–5 Apr).
 */
export function calculateSelfAssessment(profit, { studentLoan = true } = {}) {
  const amount = pennies(Math.max(0, Number(profit) || 0));
  const tax = applyBands(amount, TAX_BANDS);
  const class4NI = applyBands(amount, CLASS_4_BANDS);
  const loan = studentLoan ? pennies(Math.max(0, amount - STUDENT_LOAN_PLAN_2.threshold) * STUDENT_LOAN_PLAN_2.rate) : 0;
  const totalTax = pennies(tax.total + class4NI.total + loan);
  const perQuarter = pennies(amount / 4);
  const periods = ['6 Apr – 5 Jul 2024', '6 Jul – 5 Oct 2024', '6 Oct 2024 – 5 Jan 2025', '6 Jan – 5 Apr 2025'];
  return {
    profit: amount,
    tax,
    class4NI,
    class2NI: 0,
    studentLoan: { applies: studentLoan, plan: 'Plan 2', threshold: STUDENT_LOAN_PLAN_2.threshold, rate: STUDENT_LOAN_PLAN_2.rate, amount: loan },
    totalTax,
    net: pennies(amount - totalTax),
    dueDate: '31 January 2026',
    // The last quarter takes any rounding remainder so the four add up to the profit exactly.
    quarters: periods.map((period, i) => ({ period, income: i < 3 ? perQuarter : pennies(amount - perQuarter * 3) })),
  };
}
