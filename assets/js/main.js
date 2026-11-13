/* Swapna Jyothi Solar: site behaviour (subsidy calculator + WhatsApp links) */
(function () {
  'use strict';

  // ▼▼ SET YOUR WHATSAPP NUMBER HERE: country code + number, digits only (e.g. 919876543210) ▼▼
  var WHATSAPP_NUMBER = '918019814311';
  // ▲▲ ------------------------------------------------------------------------------------ ▲▲

  var num = WHATSAPP_NUMBER.replace(/[^0-9]/g, '');
  window.SJ_WHATSAPP = num; // shared with the savings calculator
  function wa(text) {
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  }
  function inr(n) { return n.toLocaleString('en-IN'); }

  // General WhatsApp buttons
  var general = wa('Hi Swapna Jyothi, I am interested in rooftop solar. Please call me back.');
  document.querySelectorAll('[data-wa="general"]').forEach(function (a) { a.href = general; });

  // Subsidy calculator (PM Surya Ghar: ₹30,000/kW for first 2 kW, ₹18,000 for 3rd kW, cap ₹78,000)
  var kw = 3;
  function subsidyFor(k) { return Math.min(k, 2) * 30000 + (k > 2 ? Math.min(k - 2, 1) * 18000 : 0); }
  function setOut(name, value) {
    document.querySelectorAll('[data-out="' + name + '"]').forEach(function (el) { el.textContent = value; });
  }
  function renderCalc() {
    var s = subsidyFor(kw);
    setOut('subsidy', inr(s));
    setOut('units', inr(kw * 120));
    setOut('area', inr(kw * 100));
    setOut('usage', inr(kw * 100) + '–' + inr(kw * 140));
    setOut('kwLabel', kw + ' kW');
    document.querySelectorAll('.kw-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', Number(b.dataset.kw) === kw ? 'true' : 'false');
    });
    var calcLink = document.querySelector('[data-wa="calc"]');
    if (calcLink) {
      calcLink.href = wa('Hi Swapna Jyothi, I am interested in a ' + kw + ' kW rooftop solar system (estimated subsidy Rs ' + inr(s) + '). Please share a quote.');
    }
  }
  document.querySelectorAll('.kw-btn').forEach(function (b) {
    b.addEventListener('click', function () { kw = Number(b.dataset.kw); renderCalc(); });
  });
  renderCalc();

  // Survey form → WhatsApp message with the visitor's details
  var form = document.getElementById('survey-form');
  var formLink = document.querySelector('[data-wa="form"]');
  function formMessage() {
    var f = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ''; };
    var lines = ['Hi Swapna Jyothi, I would like a free solar site survey.'];
    if (f('name')) lines.push('Name: ' + f('name'));
    if (f('phone')) lines.push('Phone: ' + f('phone'));
    if (f('area')) lines.push('City / area: ' + f('area'));
    lines.push('Property: ' + (f('type') || 'Home'));
    if (f('bill')) lines.push('Monthly bill: Rs ' + f('bill'));
    if (f('message')) lines.push('Message: ' + f('message'));
    return wa(lines.join('\n'));
  }
  if (form && formLink) {
    var update = function () { formLink.href = formMessage(); };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); window.open(formMessage(), '_blank', 'noopener'); });
    update();
  }
})();
