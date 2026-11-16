// OPSMobile_Payroll concept demo: guided step-by-step workflow through an oil palm estate harvest day.
// Step 1: Check-in by Face, Employee Barcode, or NFC Badge.
// Step 2: FFB counting, pile photo (with EXIF auto-rotation), and thermal QR ticket printing.
// Step 3: Loading ticket (scanning the paper QR ticket onto a lorry).
// Step 4: Field conductor verification and dispatch.
// Step 5: Mill weighbridge reading and docket printing.
// Step 6: Admin force-sync with atomic SQLite transactions.

import { back, card, chips, heading, hhmm, kv, label, menuRow, num, qr, stepper } from '../ui.js';
import { BARCODE_BADGE, BUNCH_PHOTO, FACE, NFC, TRUCK } from '../art.js';

const STEPS = [
  { id: 'face', badge: 'IN', label: '1. Check-in', title: 'Check-in', hint: 'Face, Barcode or NFC badge' },
  { id: 'ffb', badge: 'FFB', label: '2. FFB Count', title: 'FFB counting', hint: 'Photo + print QR ticket' },
  { id: 'ltt', badge: 'LTT', label: '3. Loading', title: 'Loading ticket', hint: 'Scan QR onto lorry' },
  { id: 'ltv', badge: 'LTV', label: '4. Verify', title: 'Verification', hint: 'Check load & dispatch' },
  { id: 'wb', badge: 'WB', label: '5. Weighbridge', title: 'Weighbridge', hint: 'Scale reading & docket' },
  { id: 'admin', badge: 'ADM', label: '6. Force Sync', title: 'Force sync', hint: 'Atomic SQLite update' },
];

const TARE = 7820; // kg, empty lorry
const GROSS = 18460; // kg, loaded lorry on scale
const QUEUE_LIMIT = 8;

const SYNC_PHASES = [
  'Download updated biometric models from cloud',
  'Write records inside one SQLite transaction',
  'Commit transaction & switch active model',
];

const faceData = (s) => `Version ${s.faceVersion} &middot; ${s.faceCount} workers`;
const bunches = (s) => s.ripe + s.unripe;
const pending = (s) => s.queue.filter((record) => !record.ok).length;

function enqueue(ctx, text) {
  const s = ctx.state;
  s.queue.unshift({ t: text, ok: s.online });
  if (s.queue.length > QUEUE_LIMIT) s.queue.length = QUEUE_LIMIT;
  if (!s.online) ctx.toast('Saved offline on phone. Will sync later.');
}

const scanner = (hint, seed) =>
  `<div class="scanner scanner--qr" data-scanner>${qr(seed)}<i></i><span>${hint}</span></div>`;

function slip(title, number, rows, seed, caption) {
  return `<div class="slipwrap"><div class="slip">
    <b>${title}</b><br>No. ${number}
    <hr>${kv(rows)}
    <div class="slip__qr">${qr(seed)}<span>${caption}</span></div>
    SAMPLE - NOT A REAL TICKET
  </div></div>`;
}

function feedSlip(ctx) {
  const paper = ctx.$('.slip');
  if (!paper) return;
  paper.classList.add('is-feeding');
  paper.closest('.sim__screen').scrollTop = 1e4;
}

function forceSync(ctx, cut) {
  const s = ctx.state;
  const phase = (n, failed = false) => () => {
    s.sync = { phase: n, failed };
    ctx.render();
  };
  ctx.clearInsight();
  s.busy = true;
  phase(0)();
  if (!cut) {
    ctx.run([
      [650, phase(1)],
      [800, phase(2)],
      [550, () => {
        s.sync = { phase: 3, failed: false };
        s.done.admin = true;
        s.faceVersion += 1;
        s.faceCount += 7;
        s.busy = false;
        ctx.render();
        ctx.insight('forcesync');
      }],
    ]);
    return;
  }
  ctx.run([
    [650, phase(1)],
    [750, () => {
      s.sync = { phase: 1, failed: true };
      s.busy = false;
      ctx.render();
      ctx.insight('rollback');
    }],
  ]);
}

const METHOD_LABEL = {
  face: 'Face recognition',
  barcode: 'Employee barcode',
  nfc: 'NFC staff badge',
};

