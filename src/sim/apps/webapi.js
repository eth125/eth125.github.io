// OPSWebAPI concept demo: guided step-by-step cloud backend sync & validation console.
// Step 1: Sync offline handheld records (or test cutting the link mid-batch).
// Step 2: Retry interrupted batch sync safely without duplicate rows.
// Step 3: Upload a binary multipart image file.
// Step 4: Validate payroll eligibility before cash disbursement.

const IDS = ['CHK-0412', 'CHK-0413', 'FFB-0318', 'LTT-0417', 'LTV-0417', 'WB-0317'];

const STEPS = [
  { id: 'batch', badge: 'SYNC', label: '1. Batch Sync', hint: 'Offline batch upload' },
  { id: 'retry', badge: 'RETRY', label: '2. Drop & Retry', hint: 'Idempotent upsert' },
  { id: 'image', badge: 'IMG', label: '3. Photo Upload', hint: 'Binary multipart stream' },
  { id: 'eligibility', badge: 'PAY', label: '4. Eligibility', hint: 'Payroll rule validation' },
];

const CHECKS = [
  { worker: 'W-1042', ok: true, why: 'active, not yet paid' },
  { worker: 'W-1103', ok: false, why: 'already paid this period' },
];

const freshRecords = () => IDS.map((id) => ({ id, state: 'queued', stored: false }));

const waiting = (s) => s.records.filter((record) => record.state !== 'acked').length;

function say(s, text, tone = '') {
  s.log.push({ text, tone });
  if (s.log.length > 40) s.log.shift();
}

function pulse(ctx) {
  ctx.render();
  for (const wire of ctx.$$('.wire')) wire.classList.add('is-live');
}

function sync(ctx, cutAt) {
  const s = ctx.state;
  let sent = 0;
  ctx.clearInsight();
  s.busy = true;

  const next = () => {
    const record = s.records.find((item) => item.state !== 'acked');
    if (!record) {
      s.busy = false;
      s.done.batch = true;
      if (s.retrying) s.done.retry = true;
      say(s, 'All 6 records confirmed in SQL Server.', 'ok');
      ctx.render();
      ctx.insight(s.retrying ? 'retry' : 'batch');
      s.retrying = false;
      return;
    }
    record.state = 'sending';
    say(s, `POST /sync/records  ${record.id}`);
    pulse(ctx);

    ctx.after(460, () => {
      const known = record.stored;
      if (!known) {
        record.stored = true;
        s.rows += 1;
      }
      if (cutAt !== undefined && sent === cutAt) {
        record.state = 'queued';
        s.busy = false;
        s.retrying = true;
        s.done.batch = true;
        say(s, 'Connection dropped! ACK lost for ' + record.id, 'bad');
        ctx.render();
        ctx.insight('cut');
        return;
      }
      record.state = 'acked';
      sent += 1;
      say(
        s,
        known ? `200  ${record.id} exists -> idempotent update` : `200  saved & ACKed ${record.id}`,
        known ? 'warn' : 'ok',
      );
      next();
    });
  };
  next();
}

