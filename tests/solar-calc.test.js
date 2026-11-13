/* Exhaustive tests for assets/js/solar-calc.js. Run: node tests/solar-calc.test.js */
'use strict';
const assert = require('assert');
const C = require('../assets/js/solar-calc.js');
const cfg = C.CONFIG;

let checks = 0, combos = 0;
const failures = [];
function check(cond, msg, ctx) { checks++; if (!cond) failures.push(msg + ' :: ' + JSON.stringify(ctx)); }
const approx = (a, b, tol) => Math.abs(a - b) <= tol;

// ───────── 1. Hand-checked reference values (from the official tariff schedules) ─────────
const ref = [
  // TG domestic (FY 2026-27): energy + customer charge
  ['TG', 'home', 0,   40], // customer charge still due at zero net units
  ['TG', 'home', 50,  50 * 1.95 + 40],
  ['TG', 'home', 100, 50 * 1.95 + 50 * 3.10 + 70],
  ['TG', 'home', 150, 100 * 3.40 + 50 * 4.80 + 90],
  ['TG', 'home', 200, 100 * 3.40 + 100 * 4.80 + 90],
  ['TG', 'home', 250, 200 * 5.10 + 50 * 7.70 + 100],
  ['TG', 'home', 350, 200 * 5.10 + 100 * 7.70 + 50 * 9.00 + 120],
  ['TG', 'home', 500, 200 * 5.10 + 100 * 7.70 + 100 * 9.00 + 100 * 9.50 + 140],
  ['TG', 'home', 900, 200 * 5.10 + 100 * 7.70 + 100 * 9.00 + 400 * 9.50 + 100 * 10.00 + 160],
  ['TG', 'commercial', 40, 40 * 7.00],
  ['TG', 'commercial', 400, 100 * 8.50 + 200 * 9.90 + 100 * 10.40],
  ['TG', 'commercial', 800, 100 * 8.50 + 200 * 9.90 + 200 * 10.40 + 300 * 11.00],
  ['TG', 'industrial', 1000, 7700],
  ['AP', 'home', 30, 57],
  ['AP', 'home', 300, 30 * 1.90 + 45 * 3.00 + 50 * 4.50 + 100 * 6.00 + 75 * 8.75],
  ['AP', 'home', 500, 30 * 1.90 + 45 * 3.00 + 50 * 4.50 + 100 * 6.00 + 175 * 8.75 + 100 * 9.75],
  ['AP', 'commercial', 600, 50 * 5.40 + 50 * 7.65 + 200 * 9.05 + 200 * 9.60 + 100 * 10.15],
  ['AP', 'industrial', 1000, 7800],
];
for (const [s, t, u, exp] of ref) check(approx(C.monthlyBill(s, t, u, false), exp, 0.01), `tariff ${s}/${t}/${u}u expected ${exp}`, { got: C.monthlyBill(s, t, u, false) });

// Subsidy table (PM Surya Ghar)
const subs = [[1, 30000], [1.5, 45000], [2, 60000], [2.5, 69000], [3, 78000], [4, 78000], [10, 78000]];
for (const [kw, exp] of subs) check(C.subsidyFor('home', kw, 0, true) === exp, `home subsidy ${kw} kW = ${exp}`, { got: C.subsidyFor('home', kw, 0, true) });
check(C.subsidyFor('society', 10, 0, true) === 180000, 'society 10 kW = 1.8L', {});
check(C.subsidyFor('society', 600, 0, true) === 500 * 18000, 'society capped at 500 kW', {});
check(C.subsidyFor('society', 30, 4, true) === 12 * 18000, 'society capped at 3 kW/house', {});
check(C.subsidyFor('commercial', 50, 0, true) === 0 && C.subsidyFor('industrial', 50, 0, true) === 0, 'no subsidy for C&I', {});
check(C.subsidyFor('home', 3, 0, false) === 0, 'subsidy off when not eligible', {});

// Gruha Jyothi
check(C.monthlyBill('TG', 'home', 200, true) === 0, 'Gruha Jyothi: 200u free', {});
check(C.monthlyBill('TG', 'home', 201, true) > 0, 'Gruha Jyothi: 201u billed in full', {});
check(C.monthlyBill('AP', 'home', 150, true) > 0, 'Gruha Jyothi ignored in AP', {});

// ───────── 2. Tariff properties for every state/type over 0..20000 units ─────────
for (const s of ['TG', 'AP']) for (const t of ['home', 'society', 'commercial', 'industrial']) {
  let prev = -1;
  for (let u = 0; u <= 20000; u += (u < 1000 ? 1 : 25)) {
    const b = C.monthlyBill(s, t, u, false);
    check(isFinite(b) && b >= 0, 'bill finite & >= 0', { s, t, u, b });
    check(b >= prev - 1e-9, 'bill never decreases as units rise', { s, t, u, b, prev });
    prev = b;
  }
  // bill → units round trip
  for (let u = 1; u <= 5000; u += 7) {
    const b = C.monthlyBill(s, t, u, false);
    const back = C.unitsFromBill(s, t, b);
    check(approx(C.monthlyBill(s, t, back, false), b, 15), 'units-from-bill round trip within ₹15', { s, t, u, b, back });
  }
}