export default {
  id: 'payroll',
  name: 'OPSMobile_Payroll',
  offline: true,
  steps: STEPS,

  state: () => ({
    screen: 'face',
    online: true,
    busy: false,
    completed: false,
    done: {},
    queue: [],
    method: '', // 'face' | 'barcode' | 'nfc'
    clock: '',
    block: 'A12',
    ripe: 42,
    unripe: 3,
    loose: 18,
    photo: '', // '' | 'raw' | 'fixed'
    ticket: false,
    plate: 'QSA 4821',
    driver: 'Driver 1',
    loaded: false,
    loadTicket: false,
    verified: false,
    gross: 0,
    printed: false,
    faceVersion: 12,
    faceCount: 241,
    sync: null,
  }),

  pending,

  /** Step-by-step instructions telling the visitor how to use the app right now. */
  guide(s) {
    if (s.completed || s.screen === 'complete') {
      return {
        step: 6,
        total: 6,
        title: 'Payroll Demo Complete!',
        body: 'You have walked through the full harvest day workflow. Click "Yes, try another demo" to return to the app showcase above.',
      };
    }
    switch (s.screen) {
      case 'home':
        return {
          step: 1,
          total: 6,
          title: 'Choose a workflow step',
          body: 'Tap "1. Check-in" to start the guided harvest day from morning muster, or pick any step from the list.',
        };
      case 'face':
        if (!s.done.face) {
          return {
            step: 1,
            total: 6,
            title: 'Step 1: Check in the worker',
            body: 'Clock in worker W-1042 for morning muster. Tap "Scan Face", "Scan Employee Barcode", or "Tap NFC Badge" on the phone.',
          };
        }
        return {
          step: 1,
          total: 6,
          title: 'Step 1 Done: Worker Checked In',
          body: 'You can test another check-in method (Face, Barcode, or NFC), or tap "Next Step: FFB Counting" on the phone to continue.',
        };
      case 'ffb':
        if (!s.photo) {
          return {
            step: 2,
            total: 6,
            title: 'Step 2: FFB Counting & Pile Photo',
            body: 'Adjust the harvested bunch counts if you like, then tap "1. Snap photo of FFB pile" to see how the app fixes sideways OEM camera photos.',
          };
        }
        if (!s.ticket) {
          return {
            step: 2,
            total: 6,
            title: 'Step 2: Print Thermal Counting Ticket',
            body: 'The sideways photo was automatically rotated upright! Now tap "2. Save & print FFB ticket" to print the on-the-spot QR record.',
          };
        }
        return {
          step: 2,
          total: 6,
          title: 'Step 2 Done: FFB Ticket Printed',
          body: 'Tap "Next Step: Loading Ticket" on the phone to hand this printed QR ticket to the lorry loader.',
        };
      case 'ltt':
        if (!s.loaded) {
          return {
            step: 3,
            total: 6,
            title: 'Step 3: Scan QR Ticket onto Lorry',
            body: 'Estates have no mobile signal, so paper QR codes carry data from phone to phone. Tap "1. Scan counting ticket QR" on the phone.',
          };
        }
        if (!s.loadTicket) {
          return {
            step: 3,
            total: 6,
            title: 'Step 3: Print Loading Ticket',
            body: 'The bunch count is now on the loader\'s phone. Tap "2. Print loading ticket" to issue the lorry\'s loading slip.',
          };
        }
        return {
          step: 3,
          total: 6,
          title: 'Step 3 Done: Lorry Loaded',
          body: 'Tap "Next Step: Verification" on the phone so the field conductor can verify the load.',
        };
      case 'ltv':
        if (!s.verified) {
          return {
            step: 4,
            total: 6,
            title: 'Step 4: Field Conductor Verification',
            body: 'Tap "1. Scan loading ticket QR" on the phone to confirm the lorry\'s load matches the platform count.',
          };
        }
        return {
          step: 4,
          total: 6,
          title: 'Step 4: Dispatch Lorry to Mill',
          body: 'Counts verified! Tap "2. Verify & send to mill" to dispatch the lorry to the weighbridge.',
        };
      case 'wb':
        if (!s.gross) {
          return {
            step: 5,
            total: 6,
            title: 'Step 5: Mill Weighbridge Reading',
            body: 'The lorry is on the mill scale. Tap "1. Read the scale" to capture gross and net FFB weight.',
          };
        }
        if (!s.printed) {
          return {
            step: 5,
            total: 6,
            title: 'Step 5: Print Weighbridge Docket',
            body: 'Net weight is 10,640 kg. Tap "2. Print weighbridge docket" to print the final thermal receipt.',
          };
        }
        return {
          step: 5,
          total: 6,
          title: 'Step 5 Done: Docket Printed',
          body: 'Tap "Next Step: Admin Force Sync" on the phone to see how biometric updates are pushed from the cloud.',
        };
      case 'admin':
        if (!s.sync) {
          return {
            step: 6,
            total: 6,
            title: 'Step 6: Admin Force Sync',
            body: 'Push new worker biometric data from the cloud. Try "Sync, but cut link halfway" to see atomic rollback, or tap "Sync now".',
          };
        }
        if (s.sync.failed) {
          return {
            step: 6,
            total: 6,
            title: 'Step 6: Rolled Back Safely',
            body: 'The link dropped mid-write, so SQLite rolled back the transaction. Now tap "Sync now" to complete the atomic update.',
          };
        }
        return {
          step: 6,
          total: 6,
          title: 'All 6 Steps Complete!',
          body: 'The biometric database updated atomically. Tap "Finish Payroll Demo" on the phone!',
        };
      default:
        return { step: 1, total: 6, title: 'OPSMobile_Payroll', body: 'Follow the highlighted button on the phone.' };
    }
  },

  titles: {
    home: 'Payroll overview',
    face: 'Step 1: Check-in',
    ffb: 'Step 2: FFB counting',
    ltt: 'Step 3: Loading ticket',
    ltv: 'Step 4: Verification',
    wb: 'Step 5: Weighbridge',
    admin: 'Step 6: Force sync',
  },

  screens: {
    home(s) {
      const next = STEPS.find((st) => !s.done[st.id])?.id || 'face';
      const rows = STEPS.map((st) =>
        menuRow({
          value: st.id,
          badge: st.badge,
          title: st.label,
          hint: st.hint,
          done: Boolean(s.done[st.id]),
          nudge: st.id === next,
        }),
      );
      return [
        heading('Payroll Overview', '6-step guided field demo'),
        ...rows,
      ].join('');
    },

    face(s) {
      const ok = Boolean(s.done.face);
      const modeClass = s.method === 'nfc' ? ' nfc' : s.method === 'barcode' ? ' barcode' : '';
      const hudLeft = ok
        ? s.method === 'nfc'
          ? 'NFC BADGE VERIFIED'
          : s.method === 'barcode'
            ? 'BARCODE EMP-1042'
            : 'FACE VERIFIED'
        : 'READY TO CHECK IN';
      const hudRight = ok && s.method === 'face' ? 'MATCH 97.4%' : '';

      const controls = ok
        ? `${card(
            kv([
              ['Worker', 'W-1042 (Harvester)'],
              ['Clock-in', s.clock],
              ['Verified by', METHOD_LABEL[s.method] || 'Face'],
            ]),
          )}
          <div class="chips">
            <button type="button" class="chip${s.method === 'face' ? ' on' : ''}" data-a="scan">Try Face</button>
            <button type="button" class="chip${s.method === 'barcode' ? ' on' : ''}" data-a="barcode">Try Barcode</button>
            <button type="button" class="chip${s.method === 'nfc' ? ' on' : ''}" data-a="nfc">Try NFC Badge</button>
          </div>
          <button type="button" class="pbtn nudge" data-a="go" data-v="ffb">Next Step: FFB Counting &rarr;</button>`
        : `<button type="button" class="pbtn nudge" data-a="scan">Scan Face</button>
          <button type="button" class="pbtn alt" data-a="barcode">Scan Employee Barcode</button>
          <button type="button" class="pbtn alt" data-a="nfc">Tap NFC Badge</button>`;

      return `${back('home', 'Steps')}${heading('1. Worker Check-In', 'Scan face, barcode or NFC badge')}
        <div class="cam${modeClass}" data-cam>
          ${FACE}${NFC}${BARCODE_BADGE}
          <div class="ret"><i></i><i></i><i></i><i></i></div>
          <div class="beam"></div>
          <div class="hud"><span data-hud>${hudLeft}</span><span data-hud2>${hudRight}</span></div>
        </div>
        <div class="bar"><i data-bar style="width:${ok ? 100 : 0}%"></i></div>
        ${controls}`;
    },

    ffb(s) {
      const photo = s.photo
        ? `<div class="card snap"><div class="snap__frame${s.photo === 'raw' ? ' is-sideways' : ''}">${BUNCH_PHOTO}</div><span class="sub" data-snap>${s.photo === 'raw' ? 'Sideways raw sensor image...' : 'Auto-rotated upright via EXIF matrix'}</span></div>`
        : '<button type="button" class="pbtn nudge" data-a="photo">1. Snap photo of FFB pile</button>';

      let ticketArea = '';
      if (s.photo && !s.ticket) {
        ticketArea = '<button type="button" class="pbtn nudge" data-a="saveffb">2. Save &amp; print FFB ticket</button>';
      } else if (!s.photo && !s.ticket) {
        ticketArea = '<button type="button" class="pbtn alt" data-a="saveffb">Save &amp; print ticket</button>';
      } else if (s.ticket) {
        ticketArea = `${slip(
          'FFB COUNTING TICKET',
          'BC-000318',
          [
            ['Harvester', 'W-1042'],
            ['Block', s.block],
            ['Bunches', bunches(s)],
            ['Loose fruit', `${s.loose} kg`],
          ],
          `BC-000318-${s.block}-${bunches(s)}`,
          'Scan QR to load',
        )}
        <button type="button" class="pbtn nudge" data-a="go" data-v="ltt">Next Step: Loading Ticket &rarr;</button>`;
      }

      return `${back('face', 'Step 1')}${heading('2. FFB Harvest Counting', 'Count bunches, snap photo & print ticket')}
        ${label('Field block')}${chips('block', ['A12', 'B07', 'C03'], s.block)}
        ${card(
          stepper('Ripe bunches', 'ripe', s.ripe),
          stepper('Unripe bunches', 'unripe', s.unripe),
          stepper('Loose fruit (kg)', 'loose', s.loose),
        )}
        ${photo}${ticketArea}`;
    },

    ltt(s) {
      const load = s.loaded
        ? card(
            label('Scanned onto lorry'),
            `<div class="line"><div><b>Ticket BC-000318</b><span>Block ${s.block} &middot; Harvester W-1042</span></div><span class="mono">${bunches(s)} bunches</span></div>`,
          )
        : scanner("Point camera at the FFB ticket's QR code", `BC-000318-${s.block}-${bunches(s)}`);

      let action = '<button type="button" class="pbtn nudge" data-a="scanticket">1. Scan counting ticket QR</button>';
      if (s.loaded && !s.loadTicket) {
        action = '<button type="button" class="pbtn nudge" data-a="printload">2. Print loading ticket</button>';
      } else if (s.loadTicket) {
        action = `${slip(
          'LOADING TICKET',
          'LTT-000417',
          [
            ['Vehicle', s.plate],
            ['Driver', s.driver],
            ['Bunches', bunches(s)],
            ['Loose fruit', `${s.loose} kg`],
          ],
          `LTT-000417-${s.plate}`,
          'Scan QR to verify',
        )}
        <button type="button" class="pbtn nudge" data-a="go" data-v="ltv">Next Step: Verification &rarr;</button>`;
      }

      return `${back('ffb', 'Step 2')}${heading('3. Vehicle Loading (LTT)', 'Scan paper QR ticket onto lorry')}
        ${label('Vehicle')}${chips('plate', ['QSA 4821', 'QSB 1907'], s.plate)}
        ${load}${action}`;
    },

    ltv(s) {
      const ticket = s.verified
        ? card(
            label('Verified Loading Ticket LTT-000417'),
            kv([
              ['Vehicle', s.plate],
              ['Driver', s.driver],
              ['Bunches', bunches(s)],
              ['Loose fruit', `${s.loose} kg`],
            ]),
            '<p class="status ok">Matches harvester counting ticket.</p>',
          )
        : scanner("Point camera at the loading ticket's QR code", `LTT-000417-${s.plate}`);

      const action = s.verified
        ? '<button type="button" class="pbtn nudge" data-a="dispatch">2. Verify &amp; send to mill &rarr;</button>'
        : '<button type="button" class="pbtn nudge" data-a="scanload">1. Scan loading ticket QR</button>';

      return `${back('ltt', 'Step 3')}${heading('4. Load Verification (LTV)', 'Conductor checks the lorry load')}
        ${ticket}<div class="art">${TRUCK}</div>${action}`;
    },

    wb(s) {
      const net = s.gross ? s.gross - TARE : 0;
      const reading = `${back('ltv', 'Step 4')}${heading('5. Mill Weighbridge', `Vehicle ${s.plate} at the mill scale`)}
        ${card(
          label('Gross weight on scale'),
          `<span class="big" data-gross>${num(s.gross)} kg</span>`,
          kv([
            ['Tare (empty lorry)', `${num(TARE)} kg`],
            ['<b>Net FFB weight</b>', `<b data-net>${num(net)} kg</b>`],
          ]),
        )}`;
      if (!s.gross) return `${reading}<button type="button" class="pbtn nudge" data-a="weigh">1. Read the scale</button>`;
      if (!s.printed) return `${reading}<button type="button" class="pbtn nudge" data-a="print">2. Print weighbridge docket</button>`;
      return `${reading}
        ${slip(
          'WEIGHBRIDGE DOCKET',
          'WB-000317',
          [
            ['Vehicle', s.plate],
            ['Block', s.block],
            ['Bunches', bunches(s)],
            ['Gross', `${num(s.gross)} kg`],
            ['Tare', `${num(TARE)} kg`],
            ['NET FFB', `${num(net)} kg`],
          ],
          `WB-000317-${s.plate}`,
          'Mill record complete',
        )}
        <button type="button" class="pbtn nudge" data-a="go" data-v="admin">Next Step: Admin Force Sync &rarr;</button>`;
    },

    admin(s) {
      const at = s.sync;
      const phases = SYNC_PHASES.map((text, i) => {
        let cls = '';
        if (at && i < at.phase) cls = 'ok';
        else if (at && i === at.phase) cls = at.failed ? 'bad' : 'cur';
        return `<li class="${cls}">${text}</li>`;
      });
      const note = at?.failed
        ? '<p class="status warn">Connection dropped mid-write! SQLite rolled back — existing data is untouched.</p>'
        : at?.phase === 3
          ? '<p class="status ok">Committed atomically. Device switched to v13 face models.</p>'
          : '';
      const finishBtn =
        at?.phase === 3
          ? '<button type="button" class="pbtn nudge" data-a="finishdemo">Finish Payroll Demo &#10003;</button>'
          : '';
      return `${back('wb', 'Step 5')}${heading('6. Admin Force Sync', 'Atomic cloud-to-device biometric sync')}
        ${card(label('Biometric DB on device'), `<span class="big big--sm">${faceData(s)}</span>`)}
        <ol class="phases">${phases.join('')}</ol>
        ${note}
        <button type="button" class="pbtn${at?.phase === 3 ? ' alt' : ' nudge'}" data-a="forcesync">${at?.phase === 3 ? 'Sync again' : 'Sync now (Atomic transaction)'}</button>
        <button type="button" class="pbtn alt${!at ? ' nudge' : ''}" data-a="forcecut">Sync, but cut link halfway</button>
        ${finishBtn}`;
    },
  },

  actions: {
    block(ctx, value) {
      ctx.state.block = value;
      ctx.render();
    },
    plate(ctx, value) {
      ctx.state.plate = value;
      ctx.render();
    },
    inc(ctx, key) {
      ctx.state[key] = Math.min(999, ctx.state[key] + 1);
      ctx.render();
    },
    dec(ctx, key) {
      ctx.state[key] = Math.max(0, ctx.state[key] - 1);
      ctx.render();
    },

    scan(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      ctx.lock(button, 'Scanning face...');
      const cam = ctx.$('[data-cam]');
      const bar = ctx.$('[data-bar]');
      const left = ctx.$('[data-hud]');
      const right = ctx.$('[data-hud2]');
      cam.classList.remove('nfc', 'barcode', 'tapping');
      cam.classList.add('scan');
      let progress = 0;
      const timer = ctx.every(65, () => {
        progress += 5;
        bar.style.width = `${progress}%`;
        left.textContent = progress < 40 ? 'FACE DETECTED' : progress < 75 ? 'LIVENESS PASS' : 'MATCHING EMBEDDING';
        right.textContent = `${progress}%`;
        if (progress < 100) return;
        ctx.cancel(timer);
        s.busy = false;
        s.done.face = true;
        s.method = 'face';
        s.clock = hhmm();
        enqueue(ctx, 'Check-in W-1042 (Face)');
        ctx.render();
        ctx.$('[data-cam]')?.classList.add('flash');
        ctx.insight('face');
      });
    },

    barcode(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      ctx.lock(button, 'Scanning barcode...');
      const cam = ctx.$('[data-cam]');
      const bar = ctx.$('[data-bar]');
      const left = ctx.$('[data-hud]');
      const right = ctx.$('[data-hud2]');
      cam.classList.remove('nfc', 'tapping');
      cam.classList.add('barcode', 'scan');
      left.textContent = 'SCANNING BARCODE...';
      if (right) right.textContent = '';
      bar.style.width = '55%';
      ctx.after(950, () => {
        bar.style.width = '100%';
        s.busy = false;
        s.done.face = true;
        s.method = 'barcode';
        s.clock = hhmm();
        enqueue(ctx, 'Check-in W-1042 (Barcode)');
        ctx.render();
        ctx.insight('barcode');
      });
    },

    nfc(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      ctx.lock(button, 'Tapping NFC badge...');
      const cam = ctx.$('[data-cam]');
      const bar = ctx.$('[data-bar]');
      cam.classList.remove('barcode', 'scan');
      cam.classList.add('nfc', 'tapping');
      ctx.$('[data-hud]').textContent = 'READING NFC TAG...';
      bar.style.width = '60%';
      ctx.after(1050, () => {
        s.busy = false;
        s.done.face = true;
        s.method = 'nfc';
        s.clock = hhmm();
        enqueue(ctx, 'Check-in W-1042 (NFC)');
        ctx.render();
        ctx.insight('nfc');
      });
    },

    photo(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      s.photo = 'raw';
      s.busy = true;
      ctx.render();
      ctx.after(850, () => {
        s.photo = 'fixed';
        s.busy = false;
        ctx.render();
        ctx.insight('exif');
      });
    },

    saveffb(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      if (!s.photo) s.photo = 'fixed';
      s.done.ffb = true;
      s.ticket = true;
      enqueue(ctx, `FFB ${s.block} x${bunches(s)}`);
      ctx.render();
      feedSlip(ctx);
      ctx.insight('print');
    },

    scanticket(ctx, _, button) {
      ctx.clearInsight();
      ctx.lock(button, 'Scanning QR...');
      ctx.$('[data-scanner]').classList.add('is-scanning');
      ctx.after(800, () => {
        ctx.state.loaded = true;
        ctx.state.busy = false;
        ctx.render();
        ctx.insight('qr');
      });
    },

    printload(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      s.done.ltt = true;
      s.loadTicket = true;
      enqueue(ctx, `LTT ${s.plate}`);
      ctx.render();
      feedSlip(ctx);
      ctx.insight('print');
    },

    scanload(ctx, _, button) {
      ctx.clearInsight();
      ctx.lock(button, 'Scanning QR...');
      ctx.$('[data-scanner]').classList.add('is-scanning');
      ctx.after(800, () => {
        ctx.state.verified = true;
        ctx.state.busy = false;
        ctx.render();
        ctx.insight('qr');
      });
    },

    dispatch(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      ctx.lock(button, 'Dispatching lorry...');
      ctx.$('[data-truck]')?.classList.add('go');
      s.done.ltv = true;
      s.gross = 0;
      s.printed = false;
      enqueue(ctx, `LTV ${s.plate}`);
      ctx.after(900, () => ctx.go('wb'));
    },

    weigh(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      ctx.lock(button, 'Reading scale...');
      const gross = ctx.$('[data-gross]');
      const net = ctx.$('[data-net]');
      let reading = 0;
      const timer = ctx.every(55, () => {
        reading = Math.min(GROSS, reading + 1540);
        gross.textContent = `${num(reading)} kg`;
        net.textContent = `${num(Math.max(0, reading - TARE))} kg`;
        if (reading < GROSS) return;
        ctx.cancel(timer);
        s.busy = false;
        s.gross = GROSS;
        ctx.render();
      });
    },

    print(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      s.printed = true;
      s.done.wb = true;
      enqueue(ctx, 'Docket WB-000317');
      ctx.render();
      feedSlip(ctx);
      ctx.insight('docket');
    },

    forcesync: (ctx) => forceSync(ctx, false),
    forcecut: (ctx) => forceSync(ctx, true),
  },

  show: {
    face: (ctx) => ctx.go('face'),
    ffb: (ctx) => ctx.go('ffb'),
    ltt: (ctx) => ctx.go('ltt'),
    ltv: (ctx) => ctx.go('ltv'),
    wb: (ctx) => ctx.go('wb'),
    admin: (ctx) => ctx.go('admin'),
    nfc(ctx) {
      ctx.go('face');
    },
    print(ctx) {
      ctx.go('ffb');
    },
    exif(ctx) {
      ctx.state.photo = '';
      ctx.go('ffb');
    },
    forcesync(ctx) {
      ctx.state.sync = null;
      ctx.go('admin');
    },
  },

  insights: {
    face: {
      title: 'How I built it: On-Device Face Verification',
      body: '<p>Built offline face verification using Google ML Kit for face detection paired with a TensorFlow Lite embeddings model and liveness check, allowing field supervisors to clock workers in with zero mobile coverage.</p>',
    },
    barcode: {
      title: 'How I built it: Employee Barcode Verification',
      body: '<p>Integrated ZXing barcode scanning so workers can scan their staff ID barcode for rapid morning check-in against the local SQLite employee roster.</p>',
    },
    nfc: {
      title: 'How I built it: NFC Badge Tap-to-Verify',
      points: ['nfc'],
      body: '<p>Implemented Android NFC reader callbacks to read worker badge UIDs on tap and verify them against the local SQLite database — clocking workers in with a single tap and no network needed.</p>',
    },
    exif: {
      title: 'How I built it: Camera EXIF Orientation Matrix Fix',
      points: ['exif'],
      body: '<p>Different Android OEMs (Samsung, Xiaomi, rugged handhelds) write camera sensor EXIF orientation tags differently, causing sideways photos. I read the EXIF header post-capture and apply a <code>Matrix</code> rotation transform before saving the bitmap.</p>',
    },
    print: {
      title: 'How I built it: ESC/POS Thermal Printing & Pay Slips',
      points: ['print'],
      body: '<p>Developed custom ESC/POS byte-stream routines for mobile thermal printers to print on-the-spot pay slips, FFB counting tickets, and loading records in the field.</p>',
    },
    qr: {
      title: 'How I built it: Offline Phone-to-Phone QR Data Handoff',
      points: ['print'],
      body: '<p>Because oil palm blocks have no signal, each printed thermal ticket encodes its payload in a QR code. The next handheld scans the paper QR to import the exact harvest count offline.</p>',
    },
    docket: {
      title: 'How I built it: Weighbridge Docket & Field Reconciliation',
      points: ['print'],
      body: '<p>Prints the final weighbridge docket with gross, tare, and net FFB weight, linking the mill reading back to the original block and harvester tickets.</p>',
    },
    forcesync: {
      title: 'How I built it: Admin Force-Sync with Atomic SQLite Transactions',
      points: ['forcesync'],
      body: '<p>Designed an admin force-sync engine that downloads updated biometric embeddings from the cloud and writes them inside a single atomic SQLite transaction — ensuring devices never end up with half-written face data.</p>',
    },
    rollback: {
      title: 'How I built it: Fault-Tolerant SQLite Transaction Rollback',
      points: ['forcesync'],
      body: '<p>When the connection dropped mid-sync, the uncommitted SQLite transaction automatically rolled back, leaving the existing biometric models intact until a full sync succeeds.</p>',
    },
  },
};
