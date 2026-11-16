# eth125.github.io

Portfolio of Ethan Sia, Android software engineer. Live at <https://eth125.github.io/>.

The main page showcases 5 interactive app emulators (`OPSMobile_Store`, `OPSMobileNetPay`, `OPSMobile_Main`, `OPSMobile_Payroll`, and `OPSWebAPI`). Selecting an emulator scrolls to a focused demo stage with step-by-step instructions and transient CV engineering highlights. The demos are concept rebuilds with sample data and contain no company code, screens, or data.

## Run it

Needs Node 20.19 or newer.

```bash
npm install
npm run dev       # dev server with hot reload, http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## How it is put together

A static site built with [Vite](https://vite.dev/) and plain JavaScript, with no framework.

| Path | What is there |
| --- | --- |
| `index.html` | Page layout: 5-phone emulator showcase, focused demo stage, skills, how I work, and contact |
| `src/main.js` | Entry point: initializes theme, nav, contact, and simulators |
| `src/theme.js`, `nav.js`, `contact.js` | Theme toggle, header menu and scroll-spy, copy-email button |
| `src/sim/index.js` | Connects the 5 phone emulators on the main page to the focused demo stage |
| `src/sim/core.js` | Demo engine: renders the simulated device, step-by-step user guide, transient CV highlights, and completion prompt |
| `src/sim/apps/*.js` | One file per demo (Store, NetPay, Gate, Payroll, Web API): state, screens, step guide, actions, and CV insights |
| `src/sim/ui.js`, `art.js` | Shared HTML helpers and SVG illustrations for the demos |
| `src/styles/` | CSS split by area; `tokens.css` holds the light and dark theme tokens |
| `public/` | Static assets: favicon, touch icon, OpenGraph image |

## Deployment

`.github/workflows/deploy.yml` builds the site and publishes `dist/` to GitHub Pages on every push to `main`.