export default {
  id: 'webapi',
  name: 'OPSWebAPI',
  frame: 'console',
  steps: STEPS,

  state: () => ({
    screen: 'home',
    busy: false,
    completed: false,
    done: {},
    records: freshRecords(),
    rows: 0,
    log: [{ text: 'Handheld back in signal. 6 offline records queued.', tone: '' }],
    retrying: false,
    check: 0,
  }),

  guide(s) {
    if (s.completed || s.screen === 'complete') {
      return {
        step: 4,
        total: 4,
        title: 'Web API Demo Complete!',
        body: 'You have tested offline batch sync, idempotent retry handling, binary image uploads, and server-side payroll eligibility validation.',
      };
    }
    if (!s.done.batch) {
      return {
        step: 1,
        total: 4,
        title: 'Step 1: High-Volume Offline Batch Sync',
        body: 'A handheld has 6 queued offline records. Tap "1. Sync, cut link halfway" (or "Sync 6 records") in the console to watch records flow through ASP.NET into SQL Server.',
      };
    }
    if (s.retrying || !s.done.retry) {
      return {
        step: 2,
        total: 4,
        title: 'Step 2: Safe Idempotent Retry',
        body: s.retrying
          ? 'The connection dropped before the 4th ACK reached the phone! Tap "Retry 3 records" to see how the API updates existing IDs without duplicating rows.'
          : 'Tap "Queue 6 more" and "Sync, cut link halfway" to test interrupted retry, or proceed to "3. Upload a photo".',
      };
    }
    if (!s.done.image) {
      return {
        step: 3,
        total: 4,
        title: 'Step 3: Binary Multipart Photo Upload',
        body: 'Now tap "3. Upload a photo" in the console to stream a compressed FFB pile photo to the backend.',
      };
    }
    if (!s.done.eligibility) {
      return {
        step: 4,
        total: 4,
        title: 'Step 4: Payroll Eligibility Validation',
        body: 'Tap "4. Check pay eligibility" to query the server before disbursing cash wages.',
      };
    }
    return {
      step: 4,
      total: 4,
      title: 'All 4 API Endpoints Tested!',
      body: 'You have walked through all OPSWebAPI endpoints! Tap "Finish Web API Demo" in the console.',
    };
  },

  titles: { home: 'OPSWebAPI sync console' },

  screens: {
    home(s) {
      const count = waiting(s);
      const dots = s.records.map((record) => `<i class="${record.state}"></i>`).join('');
      const log = s.log.slice(-6).map((line) => `<li class="${line.tone}">${line.text}</li>`);
      let syncText = `Sync ${count} records`;
      if (s.retrying) syncText = `2. Retry ${count} records`;
      if (!count) syncText = 'Queue 6 more records';

      const nudgeCut = !s.done.batch && count >= 4 && !s.retrying;
      const nudgeSync = s.retrying || (!s.done.batch && !nudgeCut);
      const nudgePhoto = s.done.batch && !s.retrying && !s.done.image;
      const nudgeCheck = s.done.image && !s.done.eligibility;
      const allDone = s.done.batch && s.done.image && s.done.eligibility;

      return `<div class="flow">
          <div class="node"><b>Handheld</b><span>${count} queued &middot; ${s.records.length - count} ACKed</span><div class="dots">${dots}</div></div>
          <div class="wire"><i></i></div>
          <div class="node node--api"><b>ASP.NET Web API</b><span>Controllers &middot; EF Models</span></div>
          <div class="wire"><i></i></div>
          <div class="node"><b>SQL Server</b><span>${s.rows} unique rows stored</span></div>
        </div>
        <ol class="log">${log.join('')}</ol>
        <div class="keys">
          <button type="button" class="key${nudgeCut ? ' nudge' : ''}" data-a="synccut"${count >= 4 && !s.retrying ? '' : ' disabled'}>1. Sync, cut link halfway</button>
          <button type="button" class="key${nudgeSync ? ' nudge' : ''}" data-a="${count ? 'sync' : 'refill'}">${syncText}</button>
          <button type="button" class="key${nudgePhoto ? ' nudge' : ''}" data-a="photo">3. Upload a photo</button>
          <button type="button" class="key${nudgeCheck ? ' nudge' : ''}" data-a="check">4. Check pay eligibility</button>
          ${allDone ? '<button type="button" class="key key--finish nudge" data-a="finishdemo">Finish Web API Demo &#10003;</button>' : ''}
        </div>`;
    },
  },

  actions: {
    sync: (ctx) => sync(ctx),
    synccut: (ctx) => sync(ctx, 3),

    refill(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      s.records = freshRecords();
      s.rows = 0;
      s.retrying = false;
      s.log = [{ text: 'Handheld back in signal. 6 offline records queued.', tone: '' }];
      ctx.render();
    },

    photo(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      s.busy = true;
      say(s, 'POST /sync/photos  multipart/form-data, 212 KB');
      pulse(ctx);
      ctx.after(800, () => {
        s.busy = false;
        s.done.image = true;
        say(s, '200  binary image saved, linked to FFB-0318', 'ok');
        ctx.render();
        ctx.insight('image');
      });
    },

    check(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      const sample = CHECKS[s.check % CHECKS.length];
      s.check += 1;
      s.busy = true;
      say(s, `GET /payroll/eligibility?worker=${sample.worker}&period=10/2026`);
      pulse(ctx);
      ctx.after(550, () => {
        s.busy = false;
        s.done.eligibility = true;
        say(s, `200  eligible: ${sample.ok ? 'true' : 'false'} (${sample.why})`, sample.ok ? 'ok' : 'warn');
        ctx.render();
        ctx.insight('eligibility');
      });
    },
  },

  show: {
    batch(ctx) {
      ctx.state.records = freshRecords();
      ctx.state.rows = 0;
      ctx.state.retrying = false;
      ctx.go('home');
      sync(ctx);
    },
    retry(ctx) {
      ctx.state.records = freshRecords();
      ctx.state.rows = 0;
      ctx.state.retrying = false;
      ctx.go('home');
      sync(ctx, 3);
    },
    image(ctx) {
      ctx.go('home');
      this.actions.photo(ctx);
    },
    eligibility(ctx) {
      ctx.go('home');
      this.actions.check(ctx);
    },
  },

  insights: {
    batch: {
      title: 'How I built it: ASP.NET Web API & EF Offline Batch Sync',
      points: ['batch'],
      body: '<p>Designed and implemented ASP.NET Web API controllers, Entity Framework models, and SQL Server tables that ingest high-volume offline record batches and return per-record acknowledgements.</p>',
    },
    cut: {
      title: 'How I built it: Handling Dropped Connections Mid-Sync',
      points: ['batch'],
      body: '<p>Record #4 was committed in SQL Server, but the HTTP response died before reaching the handheld. The handheld keeps the unacknowledged record queued and safely retries it next.',
    },
    retry: {
      title: 'How I built it: Idempotent Upsert by Device Record UUID',
      points: ['batch'],
      body: '<p>When the handheld retried the batch, the API matched the client-generated record ID in SQL Server and updated the existing row instead of inserting a duplicate — 6 records sent, 6 rows stored.</p>',
    },
    image: {
      title: 'How I built it: Binary Multipart Image Uploads',
      points: ['image'],
      body: '<p>Built dedicated binary image upload endpoints so field photos stream separately as compressed multipart files linked by transaction ID, keeping JSON record sync payloads fast and lightweight.</p>',
    },
    eligibility: {
      title: 'How I built it: Payroll Eligibility Validation',
      points: ['eligibility'],
      body: '<p>Built payroll eligibility validation endpoints that verify worker status and prior disbursements in SQL Server before a device is authorized to pay out cash.</p>',
    },
  },
};
