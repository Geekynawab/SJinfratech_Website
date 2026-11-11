# Swapna Jyothi Solar: website

Static website for **Swapna Jyothi Infratech Pvt. Ltd.** (rooftop solar, Telangana).
Live domain: **swapnajyothiinfratech.com**

Plain HTML, CSS and JavaScript. No build step and no server code, so any static host works: GitHub Pages, GoDaddy cPanel hosting, Netlify and others.

```
index.html              the page
assets/css/style.css    styles
assets/js/main.js       subsidy calculator + WhatsApp links
assets/img/             hero image, logo, favicons
assets/fonts/           Tempting (capital S) + Great Vibes (wordmark)
CNAME                   custom domain for GitHub Pages
```

## Set the WhatsApp number (do this first)
Open `assets/js/main.js` and change this line:

```js
var WHATSAPP_NUMBER = '91XXXXXXXXXX';
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
