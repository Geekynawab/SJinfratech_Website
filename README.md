# Swapna Jyothi Solar: website

Static website for **Swapna Jyothi Infratech Pvt. Ltd.** (rooftop solar, Telangana).
Live domain: **swapnajyothiinfratech.com**

Plain HTML, CSS and JavaScript. No build step and no server code, so any static host works: GitHub Pages, GoDaddy cPanel hosting, Netlify and others.

```
index.html              the page
assets/css/style.css    styles
assets/js/main.js       subsidy calculator + WhatsApp links
assets/js/solar-calc.js savings calculator engine (tariffs, subsidy, sizing, payback)
assets/js/calculator-ui.js  savings calculator form
tests/                  calculator test suite (node tests/solar-calc.test.js)
assets/img/             hero image, logo, favicons
assets/fonts/           Tempting (capital S) + Great Vibes (wordmark)
CNAME                   custom domain for GitHub Pages
```

## Set the WhatsApp number (do this first)
Open `assets/js/main.js` and change this line:

```js
var WHATSAPP_NUMBER = '918019814311';
```

Write the number with the country code and digits only, for example `919876543210`. Every WhatsApp button on the site uses this one number.

## Edit contact details
In `index.html`, search for the text in `[square brackets]` (address, phone, email, hours, kW installed, installation days) and replace it.

## Preview locally
Open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit http://localhost:8000.

## Fonts
- **Great Vibes**: SIL Open Font License. Free for commercial use.
- **Tempting**: the file included is the *personal use* version. **Buy a commercial/web licence before launch.**

Inter and Inter Tight load from Google Fonts.

## Savings calculator
All the assumptions are in `CONFIG` at the top of `assets/js/solar-calc.js`:
- **priceBands**: installed price per kW by system size. **Set these to your own prices.**
- unitsPerKwMonth (120), sqftPerKw (100), degradation (0.5%/yr), tariff rise (2%/yr), 25-year life.

The tariffs are the TGERC FY 2026-27 schedule (TGSPDCL/TGNPDCL) and the APERC FY 2026-27 schedule (no change from FY 2025-26). The subsidy follows PM Surya Ghar. Housing-society common areas use the domestic tariff (an assumption).

After changing anything, run `node tests/solar-calc.test.js` to recheck every input combination.
