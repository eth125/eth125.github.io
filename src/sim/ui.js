// Small HTML helpers shared by every simulated app.
// Controls carry data-a (the action) and data-v (its value); core.js does the wiring.

export const pad2 = (n) => String(n).padStart(2, '0');

export function hhmm(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export const num = (n) => n.toLocaleString('en-US');

/** Formats an amount held in sen (cents) as ringgit: 1240 -> "12.40". */
export const rm = (sen) =>
  (sen / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

export const back = (to = 'home', label = 'Home') =>
  `<button type="button" class="back" data-a="go" data-v="${to}">&lsaquo; ${label}</button>`;

export const heading = (title, sub = '') =>
  `<div><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;

export const label = (text) => `<span class="lbl">${text}</span>`;

/**
 * A row of single-choice chips. Options are strings, or [value, label] pairs.
 * `nudge` names the option to draw attention to, if any.
 */
export function chips(action, options, current, nudge) {
  const buttons = options.map((option) => {
    const [value, text] = Array.isArray(option) ? option : [option, option];
    const on = value === current;
    const classes = `chip${on ? ' on' : ''}${value === nudge ? ' nudge' : ''}`;
    return `<button type="button" class="${classes}" data-a="${action}" data-v="${value}" aria-pressed="${on}">${text}</button>`;
  });
  return `<div class="chips">${buttons.join('')}</div>`;
}

/** A labelled minus / value / plus row. */
export function stepper(text, key, value, less = 'dec', more = 'inc') {
  return `<div class="stp"><span>${text}</span><div>
    <button type="button" data-a="${less}" data-v="${key}" aria-label="Less ${text}">&minus;</button>
    <output>${value}</output>
    <button type="button" data-a="${more}" data-v="${key}" aria-label="More ${text}">+</button>
  </div></div>`;
}

/** A two-column list of label / value rows. */
export const kv = (rows) =>
  `<dl class="kv">${rows.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join('')}</dl>`;

export const card = (...parts) => `<div class="card">${parts.join('')}</div>`;

/** A full-width menu row: badge, title, hint and an optional "done" tick. */
export function menuRow({ action = 'go', value, badge, title, hint, done, nudge = false }) {
  let tick = '';
  if (done !== undefined) {
    tick = done
      ? '<span class="tick on"><span class="sr-only">Done</span></span>'
      : '<span class="tick"></span>';
  }
  return `<button type="button" class="rowbtn${nudge ? ' nudge' : ''}" data-a="${action}" data-v="${value}">
    <span class="ic" aria-hidden="true">${badge}</span>
    <span class="tx"><b>${title}</b><span>${hint}</span></span>
    ${tick}
  </button>`;
}

/** A small coloured status label. Tones: s (done), w (in progress), p (waiting), x (refused). */
export const pill = (text, tone) => `<span class="pill ${tone}">${text}</span>`;

/**
 * A QR-style square for printed sample tickets. It is decorative: the modules are pseudo-random
 * (seeded, so the same ticket always looks the same) and it does not encode anything.
 */
export function qr(seed) {
  let x = 7;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const random = () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
  const size = 21;
  const inFinderZone = (row, col) =>
    (row < 8 && col < 8) || (row < 8 && col >= size - 8) || (row >= size - 8 && col < 8);
  const eye = (row, col) =>
    `M${col} ${row}h7v7h-7zM${col + 1} ${row + 1}h5v5h-5zM${col + 2} ${row + 2}h3v3h-3z`;

  let path = eye(0, 0) + eye(0, size - 7) + eye(size - 7, 0);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!inFinderZone(row, col) && random() < 0.48) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return `<svg class="qr" viewBox="-1 -1 23 23" aria-hidden="true"><path fill-rule="evenodd" d="${path}"/></svg>`;
}
