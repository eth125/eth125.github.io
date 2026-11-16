// Inline SVG illustrations for the simulated screens. Colours are fixed: each app has one look.

const dots = (points, r) => points.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');

export const FACE = `<svg class="face-art" viewBox="0 0 130 170" aria-hidden="true">
  <ellipse cx="65" cy="70" rx="38" ry="48" fill="#2a3a33"/>
  <path d="M10 170 q55 -70 110 0z" fill="#2a3a33"/>
  <circle cx="51" cy="62" r="4" fill="#0d1512"/>
  <circle cx="79" cy="62" r="4" fill="#0d1512"/>
  <path d="M52 90 q13 9 26 0" stroke="#0d1512" stroke-width="3" fill="none"/>
</svg>`;

// A staff badge held against the top of the phone, with NFC waves between them.
export const NFC = `<svg class="nfc-art" viewBox="0 0 130 170" aria-hidden="true">
  <rect x="25" y="14" width="80" height="52" rx="6" fill="#e9f1ea"/>
  <circle cx="46" cy="36" r="10" fill="#9db3a2"/>
  <rect x="63" y="28" width="32" height="5" rx="2.5" fill="#9db3a2"/>
  <rect x="63" y="39" width="22" height="5" rx="2.5" fill="#9db3a2"/>
  <g fill="none" stroke="#6fe39a" stroke-width="4" stroke-linecap="round">
    <path class="w1" d="M50 92 q15 -12 30 0"/>
    <path class="w2" d="M41 106 q24 -20 48 0"/>
    <path class="w3" d="M32 120 q33 -28 66 0"/>
  </g>
  <rect x="20" y="138" width="90" height="32" rx="8" fill="#2a3a33"/>
</svg>`;

// An employee ID card with a 1D barcode held under the scanner laser.
export const BARCODE_BADGE = `<svg class="barcode-art" viewBox="0 0 130 170" aria-hidden="true">
  <rect x="15" y="34" width="100" height="102" rx="8" fill="#e9f1ea"/>
  <circle cx="40" cy="60" r="11" fill="#9db3a2"/>
  <rect x="58" y="51" width="44" height="6" rx="3" fill="#2a3a33"/>
  <rect x="58" y="63" width="30" height="5" rx="2.5" fill="#708776"/>
  <rect x="25" y="88" width="80" height="34" rx="3" fill="#fff"/>
  <path d="M31 93v24M35 93v24M41 93v24M45 93v24M48 93v24M54 93v24M59 93v24M63 93v24M69 93v24M73 93v24M79 93v24M84 93v24M88 93v24M94 93v24M98 93v24" stroke="#15191d" stroke-width="2"/>
</svg>`;

const RIPE = [[120, 36], [136, 28], [152, 36], [168, 32], [128, 50], [144, 44], [160, 50], [176, 46], [136, 62], [152, 60], [168, 62]];
const SHADE = [[144, 32], [160, 40], [136, 54], [168, 54], [152, 50]];

export const BUNCH = `<svg viewBox="0 0 300 84" aria-hidden="true">
  <g fill="#c2541b">${dots(RIPE, 9)}</g>
  <g fill="#7a2c12">${dots(SHADE, 6)}</g>
  <path d="M150 22 v-12 M150 10 q-30 -6 -52 10 M150 10 q30 -6 52 10" stroke="#1c7541" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`;

// The same bunch, cropped close: used as a photo thumbnail.
export const BUNCH_PHOTO = BUNCH.replace('viewBox="0 0 300 84"', 'viewBox="96 0 108 84"');

export const TRUCK = `<svg viewBox="0 0 300 84" aria-hidden="true">
  <rect x="0" y="72" width="300" height="4" fill="#b7c7ba"/>
  <g class="truck" data-truck>
    <rect x="40" y="30" width="78" height="32" rx="3" fill="#c2541b"/>
    <rect x="118" y="38" width="30" height="24" rx="3" fill="#1c7541"/>
    <rect x="128" y="42" width="14" height="9" fill="#dcefe2"/>
    <circle cx="62" cy="66" r="8" fill="#16241a"/>
    <circle cx="98" cy="66" r="8" fill="#16241a"/>
    <circle cx="134" cy="66" r="8" fill="#16241a"/>
  </g>
</svg>`;