// ───────── 3. Full combination grid on calculate() ─────────
const states = ['TG', 'AP'];
const types = ['home', 'society', 'commercial', 'industrial'];
const billVals = [1, 50, 100, 200, 300, 450, 600, 800, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000];
const unitVals = [1, 10, 30, 50, 60, 90, 100, 101, 150, 199, 200, 201, 250, 300, 301, 400, 401, 500, 800, 801, 1000, 2000, 5000, 10000, 50000, 120000, 200000];
const roofs = [undefined, 0, 99, 100, 150, 300, 1000, 5000, 200000];
const loads = [undefined, 0, 1, 2, 3, 5, 10, 50, 100, 2000];
const housesOpts = [undefined, 4, 50, 400];
const bools = [true, false];

for (const state of states) for (const type of types) for (const mode of ['bill', 'units'])
for (const value of (mode === 'bill' ? billVals : unitVals)) for (const roofSqft of roofs) for (const sanctionedLoadKw of loads)
for (const subsidy of bools) for (const gruhaJyothi of bools) for (const houses of (type === 'society' ? housesOpts : [undefined])) {
  const inp = { state, type, mode, value, roofSqft, sanctionedLoadKw, subsidy, gruhaJyothi, houses };
  const r = C.calculate(inp); combos++;
  if (!r.ok) {
    check(typeof r.error === 'string' && r.error.length > 0, 'error result has a message', inp);
    const expectRoofErr = roofSqft > 0 && roofSqft < 100;
    const loadFactor = (type === 'commercial' || type === 'industrial') ? 0.8 : 1;
    const expectLoadErr = sanctionedLoadKw > 0 && Math.floor(sanctionedLoadKw * loadFactor) < 1;
    check(expectRoofErr || expectLoadErr, 'error only for roof < 100 sq ft or load too low', { inp, err: r.error });
    continue;
  }
  const nums = ['monthlyUnits', 'billBefore', 'billAfter', 'monthlySaving', 'yearlySaving', 'systemKw', 'grossCost', 'subsidy', 'netCost', 'monthlyGeneration', 'coveragePct', 'lifetimeSavings', 'co2TonnesLifetime', 'roofSqft', 'pricePerKw'];
  for (const k of nums) check(Number.isFinite(r[k]) && r[k] >= 0, `${k} finite & >= 0`, { inp, v: r[k] });
  check(Number.isInteger(r.systemKw) && r.systemKw >= cfg.minKw && r.systemKw <= cfg.maxKw, 'kW is a whole number within 1..1000', { inp, kw: r.systemKw });
  if (roofSqft > 0) check(r.systemKw * cfg.sqftPerKw <= roofSqft, 'fits on the roof', { inp, kw: r.systemKw });
  if (sanctionedLoadKw > 0) {
    const f = (type === 'commercial' || type === 'industrial') ? 0.8 : 1;
    check(r.systemKw <= sanctionedLoadKw * f + 1e-9, 'within sanctioned-load limit', { inp, kw: r.systemKw });
  }
  check(r.billAfter <= r.billBefore, 'bill after solar <= bill before', { inp, r: [r.billBefore, r.billAfter] });
  check(approx(r.monthlySaving, r.billBefore - r.billAfter, 1), 'saving = before - after', { inp });
  check(approx(r.yearlySaving, r.monthlySaving * 12, 12), 'yearly = 12 x monthly', { inp });
  check(approx(r.grossCost, r.systemKw * r.pricePerKw, 1), 'gross = kW x price', { inp });
  check(approx(r.netCost, Math.max(0, r.grossCost - r.subsidy), 1), 'net = gross - subsidy', { inp });
  check(r.subsidy <= r.grossCost, 'subsidy never exceeds cost', { inp });
  if (type === 'home') check(r.subsidy <= 78000, 'home subsidy <= 78,000', { inp, s: r.subsidy });
  if (type === 'commercial' || type === 'industrial') check(r.subsidy === 0, 'no subsidy for business', { inp });
  if (!subsidy) check(r.subsidy === 0, 'subsidy off when unticked', { inp });
  if (type === 'society' && houses) check(r.subsidy <= houses * 3 * 18000, 'society subsidy <= 3 kW/house', { inp });
  check(r.coveragePct <= 100, 'coverage <= 100%', { inp });
  check(r.table.length === cfg.years, '25-year table', { inp });
  for (let i = 1; i < r.table.length; i++) {
    check(r.table[i].generationUnits <= r.table[i - 1].generationUnits, 'generation degrades each year', { inp, i });
    check(r.table[i].cumulative >= r.table[i - 1].cumulative, 'cumulative savings never fall', { inp, i });
  }
  if (r.paybackYears !== null) {
    check(r.paybackYears >= 0 && r.paybackYears <= cfg.years, 'payback within 0..25 years', { inp, p: r.paybackYears });
    if (r.netCost > 0) {
      const y = Math.min(cfg.years, Math.ceil(r.paybackYears + 0.05) || 1); // payback is rounded to 0.1 yr
      check(r.table[y - 1].cumulative + 2 >= r.netCost, 'cumulative >= net cost by payback year', { inp, p: r.paybackYears });
    }
  } else {
    check(r.lifetimeSavings < r.netCost, 'no payback only when 25-yr savings < cost', { inp });
  }
  if (gruhaJyothi && state === 'TG' && type === 'home' && r.monthlyUnits <= 200) check(r.billBefore === 0 && r.monthlySaving === 0, 'Gruha Jyothi homes under 200 units save nothing', { inp });
  if (gruhaJyothi && state === 'TG' && type === 'home' && r.monthlyUnits > 200 && !r.limitedBy) {
    const needed = r.monthlyUnits - 200;
    check(r.systemKw * cfg.unitsPerKwMonth >= needed || r.systemKw === Math.max(1, Math.round(r.monthlyUnits / cfg.unitsPerKwMonth)), 'Gruha Jyothi: system brings net use to ≤200 units', { inp, kw: r.systemKw });
    check(r.systemKw === 1 || (r.systemKw - 1) * cfg.unitsPerKwMonth < needed, 'Gruha Jyothi: no bigger than needed', { inp, kw: r.systemKw });
    if (r.systemKw * cfg.unitsPerKwMonth >= needed) check(r.billAfter === 0, 'Gruha Jyothi: bill after solar is zero', { inp, after: r.billAfter });
  }
  if (r.limitedBy) check(!r.notes.some(n => /bill becomes free/.test(n)), 'no "bill becomes free" note when size is limited', { inp, notes: r.notes });
  if (r.notes.some(n => /bill becomes free/.test(n))) check(r.billAfter === 0, '"bill becomes free" note only when bill after is zero', { inp, after: r.billAfter });
  check(Array.isArray(r.notes), 'notes list', { inp });
}

