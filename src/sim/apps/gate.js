// OPSMobile_Main concept demo: guided step-by-step YOLOv8 + NMS + OCR license plate scanner.
// Step 1: Check in a standard car plate (YOLOv8 detection + Non-Maximum Suppression).
// Step 2: Check in a lorry with a 2-line plate (multi-line OCR reassembly & noise filtering).
// Step 3: Check in with an upside-down phone (reversed OCR reconstruction).
// Step 4: Check out a vehicle at real speed (zero-tap NV21 YUV-to-Bitmap camera loop).

import { back, card, chips, heading, hhmm, label, menuRow, stepper } from '../ui.js';

const VEHICLES = {
  car: { badge: 'CAR', title: '1. Standard Car Plate', hint: '1-line plate: YOLOv8 + NMS', plate: 'QAA 1234' },
  lorry: { badge: 'LRY', title: '2. Lorry (2-Line Plate)', hint: 'Scrambled lines + "DIESEL" noise', plate: 'QTK 5507' },
  upside: { badge: 'FLIP', title: '3. Upside-Down Phone', hint: 'Reversed OCR text reconstruction', plate: 'QSM 9081' },
};

const STEPS = [
  { id: 'car', badge: 'CAR', label: '1. Car (YOLOv8)', hint: 'YOLOv8 + NMS crop' },
  { id: 'lorry', badge: 'LRY', label: '2. 2-Line Lorry', hint: 'Multi-line OCR sort' },
  { id: 'upside', badge: 'FLIP', label: '3. Upside-Down', hint: 'Reversed text fix' },
  { id: 'out', badge: 'OUT', label: '4. Zero-Tap Out', hint: 'Real-speed NV21 loop' },
];

const STAGES = ['SEARCHING', 'CANDIDATES 4', 'BEST BOX 0.91', 'READING TEXT', 'CAPTURED'];

const reverse = (text) => [...text].reverse().join('');

function fragments(kind, plate) {
  const [letters, digits] = plate.split(' ');
  if (kind === 'lorry') return [[digits, false], ['DIESEL', true], [letters, false]];
  if (kind === 'upside') return [[reverse(digits), false], [reverse(letters), false]];
  return [[letters + digits, false], ['SARAWAK', true]];
}

function scene(kind, plate) {
  const [letters, digits] = plate.split(' ');
  const lorry = kind === 'lorry';
  const box = lorry ? { x: 106, y: 126, w: 58, h: 36 } : { x: 90, y: 112, w: 90, h: 24 };

  const plateText = lorry
    ? `<text x="135" y="141">${letters}</text><text x="135" y="157">${digits}</text>`
    : `<text x="135" y="129">${plate}</text>`;

  const body = lorry
    ? `<rect x="42" y="18" width="186" height="104" rx="4" fill="#7a5a3a"/>
       <path d="M88 18v104M135 18v104M182 18v104" stroke="#6a4c30" stroke-width="2"/>
       <text class="paint" x="135" y="64">DIESEL</text>
       <rect x="36" y="122" width="198" height="20" fill="#26323b"/>
       <rect x="44" y="126" width="26" height="12" rx="3" fill="#c2541b"/><rect x="200" y="126" width="26" height="12" rx="3" fill="#c2541b"/>
       <rect x="52" y="142" width="34" height="30" rx="5" fill="#10161b"/><rect x="184" y="142" width="34" height="30" rx="5" fill="#10161b"/>`
    : `<rect x="48" y="44" width="174" height="104" rx="20" fill="#3b4a57"/>
       <rect x="70" y="54" width="130" height="36" rx="9" fill="#1f2b34"/>
       <rect x="56" y="100" width="26" height="13" rx="4" fill="#c2541b"/><rect x="188" y="100" width="26" height="13" rx="4" fill="#c2541b"/>
       <rect x="42" y="140" width="186" height="14" rx="7" fill="#26323b"/>
       <text class="strip" x="135" y="150">SARAWAK</text>
       <rect x="58" y="154" width="28" height="16" rx="5" fill="#10161b"/><rect x="184" y="154" width="28" height="16" rx="5" fill="#10161b"/>`;

  const drawn = `${body}<rect class="plate" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="2"/>${plateText}`;
  const flipped = kind === 'upside';

  const at = flipped ? { ...box, x: 270 - box.x - box.w, y: 190 - box.y - box.h } : box;
  const rect = (dx, dy, dw, dh, cls) =>
    `<rect class="${cls}" x="${at.x + dx}" y="${at.y + dy}" width="${at.w + dw}" height="${at.h + dh}"/>`;
  const tag = (dx, dy, text) => `<text class="score" x="${at.x + dx}" y="${at.y + dy}">${text}</text>`;
  const stray = flipped ? { x: 52, y: 74 } : lorry ? { x: 40, y: 122 } : { x: 184, y: 96 };

  return `<svg viewBox="0 0 270 190" role="img" aria-label="Camera view of a vehicle's licence plate">
    <rect width="270" height="190" fill="#151c22"/>
    <g${flipped ? ' transform="rotate(180 135 95)"' : ''}>${drawn}</g>
    <g class="cand">
      ${rect(-6, -5, 12, 10, 'box')}${tag(-6, flipped ? at.h + 14 : -8, '0.91')}
      ${rect(5, -9, 8, 13, 'box')}
      ${rect(-13, 2, 14, 7, 'box')}
      <rect class="box weak" x="${stray.x}" y="${stray.y}" width="34" height="20"/><text class="score weak" x="${stray.x}" y="${stray.y - 3}">0.31</text>
    </g>
    <g class="best">${rect(-4, -4, 8, 8, 'box')}${tag(-4, flipped ? at.h + 13 : -7, 'plate 0.91')}</g>
  </svg>`;
}

