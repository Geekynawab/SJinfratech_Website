/* Savings calculator UI: wires the #savings form to SolarCalc (assets/js/solar-calc.js). */
(function () {
  'use strict';
  var form = document.getElementById('calc-form');
  if (!form || !window.SolarCalc) return;

  var $ = function (id) { return document.getElementById(id); };
  var valueInput = $('calc-value'), slider = $('calc-slider'), modeBtn = $('calc-mode'), label = $('calc-value-label');
  var errorEl = $('calc-error'), notesEl = $('calc-notes'), tbody = $('calc-tbody');
  var gruhaRow = $('gruha-row'), housesRow = $('houses-row'), out = document.querySelector('.calc-out');
  var mode = 'bill';
  var inr = function (n) { return Math.round(n).toLocaleString('en-IN'); };

  var RANGE = { bill: { min: 300, max: 20000, step: 100, def: 2500 }, units: { min: 50, max: 2500, step: 10, def: 350 } };
  var BIZ_RANGE = { bill: { min: 2000, max: 500000, step: 1000, def: 25000 }, units: { min: 200, max: 50000, step: 100, def: 2500 } };

  function rangeFor() {
    var t = form.elements.type.value;
    return (t === 'commercial' || t === 'industrial' || t === 'society') ? BIZ_RANGE[mode] : RANGE[mode];
  }
  function setSlider(resetValue) {
    var r = rangeFor();
    slider.min = r.min; slider.max = r.max; slider.step = r.step;
    if (resetValue) { valueInput.value = inr(r.def); slider.value = r.def; }
    slider.setAttribute('aria-label', mode === 'bill' ? 'Adjust monthly bill' : 'Adjust monthly units');
  }

  function read() {
    var e = form.elements;
    return {
      state: e.state.value, type: e.type.value, mode: mode, value: valueInput.value,
      roofSqft: e.roofSqft.value, sanctionedLoadKw: e.sanctionedLoadKw.value, houses: e.houses.value,
      subsidy: e.subsidy.checked, gruhaJyothi: e.gruhaJyothi.checked
    };
  }

  function set(name, text) {
    document.querySelectorAll('[data-r="' + name + '"]').forEach(function (el) { el.textContent = text; });
  }

  function waLink(r, inp) {
    var num = (window.SJ_WHATSAPP || '').replace(/[^0-9]/g, '');
    var typeName = { home: 'Home', society: 'Apartment society', commercial: 'Shop / office', industrial: 'Factory' }[r.type];
    var lines = [
      'Hi Swapna Jyothi, I used the savings calculator on your website.',
      'Location: ' + (r.state === 'AP' ? 'Andhra Pradesh' : 'Telangana') + ' | Property: ' + typeName,
      'Monthly ' + (inp.mode === 'bill' ? 'bill: Rs ' + inr(r.billBefore) : 'usage: ' + r.monthlyUnits + ' units'),
      'Suggested system: ' + r.systemKw + ' kW | Estimated cost after subsidy: Rs ' + inr(r.netCost),
      'Estimated saving: Rs ' + inr(r.monthlySaving) + '/month',
      'Please share an exact quote.'
    ];
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function render() {
    var inp = read();
    var isTG = inp.state === 'TG', t = inp.type;
    gruhaRow.hidden = !(isTG && t === 'home');
    housesRow.hidden = t !== 'society';
    form.elements.subsidy.closest('label').hidden = !(t === 'home' || t === 'society');

    var r = SolarCalc.calculate(inp);
    out.classList.toggle('is-empty', !r.ok);
    errorEl.textContent = r.ok ? '' : r.error;
    valueInput.setAttribute('aria-invalid', r.ok ? 'false' : 'true');
    if (!r.ok) {
      document.querySelectorAll('.calc-out [data-r]').forEach(function (el) { el.textContent = '–'; });
      notesEl.innerHTML = ''; tbody.innerHTML = '';
      var cta0 = document.querySelector('[data-wa="estimate"]');
      if (cta0) cta0.href = 'https://wa.me/' + (window.SJ_WHATSAPP || '') + '?text=' + encodeURIComponent('Hi Swapna Jyothi, I would like a solar quote.');
      return;
    }

    ['monthlySaving', 'yearlySaving', 'netCost', 'lifetimeSavings', 'billBefore', 'billAfter', 'grossCost', 'subsidy', 'roofSqft', 'monthlyUnits', 'monthlyGeneration', 'co2TonnesLifetime']
      .forEach(function (k) { set(k, inr(r[k])); });
    set('systemKw', r.systemKw);
    set('payback', r.paybackYears === null ? 'Over 25 years' : r.paybackYears === 0 ? 'Immediately' : '~' + r.paybackYears + ' years');

    notesEl.innerHTML = '';
    r.notes.forEach(function (n) { var li = document.createElement('li'); li.textContent = n; notesEl.appendChild(li); });

    tbody.innerHTML = '';
    r.table.forEach(function (row) {
      var tr = document.createElement('tr');
      [row.year, inr(row.generationUnits), '₹' + inr(row.saving), '₹' + inr(row.cumulative)].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    var cta = document.querySelector('[data-wa="estimate"]');
    if (cta) cta.href = waLink(r, inp);
  }

  modeBtn.addEventListener('click', function () {
    mode = mode === 'bill' ? 'units' : 'bill';
    modeBtn.setAttribute('aria-pressed', mode === 'units' ? 'true' : 'false');
    modeBtn.textContent = mode === 'bill' ? 'I know my units instead' : 'Use my bill amount instead';
    label.textContent = mode === 'bill' ? 'Average monthly electricity bill (₹)' : 'Average monthly units (kWh)';
    setSlider(true); render();
  });
  slider.addEventListener('input', function () { valueInput.value = inr(Number(slider.value)); render(); });
  valueInput.addEventListener('input', function () {
    var n = Number(valueInput.value.replace(/[^0-9.]/g, ''));
    if (n >= Number(slider.min) && n <= Number(slider.max)) slider.value = n;
    render();
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'type') setSlider(true);
    render();
  });
  form.addEventListener('input', function (e) { if (e.target !== valueInput && e.target !== slider) render(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  setSlider(false);
  render();
})();
