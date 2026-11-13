/*!
 * Swapna Jyothi Solar: rooftop solar savings engine.
 * Pure functions, no DOM. Works in the browser (window.SolarCalc) and in Node (module.exports).
 *
 * Tariffs: TGERC Retail Supply Tariff Schedule FY 2026-27 (TGSPDCL / TGNPDCL, effective 01.04.2026)
 *          APERC Retail Supply Tariff FY 2026-27 (no increase over FY 2025-26).
 * Subsidy: PM Surya Ghar Muft Bijli Yojana (MNRE): homes ₹30,000/kW for first 2 kW + ₹18,000 for 3rd kW (cap ₹78,000);
 *          GHS/RWA common facilities ₹18,000/kW up to 500 kW (@3 kW per house).
 * Net metering (Telangana): system 1 kW to 1 MW; residential up to 100% of sanctioned load, C&I up to 80%.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SolarCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────────── Assumptions (edit here) ─────────────────────────────
  var CONFIG = {
    // Average generation per kW per month. Cross-checked against Vikram Solar's state PLF (Nov 2026):
    // Telangana ≈1,390 kWh/kW/yr (116/month), Andhra Pradesh ≈1,270 kWh/kW/yr (106/month).
    unitsPerKwMonth: { TG: 116, AP: 106 },
    sqftPerKw: 100,              // shadow-free roof area needed per kW
    minKw: 1,                    // smallest system (net-metering minimum 1 kWp)
    maxKw: 1000,                 // net-metering ceiling 1 MWp
    degradationPerYear: 0.005,   // panel output loss per year (0.5%)
    tariffEscalation: 0.02,      // assumed yearly rise in electricity tariff (2%)
    years: 25,                   // system life used for lifetime savings
    co2KgPerKwh: 0.727,          // CEA CO2 Baseline Database v20, weighted average incl. RE (tCO2/MWh)
    // Installed price per kW (₹, before subsidy) by system size. EDIT TO SWAPNA JYOTHI'S OWN PRICES.
    priceBands: [
      { upToKw: 2,        perKw: 70000 },
      { upToKw: 3,        perKw: 65000 },
      { upToKw: 5,        perKw: 60000 },
      { upToKw: 10,       perKw: 55000 },
      { upToKw: 100,      perKw: 50000 },
      { upToKw: Infinity, perKw: 42000 }
    ],
    subsidy: {
      homeFirst2PerKw: 30000, homeThirdKw: 18000, homeCap: 78000,
      societyPerKw: 18000, societyMaxKw: 500, societyKwPerHouse: 3
    },
    gruhaJyothiLimit: 200        // Telangana free-power scheme: ≤200 units/month → zero bill (eligible homes)
  };

  // ───────────────────────────── Tariffs (₹/unit, telescopic) ─────────────────────────────
  // Each tariff: function(units) → monthly energy + customer/fixed charges in ₹.
  function telescopic(units, slabs) {
    // slabs: [[upperLimit, rate], ...] last upperLimit = Infinity
    var cost = 0, prev = 0;
    for (var i = 0; i < slabs.length && units > prev; i++) {
      var top = Math.min(units, slabs[i][0]);
      cost += (top - prev) * slabs[i][1];
      prev = slabs[i][0];
    }
    return cost;
  }
  // TG LT-I domestic customer charges (₹/month) by consumption band (unchanged FY 2025-26 → 2026-27)
  function tgDomesticCustomerCharge(u) {
    // also payable at zero net consumption
    if (u <= 50) return 40; if (u <= 100) return 70; if (u <= 200) return 90; if (u <= 300) return 100;
    if (u <= 400) return 120; if (u <= 800) return 140; return 160;
  }
  var TARIFFS = {
    TG: {
      home: function (u) {
        if (u <= 0) return tgDomesticCustomerCharge(0);
        var energy;
        if (u <= 100) energy = telescopic(u, [[50, 1.95], [Infinity, 3.10]]);                       // LT-I(A)
        else if (u <= 200) energy = telescopic(u, [[100, 3.40], [Infinity, 4.80]]);                 // LT-I(B)(i)
        else energy = telescopic(u, [[200, 5.10], [300, 7.70], [400, 9.00], [800, 9.50], [Infinity, 10.00]]); // LT-I(B)(ii)
        return energy + tgDomesticCustomerCharge(u);
      },
      commercial: function (u) {
        if (u <= 0) return 0;
        if (u <= 50) return u * 7.00;                                                                 // LT-II(A)
        return telescopic(u, [[100, 8.50], [300, 9.90], [500, 10.40], [Infinity, 11.00]]);            // LT-II(B)
      },
      industrial: function (u) { return u > 0 ? u * 7.70 : 0; }                                      // LT-III
    },
    AP: {
      home: function (u) {
        return u > 0 ? telescopic(u, [[30, 1.90], [75, 3.00], [125, 4.50], [225, 6.00], [400, 8.75], [Infinity, 9.75]]) : 0;
      },
      commercial: function (u) {
        return u > 0 ? telescopic(u, [[50, 5.40], [100, 7.65], [300, 9.05], [500, 9.60], [Infinity, 10.15]]) : 0;
      },
      industrial: function (u) { return u > 0 ? u * 7.80 : 0; }
    }
  };
  // Housing-society common areas are billed on the domestic schedule here (assumption, see README).
  function tariffFn(state, type) {
    var t = TARIFFS[state] || TARIFFS.TG;
    if (type === 'industrial') return t.industrial;
    if (type === 'commercial') return t.commercial;
    return t.home; // home + society
  }

  function monthlyBill(state, type, units, gruhaJyothi) {
    units = Math.max(0, units);
    if (gruhaJyothi && state === 'TG' && type === 'home' && units <= CONFIG.gruhaJyothiLimit) return 0;
    return tariffFn(state, type)(units);
  }

  // Bill (₹) → units, by bisection on the (monotonic) tariff function.
  function unitsFromBill(state, type, bill) {
    var f = tariffFn(state, type);
    if (!(bill > 0)) return 0;
    var lo = 0, hi = 1;
    while (f(hi) < bill && hi < 1e8) hi *= 2;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) < bill) lo = mid; else hi = mid;
    }
    return Math.round(hi);
  }

  function pricePerKw(kw) {
    var b = CONFIG.priceBands;
    for (var i = 0; i < b.length; i++) if (kw <= b[i].upToKw) return b[i].perKw;
    return b[b.length - 1].perKw;
  }

  function subsidyFor(type, kw, houses, eligible) {
    var s = CONFIG.subsidy;
    if (!eligible || kw <= 0) return 0;
    if (type === 'home') {
      return Math.min(s.homeCap, Math.min(kw, 2) * s.homeFirst2PerKw + Math.max(0, Math.min(kw, 3) - 2) * s.homeThirdKw);
    }
    if (type === 'society') {
      var capKw = s.societyMaxKw;
      if (houses > 0) capKw = Math.min(capKw, houses * s.societyKwPerHouse);
      return Math.min(kw, capKw) * s.societyPerKw;
    }
    return 0; // commercial / industrial: no PM Surya Ghar subsidy
  }

  function num(v) {
    if (typeof v === 'string') v = v.replace(/[,₹\s]/g, '');
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  /**
   * calculate(input) → result
   * input: {
   *   state: 'TG'|'AP', type: 'home'|'society'|'commercial'|'industrial',
   *   mode: 'bill'|'units', value: number (₹ per month or units per month),
   *   roofSqft?: number, sanctionedLoadKw?: number, houses?: number,
   *   subsidy?: boolean (default true for home/society), gruhaJyothi?: boolean (TG homes only)
   * }
   */
  function calculate(input) {
    input = input || {};
    var state = input.state === 'AP' ? 'AP' : 'TG';
    var type = ['home', 'society', 'commercial', 'industrial'].indexOf(input.type) >= 0 ? input.type : 'home';
    var mode = input.mode === 'units' ? 'units' : 'bill';
    var value = num(input.value);
    var roof = num(input.roofSqft), load = num(input.sanctionedLoadKw), houses = num(input.houses);
    var gruha = !!input.gruhaJyothi && state === 'TG' && type === 'home';
    var eligible = input.subsidy === undefined ? true : !!input.subsidy;
    var notes = [];

    if (!(value > 0)) return { ok: false, error: mode === 'bill' ? 'Enter your average monthly electricity bill.' : 'Enter your average monthly units (kWh).' };
    if (value > 1e8) return { ok: false, error: 'That value looks too large. Please check it.' };

    var units = mode === 'units' ? Math.round(value) : unitsFromBill(state, type, value);
    if (units < 1) units = 1;
    var billBefore = monthlyBill(state, type, units, gruha);

    // ── Size
    var perKwMonth = CONFIG.unitsPerKwMonth[state];
    var needKw = units / perKwMonth;
    var kw = Math.max(CONFIG.minKw, Math.round(needKw));
    var limitedBy = null;
    // Gruha Jyothi homes: the bill is free once net use is ≤ 200 units, so size just enough to get there.
    var gruhaSized = false;
    if (gruha && units > CONFIG.gruhaJyothiLimit) {
      var gruhaKw = Math.max(CONFIG.minKw, Math.ceil((units - CONFIG.gruhaJyothiLimit) / perKwMonth));
      if (gruhaKw < kw) { kw = gruhaKw; gruhaSized = true; }
    }
    if (roof > 0) {
      var roofKw = Math.floor(roof / CONFIG.sqftPerKw);
      if (roofKw < CONFIG.minKw) return { ok: false, error: 'At least ' + CONFIG.sqftPerKw + ' sq ft of shadow-free roof is needed for a 1 kW system.' };
      if (kw > roofKw) { kw = roofKw; limitedBy = 'roof'; }
    }
    if (load > 0) {
      var loadKw = Math.floor(load * (type === 'commercial' || type === 'industrial' ? 0.8 : 1));
      if (loadKw < CONFIG.minKw) return { ok: false, error: 'Your sanctioned load is too low for net metering. A load enhancement would be needed first.' };
      if (kw > loadKw) { kw = loadKw; limitedBy = 'load'; }
    }
    if (kw > CONFIG.maxKw) { kw = CONFIG.maxKw; limitedBy = 'cap'; }

    // ── Money
    var perKw = pricePerKw(kw);
    var gross = kw * perKw;
    var subsidy = subsidyFor(type, kw, houses, eligible && (type === 'home' || type === 'society'));
    var netCost = Math.max(0, gross - subsidy);

    var genMonth = kw * perKwMonth;
    var gridAfter = Math.max(0, units - genMonth);
    var billAfter = monthlyBill(state, type, gridAfter, gruha);
    var monthlySaving = Math.max(0, billBefore - billAfter);
    var coverage = Math.min(1, genMonth / units);

    // ── 25-year projection (degradation + tariff escalation)
    var table = [], cumulative = 0, paybackYears = null, lifetime = 0;
    for (var y = 1; y <= CONFIG.years; y++) {
      var gen = genMonth * Math.pow(1 - CONFIG.degradationPerYear, y - 1);
      var esc = Math.pow(1 + CONFIG.tariffEscalation, y - 1);
      var save = (billBefore - monthlyBill(state, type, Math.max(0, units - gen), gruha)) * 12 * esc;
      save = Math.max(0, save);
      var prevCum = cumulative;
      cumulative += save;
      lifetime += save;
      if (paybackYears === null && netCost > 0 && cumulative >= netCost && save > 0) {
        paybackYears = (y - 1) + (netCost - prevCum) / save;
      }
      table.push({ year: y, generationUnits: Math.round(gen * 12), saving: Math.round(save), cumulative: Math.round(cumulative) });
    }
    if (netCost === 0) paybackYears = 0;

    // ── Notes
    if (limitedBy === 'roof') notes.push('System size limited by your roof area (' + Math.round(roof) + ' sq ft).');
    if (limitedBy === 'load') notes.push('System size limited by your sanctioned load (net-metering rules).');
    if (limitedBy === 'cap') notes.push('Net metering allows up to 1 MW. Larger plants need a separate arrangement.');
    if (needKw < 0.75 && !limitedBy) notes.push('Your usage is low: even the smallest 1 kW system will produce more than you use.');
    if (genMonth > units * 1.15) notes.push('Extra units are exported to the grid. Savings here count only your own use, so real savings may be a little higher.');
    if (gruhaSized && !limitedBy) notes.push('Sized to bring your usage under 200 units, so your bill becomes free under Gruha Jyothi.');
    if (gruha && units <= CONFIG.gruhaJyothiLimit) notes.push('Your bill is already free under Gruha Jyothi, so solar will not reduce it further.');
    if (type === 'society' && !(houses > 0)) notes.push('Society subsidy is ₹18,000/kW, limited to 3 kW per house. Enter the number of houses for an exact figure.');
    if (type === 'commercial' || type === 'industrial') notes.push('Businesses can also claim accelerated depreciation on solar. Ask your CA for the tax benefit.');

    return {
      ok: true,
      state: state, type: type,
      monthlyUnits: units,
      billBefore: Math.round(billBefore),
      billAfter: Math.round(billAfter),
      monthlySaving: Math.round(monthlySaving),
      yearlySaving: Math.round(monthlySaving * 12),
      systemKw: kw,
      neededKw: Math.round(needKw * 10) / 10,
      limitedBy: limitedBy,
      roofSqft: kw * CONFIG.sqftPerKw,
      pricePerKw: perKw,
      grossCost: Math.round(gross),
      subsidy: Math.round(subsidy),
      netCost: Math.round(netCost),
      monthlyGeneration: Math.round(genMonth),
      coveragePct: Math.round(coverage * 100),
      paybackYears: paybackYears === null ? null : Math.round(paybackYears * 10) / 10,
      lifetimeSavings: Math.round(lifetime),
      co2TonnesLifetime: Math.round(table.reduce(function (a, r) { return a + r.generationUnits; }, 0) * CONFIG.co2KgPerKwh / 1000),
      table: table,
      notes: notes
    };
  }

  return { CONFIG: CONFIG, calculate: calculate, monthlyBill: monthlyBill, unitsFromBill: unitsFromBill, subsidyFor: subsidyFor, pricePerKw: pricePerKw, _tariffs: TARIFFS };
});
