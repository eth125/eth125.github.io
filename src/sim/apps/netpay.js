// OPSMobileNetPay concept demo: guided step-by-step biometric cash wage distribution.
// Step 1: Test Liveness Detection against a printed photo spoof.
// Step 2: Compare untuned vs 15 FPS + cache tuning on budget hardware, then verify face with ML Kit + TFLite.
// Step 3: Disburse cash and test transactional duplicate-payment constraints.

import { back, card, chips, heading, hhmm, kv, label, menuRow, pill, rm } from '../ui.js';
import { FACE } from '../art.js';

const PERIOD = '10/2026';

const STEPS = [
  { id: 'liveness', badge: 'LIVE', label: '1. Liveness Check', hint: 'Refuse photo spoofing' },
  { id: 'perf', badge: 'FPS', label: '2. 15 FPS & Face Match', hint: 'ML Kit + TFLite on Galaxy A05s' },
  { id: 'payee', badge: 'PAY', label: '3. Payout & DB Guard', hint: 'Block duplicate disbursements' },
];

const freshWorkers = () => [
  { id: 'W-1042', role: 'Harvester', gang: 'Harvest 3', pay: 128450, paid: false, paidAt: '' },
  { id: 'W-1077', role: 'Loader', gang: 'Harvest 3', pay: 112600, paid: false, paidAt: '' },
  { id: 'W-1103', role: 'Tractor driver', gang: 'Transport 1', pay: 141075, paid: false, paidAt: '' },
];

function readout(ctx) {
  const bar = ctx.$('[data-bar]');
  const hud = ctx.$('[data-hud]');
  return (percent, text) => {
    if (bar) bar.style.width = `${percent}%`;
    if (hud) hud.textContent = text;
  };
}