// ───────── 4. Monotonicity: more usage never gives a smaller recommended system or saving ─────────
for (const state of states) for (const type of types) {
  let pk = 0, ps = -1, pAfter = 0;
  // Telangana tariff categories switch at 50 / 100 / 200 net units a month (LT-I(A)/(B), LT-II(A)/(B)),
  // so savings may dip slightly when the leftover grid units cross one of these lines. That is the real tariff.
  const tgBoundaries = [50, 100, 200];
  for (let u = 1; u <= 30000; u += (u < 2000 ? 5 : 250)) {
    const r = C.calculate({ state, type, mode: 'units', value: u });
    const after = Math.max(0, r.monthlyUnits - r.monthlyGeneration);
    check(r.systemKw >= pk, 'kW non-decreasing with usage', { state, type, u, kw: r.systemKw, pk });
    const crossed = state === 'TG' && tgBoundaries.some(b => pAfter <= b && after > b);
    if (crossed) check(r.monthlySaving >= ps - 100, 'dip at a TG tariff boundary stays under ₹100', { state, type, u, s: r.monthlySaving, ps });
    else check(r.monthlySaving >= ps - 1, 'saving non-decreasing with usage', { state, type, u, s: r.monthlySaving, ps });
    pk = r.systemKw; ps = r.monthlySaving; pAfter = after;
  }
}

// ───────── 5. Bad / odd input handling ─────────
for (const v of [undefined, null, '', 'abc', NaN, -100, 0, Infinity, '1,500', '₹ 2,000', ' 300 ', 1e9]) {
  const r = C.calculate({ state: 'TG', type: 'home', mode: 'bill', value: v });
  combos++;
  const n = typeof v === 'string' ? Number(v.replace(/[,₹\s]/g, '')) : Number(v);
  if (isFinite(n) && n > 0 && n <= 1e8) check(r.ok, 'valid numeric strings accepted', { v });
  else check(!r.ok && r.error, 'invalid input → friendly error, no crash', { v });
}
check(C.calculate({ state: 'XX', type: 'zzz', mode: 'q', value: 1000 }).ok, 'unknown state/type/mode fall back to defaults', {});
check(C.calculate().ok === false, 'no input → error', {});

// ───────── Report ─────────
console.log(`Combinations run: ${combos.toLocaleString()} | checks: ${checks.toLocaleString()} | failures: ${failures.length}`);
if (failures.length) {
  const uniq = {};
  failures.forEach(f => { const k = f.split(' :: ')[0]; (uniq[k] = uniq[k] || []).push(f); });
  for (const k in uniq) console.log(`\n✗ ${k} (${uniq[k].length})\n   e.g. ${uniq[k][0].slice(0, 400)}`);
  process.exit(1);
}
console.log('All checks passed ✓');