function scan(ctx) {
  const s = ctx.state;
  const gate = ctx.$('[data-gate]');
  const hud = ctx.$('[data-hud]');
  if (!gate || !hud) return;
  const step = s.mode === 'in' ? 950 : 170;
  const stage = (n) => () => {
    gate.dataset.stage = n;
    hud.textContent = STAGES[n];
  };

  s.busy = true;
  ctx.run([
    [s.mode === 'in' ? 550 : 250, stage(1)],
    [step, stage(2)],
    [step, stage(3)],
    [step, stage(4)],
    [s.mode === 'in' ? 850 : 450, () => {
      if (s.mode === 'in') {
        s.done[s.kind] = true;
        ctx.go('form');
        ctx.insight({ car: 'scan', lorry: 'twoline', upside: 'flipped' }[s.kind]);
        return;
      }
      s.done.out = true;
      s.inside = s.inside.filter((v) => v.plate !== s.plate);
      ctx.go('home');
      ctx.toast(`${s.plate} checked out at real speed`);
      ctx.insight('zerotap');
    }],
  ]);
}

function arrive(ctx, kind) {
  const s = ctx.state;
  ctx.clearInsight();
  s.mode = 'in';
  s.kind = kind;
  s.plate = VEHICLES[kind].plate;
  ctx.go('camera');
}

function leave(ctx, plate) {
  const s = ctx.state;
  ctx.clearInsight();
  const vehicle = s.inside.find((v) => v.plate === plate);
  if (!vehicle) return;
  s.mode = 'out';
  s.kind = vehicle.kind;
  s.plate = plate;
  ctx.go('camera');
}