export default {
  id: 'netpay',
  name: 'OPSMobileNetPay',
  steps: STEPS,

  state: () => ({
    screen: 'verify',
    busy: false,
    completed: false,
    done: {},
    workers: freshWorkers(),
    current: 0,
    tuned: true,
    result: '', // '' | 'reject' | 'spoof'
    verifiedAt: '',
    blocked: false,
  }),

  guide(s) {
    if (s.completed || s.screen === 'complete') {
      return {
        step: 3,
        total: 3,
        title: 'NetPay Demo Complete!',
        body: 'You have tested liveness anti-spoofing, 15 FPS budget phone optimization, ML Kit + TFLite face verification, and duplicate-payment database guards.',
      };
    }
    if (s.screen === 'home') {
      return {
        step: 1,
        total: 3,
        title: 'Choose a worker to verify',
        body: 'Tap "Scan the next worker\'s face" on the phone to open the biometric camera.',
      };
    }
    if (s.screen === 'verify') {
      if (!s.done.liveness) {
        return {
          step: 1,
          total: 3,
          title: 'Step 1: Test Liveness Detection (Anti-Spoofing)',
          body: 'First, try to trick the camera! Tap "Hold up a photo instead" on the phone to see how liveness detection blocks a printed photo, or tap "Scan Live Face".',
        };
      }
      if (s.result === 'reject' || !s.tuned) {
        return {
          step: 2,
          total: 3,
          title: 'Step 2: 15 FPS Tuning for Budget Phones',
          body: !s.tuned && s.result !== 'reject'
            ? 'Tuning is switched OFF. Tap "Scan Live Face" to see what happens on a budget phone when frames drop.'
            : 'Without tuning, frames dropped and a real worker was rejected! Now switch tuning to "On: 15 fps + cache" and tap "Scan Live Face".',
        };
      }
      return {
        step: 2,
        total: 3,
        title: 'Step 2: Verify Worker Face (or Test Tuning Off)',
        body: 'You can switch tuning "Off" to test frame drops on a Samsung Galaxy A05s, or tap "Scan Live Face" with tuning "On" to verify the worker and proceed to payment.',
      };
    }
    if (s.screen === 'payee') {
      const w = s.workers[s.current];
      if (!w.paid) {
        return {
          step: 3,
          total: 3,
          title: 'Step 3: Disburse Cash Wages',
          body: `Worker ${w.id} is verified (97.4% match). Tap "1. Confirm cash handed over" on the phone to record the payout.`,
        };
      }
      if (!s.blocked) {
        return {
          step: 3,
          total: 3,
          title: 'Step 3: Test Duplicate-Payout Protection',
          body: `Payout recorded! Now tap "2. Try to pay ${w.id} again" to see how transactional database constraints block double disbursements.`,
        };
      }
      return {
        step: 3,
        total: 3,
        title: 'All 3 Steps Complete!',
        body: 'Duplicate payment blocked by database constraints. Tap "Finish NetPay Demo" on the phone!',
      };
    }
    return { step: 1, total: 3, title: 'OPSMobileNetPay', body: 'Follow the highlighted button on the phone.' };
  },

  titles: {
    home: 'NetPay worker roster',
    verify: 'Face verification & liveness',
    payee: 'Cash payout & duplicate guard',
  },

  screens: {
    home(s) {
      const rows = s.workers.map(
        (w) =>
          `<div class="line"><div><b>${w.id}</b><span>${w.role} &middot; ${w.gang}</span></div><div class="line__end"><span class="mono">RM ${rm(w.pay)}</span>${w.paid ? pill('Paid', 's') : pill('To pay', 'p')}</div></div>`,
      );
      return `${heading('NetPay Roster', `Pay period ${PERIOD}`)}
        ${card(label('Cash wages to distribute'), rows.join(''))}
        <button type="button" class="pbtn nudge" data-a="go" data-v="verify">Scan Worker's Face &rarr;</button>`;
    },

    verify(s) {
      const failed = { reject: 'FALSE REJECTION', spoof: 'SPOOF BLOCKED' }[s.result];
      const note = {
        reject: 'Frames dropped on untuned camera! Switch tuning ON and scan again.',
        spoof: 'Blocked: liveness score 0.21 (printed photo detected).',
      }[s.result];
      const nudgeSpoof = !s.done.liveness;
      const nudgeScan = s.done.liveness && (s.tuned || s.result !== 'reject');
      return `${back('home', 'Roster')}${heading('1–2. Biometric Camera', 'ML Kit + TFLite + Liveness')}
        <div class="cam${s.result ? ' fail' : ''}${s.result === 'spoof' ? ' photo' : ''}" data-cam>
          ${FACE}
          <div class="ret"><i></i><i></i><i></i><i></i></div>
          <div class="beam"></div>
          <div class="hud"><span data-hud>${failed || 'READY'}</span><span>${s.tuned ? '15 FPS + CACHE' : '30 FPS RAW'}</span></div>
        </div>
        <div class="bar"><i data-bar></i></div>
        ${note ? `<p class="status warn">${note}</p>` : ''}
        ${label('Galaxy A05s frame tuning')}${chips('tuned', [['on', 'On: 15 fps + cache'], ['off', 'Off (30 fps)']], s.tuned ? 'on' : 'off', s.result === 'reject' ? 'on' : undefined)}
        <button type="button" class="pbtn${nudgeScan ? ' nudge' : ''}" data-a="scan">Scan Live Face &rarr;</button>
        <button type="button" class="pbtn alt${nudgeSpoof ? ' nudge' : ''}" data-a="spoof">Hold up a photo instead (Test Spoof)</button>`;
    },

    payee(s) {
      const w = s.workers[s.current];
      const paid = w.paid ? `<p class="status ok">Paid at ${w.paidAt}. Recorded in SQLite.</p>` : '';
      const refused = s.blocked
        ? `<div class="alert"><b>Duplicate Payout Blocked</b>${w.id} was already paid for period ${PERIOD}. Database constraint rejected this insert.</div>`
        : '';
      const buttons = w.paid
        ? `<button type="button" class="pbtn alt${s.blocked ? '' : ' nudge'}" data-a="payagain">2. Try to pay ${w.id} again</button>
           <button type="button" class="pbtn${s.blocked ? ' nudge' : ''}" data-a="finishdemo">Finish NetPay Demo &#10003;</button>`
        : '<button type="button" class="pbtn nudge" data-a="confirm">1. Confirm cash handed over</button>';
      return `${back('verify', 'Camera')}${heading(`3. Pay ${w.id}`, `Verified at ${s.verifiedAt} &middot; 97.4% match`)}
        ${card(kv([['Role', w.role], ['Gang', w.gang], ['Pay period', PERIOD]]))}
        ${card(label('Net cash payout'), `<span class="big">RM ${rm(w.pay)}</span>`, paid)}
        ${refused}${buttons}`;
    },
  },

  enter: {
    verify(ctx) {
      if (ctx.state.result) {
        ctx.state.result = '';
        ctx.render();
      }
    },
  },

  actions: {
    tuned(ctx, value) {
      ctx.clearInsight();
      ctx.state.tuned = value === 'on';
      ctx.state.result = '';
      ctx.render();
    },

    scan(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      s.result = '';
      ctx.lock(button, 'Scanning...');
      const cam = ctx.$('[data-cam]');
      const set = readout(ctx);
      cam.classList.remove('fail', 'photo');
      cam.classList.add('scan');

      if (s.tuned) {
        ctx.run([
          [250, () => set(25, 'FACE DETECTED')],
          [550, () => set(55, 'LIVENESS PASS 0.94')],
          [550, () => set(80, 'TFLITE EMBEDDING')],
          [550, () => set(100, 'MATCH 97.4%')],
          [400, () => {
            let index = s.workers.findIndex((w) => !w.paid);
            if (index < 0) {
              s.workers = freshWorkers();
              index = 0;
            }
            s.current = index;
            s.blocked = false;
            s.verifiedAt = hhmm();
            s.done.perf = true;
            ctx.go('payee');
            ctx.insight('face');
          }],
        ]);
        return;
      }

      ctx.run([
        [250, () => set(25, 'FACE DETECTED')],
        [500, () => set(40, 'FRAME DROPPED')],
        [500, () => set(30, 'STALE BUFFER')],
        [500, () => set(48, 'FRAME DROPPED')],
        [550, () => {
          s.result = 'reject';
          s.done.perf = true;
          s.busy = false;
          ctx.render();
          ctx.insight('perf');
        }],
      ]);
    },

    spoof(ctx, _, button) {
      const s = ctx.state;
      ctx.clearInsight();
      s.result = '';
      ctx.lock(button, 'Checking liveness...');
      const cam = ctx.$('[data-cam]');
      const set = readout(ctx);
      cam.classList.remove('fail');
      cam.classList.add('scan', 'photo');
      ctx.run([
        [350, () => set(25, 'FACE DETECTED')],
        [650, () => set(45, 'LIVENESS SCORE 0.21')],
        [550, () => {
          s.result = 'spoof';
          s.done.liveness = true;
          s.busy = false;
          ctx.render();
          ctx.insight('liveness');
        }],
      ]);
    },

    confirm(ctx) {
      ctx.clearInsight();
      const w = ctx.state.workers[ctx.state.current];
      w.paid = true;
      w.paidAt = hhmm();
      ctx.render();
      ctx.toast('Cash payout saved to SQLite');
    },

    payagain(ctx) {
      ctx.clearInsight();
      ctx.state.blocked = true;
      ctx.state.done.payee = true;
      ctx.render();
      ctx.insight('once');
    },
  },

  show: {
    liveness(ctx) {
      ctx.state.result = '';
      ctx.go('verify');
    },
    perf(ctx) {
      ctx.state.tuned = false;
      ctx.state.result = '';
      ctx.go('verify');
    },
    face(ctx) {
      ctx.state.tuned = true;
      ctx.go('verify');
    },
    payee(ctx) {
      const s = ctx.state;
      s.current = 0;
      s.verifiedAt = s.verifiedAt || hhmm();
      ctx.go('payee');
    },
    once(ctx) {
      const s = ctx.state;
      const w = s.workers[0];
      s.current = 0;
      s.verifiedAt = s.verifiedAt || hhmm();
      if (!w.paid) {
        w.paid = true;
        w.paidAt = hhmm();
      }
      s.blocked = true;
      ctx.go('payee');
      ctx.insight('once');
    },
  },

  insights: {
    liveness: {
      title: 'How I built it: Anti-Spoofing Liveness Detection',
      points: ['liveness'],
      body: '<p>Built liveness detection before face embedding comparison so printed photos and phone screens score below threshold and are immediately rejected before any cash can be disbursed.</p>',
    },
    perf: {
      title: 'How I built it: 15 FPS Frame Throttling & Inference Cache',
      points: ['perf'],
      body: '<p>Optimized camera analysis for budget field devices (Samsung Galaxy A05s) by throttling frame processing to ~15 FPS and adding an inference cache, preventing dropped frames and significantly reducing false rejection rates.</p>',
    },
    face: {
      title: 'How I built it: ML Kit + Custom TFLite Face Verification',
      points: ['face'],
      body: '<p>Bootstrapped the MVVM codebase from first commit and engineered real-time face verification combining Google ML Kit Face Detection with a custom TensorFlow Lite embeddings classifier.</p>',
    },
    once: {
      title: 'How I built it: Transactional DB Constraints & Lifecycle Safety',
      points: ['once'],
      body: '<p>Enforced transactional SQLite constraints that block duplicate cash disbursements for the same worker and pay period, and eliminated native camera memory leaks and <code>BadTokenException</code> crashes with strict lifecycle management.</p>',
    },
  },
};