export default {
  id: 'gate',
  name: 'OPSMobile_Main',
  steps: STEPS,

  state: () => ({
    screen: 'home',
    busy: false,
    completed: false,
    done: {},
    waiting: ['car', 'lorry', 'upside'],
    inside: [{ plate: 'QAB 3157', kind: 'car', at: '07:52' }],
    mode: 'in',
    kind: 'car',
    plate: '',
    purpose: 'Delivery',
    people: 1,
  }),

  guide(s) {
    if (s.completed || s.screen === 'complete') {
      return {
        step: 4,
        total: 4,
        title: 'Gate Vision Demo Complete!',
        body: 'You have seen on-device YOLOv8 plate detection, Non-Maximum Suppression, multi-line & upside-down OCR reassembly, and zero-tap capture.',
      };
    }
    if (s.screen === 'camera') {
      return {
        step: s.mode === 'out' ? 4 : s.kind === 'car' ? 1 : s.kind === 'lorry' ? 2 : 3,
        total: 4,
        title: s.mode === 'out' ? 'Step 4: Real-Speed Zero-Tap Capture' : 'Watching the On-Device Vision Pipeline',
        body:
          s.mode === 'out'
            ? 'Checking out at real speed — no shutter tap needed!'
            : 'Watch the 4 stages on the phone: Detect (YOLOv8) → Filter (NMS) → Read (OCR) → Assemble.',
      };
    }
    if (s.screen === 'form') {
      const stepNum = s.kind === 'car' ? 1 : s.kind === 'lorry' ? 2 : 3;
      return {
        step: stepNum,
        total: 4,
        title: `Step ${stepNum} Captured: ${s.plate}`,
        body: 'The plate number was extracted and reassembled automatically. Tap "Confirm Check-In" on the phone to continue.',
      };
    }
    // Home screen
    if (!s.done.car) {
      return {
        step: 1,
        total: 4,
        title: 'Step 1: Scan a Standard Car Plate',
        body: 'Tap "1. Standard Car Plate" on the phone to watch the YOLOv8 detector and Non-Maximum Suppression pipeline in slow motion.',
      };
    }
    if (!s.done.lorry) {
      return {
        step: 2,
        total: 4,
        title: 'Step 2: Scan a Two-Line Lorry Plate',
        body: 'Now tap "2. Lorry (2-Line Plate)" to see how the OCR reassembly algorithm sorts scrambled two-line plates and strips out "DIESEL".',
      };
    }
    if (!s.done.upside) {
      return {
        step: 3,
        total: 4,
        title: 'Step 3: Scan with Upside-Down Phone',
        body: 'Tap "3. Upside-Down Phone" to see how reversed OCR fragments ("1809" & "MSQ") are reconstructed into QSM 9081.',
      };
    }
    if (!s.done.out) {
      return {
        step: 4,
        total: 4,
        title: 'Step 4: Real-Speed Zero-Tap Check-Out',
        body: 'Now tap "Check out" next to a vehicle inside the estate to watch the NV21 camera loop capture at real speed.',
      };
    }
    return {
      step: 4,
      total: 4,
      title: 'All 4 Vision Cases Complete!',
      body: 'You have tested every license plate scenario! Tap "Finish Gate Demo" on the phone.',
    };
  },

  titles: { home: 'Gate scanner home', camera: 'YOLOv8 plate camera', form: 'Check-in form' },

  screens: {
    home(s) {
      const nextKind = s.waiting[0];
      const waiting = s.waiting.map((kind) =>
        menuRow({
          action: 'arrive',
          value: kind,
          ...VEHICLES[kind],
          done: Boolean(s.done[kind]),
          nudge: kind === nextKind && !s.done.out,
        }),
      );
      const inside = s.inside.map(
        (v, i) =>
          `<div class="line"><div><b>${v.plate}</b><span>In at ${v.at}</span></div><button type="button" class="mini${!s.waiting.length && !s.done.out && i === 0 ? ' nudge' : ''}" data-a="leave" data-v="${v.plate}">Check out</button></div>`,
      );
      const doneBtn = s.done.out
        ? '<button type="button" class="pbtn nudge" data-a="finishdemo">Finish Gate Demo &#10003;</button>'
        : '';
      return `${heading('OPSMobile_Main Gate', 'Point at a vehicle plate — zero shutter tap')}
        ${
          waiting.length
            ? label('Arriving at the gate (Tap in order)') + waiting.join('')
            : '<button type="button" class="pbtn alt" data-a="refill">Reset arriving vehicles</button>'
        }
        ${card(label('Inside the estate (Real-speed check-out)'), inside.join('') || '<p class="sub">All vehicles checked out.</p>')}
        ${doneBtn}`;
    },

    camera(s) {
      const found = fragments(s.kind, s.plate).map(
        ([text, noise]) => `<span class="frag${noise ? ' noise' : ''}">${text}</span>`,
      );
      return `${back()}${heading(s.mode === 'in' ? 'Check-In Pipeline' : 'Real-Speed Check-Out', 'Automatic zero-tap capture')}
        <div class="gate" data-gate data-stage="0">
          <div class="gatecam">${scene(s.kind, s.plate)}<span class="gatecam__hud" data-hud>${STAGES[0]}</span></div>
          <ol class="track"><li>Detect</li><li>Filter</li><li>Read</li><li>Assemble</li></ol>
          <div class="card">
            ${label('Raw OCR fragments')}<div class="frags">${found.join('')}</div>
            ${label('Reassembled plate')}<span class="big assembled">${s.plate}</span>
          </div>
        </div>`;
    },

    form(s) {
      return `${back()}${heading('Gate Check-In', 'Auto-filled from camera')}
        ${card(label('Vehicle registration'), `<span class="big">${s.plate}</span>`, '<p class="status ok">Verified by YOLOv8 + OCR reassembly.</p>')}
        ${label('Purpose of visit')}${chips('purpose', ['Delivery', 'Collection', 'Visitor'], s.purpose)}
        ${card(stepper('People in vehicle', 'people', s.people))}
        <button type="button" class="pbtn nudge" data-a="checkin">Confirm Check-In &rarr;</button>`;
    },
  },

  enter: { camera: scan },

  actions: {
    arrive,
    leave,
    purpose(ctx, value) {
      ctx.state.purpose = value;
      ctx.render();
    },
    inc(ctx) {
      ctx.state.people = Math.min(9, ctx.state.people + 1);
      ctx.render();
    },
    dec(ctx) {
      ctx.state.people = Math.max(1, ctx.state.people - 1);
      ctx.render();
    },
    checkin(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      s.waiting = s.waiting.filter((kind) => kind !== s.kind);
      if (!s.inside.some((v) => v.plate === s.plate)) {
        s.inside.unshift({ plate: s.plate, kind: s.kind, at: hhmm() });
      }
      ctx.go('home');
      ctx.toast(`${s.plate} checked in`);
    },
    refill(ctx) {
      ctx.clearInsight();
      ctx.state.waiting = ['car', 'lorry', 'upside'];
      ctx.state.inside = [{ plate: 'QAB 3157', kind: 'car', at: '07:52' }];
      ctx.render();
    },
  },

  show: {
    car: (ctx) => arrive(ctx, 'car'),
    lorry: (ctx) => arrive(ctx, 'lorry'),
    upside: (ctx) => arrive(ctx, 'upside'),
    out(ctx) {
      const s = ctx.state;
      if (!s.inside.length) s.inside.push({ plate: 'QAB 3157', kind: 'car', at: '07:52' });
      leave(ctx, s.inside[0].plate);
    },
    detect: (ctx) => arrive(ctx, 'car'),
    nms: (ctx) => arrive(ctx, 'car'),
    reassemble: (ctx) => arrive(ctx, 'lorry'),
    zerotap(ctx) {
      const s = ctx.state;
      if (!s.inside.length) s.inside.push({ plate: 'QAB 3157', kind: 'car', at: '07:52' });
      leave(ctx, s.inside[0].plate);
    },
  },

  insights: {
    detect: {
      title: 'How I built it: Custom YOLOv8 TFLite Detector',
      body: '<p>Integrated a custom-trained YOLOv8 TensorFlow Lite license plate detector on-device, replacing a slow full-screen OCR processor.',
    },
    nms: {
      title: 'How I built it: Non-Maximum Suppression (NMS) & ROI Cropping',
      body: '<p>Wrote the post-processing pipeline for raw YOLOv8 output tensors: confidence filtering, Non-Maximum Suppression (NMS), bounding box denormalization, and region-of-interest cropping.</p>',
    },
    zerotap: {
      title: 'How I built it: Automatic Zero-Tap NV21 Camera Loop',
      points: ['zerotap'],
      body: '<p>Replaced manual shutter capture with an automatic zero-tap camera scanning loop using NV21 YUV-to-Bitmap frame conversion that locks onto and submits the plate as soon as a valid pattern is verified.</p>',
    },
    reassemble: {
      title: 'How I built it: Multi-Line & Reversed OCR Reassembly',
      body: '<p>Engineered an OCR text reassembly algorithm that reconstructs multi-line, scrambled, or upside-down text while filtering out painted vehicle noise like "DIESEL" or "SARAWAK".</p>',
    },
    scan: {
      title: 'How I built it: YOLOv8 + Non-Maximum Suppression (NMS)',
      points: ['detect', 'nms'],
      body: '<p>Integrated a custom YOLOv8 TFLite model and wrote the tensor post-processing pipeline: Non-Maximum Suppression (NMS) eliminates overlapping candidate boxes, denormalizes coordinates, and crops only the plate region for OCR.</p>',
    },
    twoline: {
      title: 'How I built it: Multi-Line Scrambled OCR Reassembly',
      points: ['detect', 'nms', 'reassemble'],
      body: '<p>On lorries, OCR returned <code>"5507"</code>, <code>"DIESEL"</code>, and <code>"QTK"</code> out of order. My reassembly algorithm sorts bounding boxes, strips painted noise words, and reconstructs <b>QTK 5507</b>.</p>',
    },
    flipped: {
      title: 'How I built it: Upside-Down Reversed OCR Reconstruction',
      points: ['detect', 'nms', 'reassemble'],
      body: '<p>When a guard holds the phone upside down, OCR reads <code>"1809"</code> and <code>"MSQ"</code>. The reassembly engine tests reversed token permutations against Malaysian plate regexes to recover <b>QSM 9081</b>.</p>',
    },
  },
};
