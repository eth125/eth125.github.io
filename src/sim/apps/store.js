// OPSMobile_Store concept demo: guided step-by-step workflow through a retail POS & store room app.
// Step 1: Add canteen items to the sale.
// Step 2: Checkout with BigDecimal HALF_UP rounding to nearest 0.10 & select printer link.
// Step 3: Print receipt over Bluetooth/BLE/Network/USB and test automatic socket recovery.
// Step 4: Scan barcodes to receive stock against a Purchase Order.
// Step 5: Upload offline records with fault-tolerant batch sync.

import { back, card, chips, heading, hhmm, kv, label, menuRow, pill, rm, stepper } from '../ui.js';

const MENU = [
  { sku: 'roti', name: 'Roti canai', price: 120 },
  { sku: 'puff', name: 'Curry puff', price: 115 },
  { sku: 'nasi', name: 'Nasi lemak', price: 350 },
  { sku: 'teh', name: 'Teh tarik', price: 185 },
  { sku: 'mee', name: 'Mee goreng', price: 455 },
  { sku: 'kaya', name: 'Kaya toast', price: 205 },
];

const LINKS = ['Bluetooth', 'BLE', 'Network', 'USB'];

const STEPS = [
  { id: 'sale', badge: 'SALE', label: '1. Canteen Sale', hint: 'Add items to basket' },
  { id: 'pay', badge: 'PAY', label: '2. Rounding & Pay', hint: 'BigDecimal 0.10 rounding' },
  { id: 'print', badge: 'PRT', label: '3. Print Receipt', hint: '4 links + socket recovery' },
  { id: 'receive', badge: 'RCV', label: '4. Stock Receive', hint: 'Barcode PO workflow' },
  { id: 'sync', badge: 'SYNC', label: '5. Offline Sync', hint: 'Fault-tolerant batch sync' },
];

const subtotal = (cart) => MENU.reduce((sum, item) => sum + item.price * (cart[item.sku] || 0), 0);

/** Half-up to the nearest 10 sen: 235 -> 240, 234 -> 230. */
const roundToTen = (sen) => Math.floor((sen + 5) / 10) * 10;

function floatTotal(cart) {
  let total = 0;
  for (const item of MENU) {
    for (let i = 0; i < (cart[item.sku] || 0); i++) total += item.price / 100;
  }
  return Math.round(total * 10) / 10;
}

const signed = (sen) => `${sen > 0 ? '+' : ''}${rm(sen)}`;

function suggest(cart) {
  const skus = Object.keys(cart);
  if (!skus.length) return 'roti';
  if (skus.length === 1 && cart.roti) return 'puff';
  return 'pay';
}

const waiting = (s) => s.queue.filter((record) => record.state !== 'sent').length;

function sampleSale(s, cart) {
  const sub = subtotal(cart);
  const total = roundToTen(sub);
  s.receiptNo += 1;
  s.last = {
    no: s.receiptNo,
    time: hhmm(),
    lines: MENU.filter((item) => cart[item.sku]).map((item) => ({
      name: item.name,
      qty: cart[item.sku],
      amount: item.price * cart[item.sku],
    })),
    sub,
    total,
    tendered: s.tendered || total,
  };
  s.queue.unshift({ id: `Sale #${s.receiptNo}`, state: 'queued' });
}

function receipt(sale) {
  const lines = sale.lines.map((line) => [`${line.qty} x ${line.name}`, rm(line.amount)]);
  return `<div class="slip">
    <b>CANTEEN (SAMPLE)</b><br>Receipt #${sale.no} &middot; ${sale.time}
    <hr>${kv(lines)}<hr>
    ${kv([
      ['Subtotal', rm(sale.sub)],
      ['Rounding', signed(sale.total - sale.sub)],
      ['TOTAL RM', rm(sale.total)],
      ['Cash', rm(sale.tendered)],
      ['Change', rm(sale.tendered - sale.total)],
    ])}
    <hr>SAMPLE - NOT A REAL RECEIPT
  </div>`;
}

function printReceipt(ctx, cut) {
  const s = ctx.state;
  const slip = ctx.$('.slip');
  const status = ctx.$('[data-status]');
  const buttons = ctx.$$('[data-print]');
  if (!slip || !status) return;

  const say = (text, tone = '') => {
    status.textContent = text;
    status.className = `status ${tone}`;
  };
  const feed = (name) => {
    slip.classList.remove('is-feeding', 'is-jammed');
    void slip.offsetWidth;
    slip.classList.add(name);
  };
  const finish = (insight) => {
    s.busy = false;
    s.done.print = true;
    for (const button of buttons) button.disabled = false;
    say(`Printed over ${s.link}.`, 'ok');
    ctx.insight(insight);
  };

  ctx.clearInsight();
  s.busy = true;
  for (const button of buttons) button.disabled = true;
  say(`Sending to printer over ${s.link}...`);

  if (!cut) {
    feed('is-feeding');
    ctx.after(1400, () => finish('printing'));
    return;
  }
  feed('is-jammed');
  ctx.run([
    [700, () => say('Socket dropped! Reconnecting...', 'warn')],
    [1200, () => {
      say('Socket recovered. Reprinting receipt...');
      feed('is-feeding');
    }],
    [1400, () => finish('recovery')],
  ]);
}

function upload(ctx, cutAfter) {
  const s = ctx.state;
  let sent = 0;
  ctx.clearInsight();
  s.busy = true;

  const next = () => {
    let record = null;
    for (let i = s.queue.length - 1; i >= 0 && !record; i--) {
      if (s.queue[i].state !== 'sent') record = s.queue[i];
    }
    if (!record) {
      s.busy = false;
      s.done.sync = true;
      ctx.render();
      ctx.insight('sync');
      return;
    }
    record.state = 'sending';
    ctx.render();
    ctx.after(550, () => {
      if (!s.online || (cutAfter !== undefined && sent >= cutAfter)) {
        record.state = 'queued';
        s.online = false;
        s.busy = false;
        ctx.render();
        ctx.insight('synccut');
        return;
      }
      record.state = 'sent';
      sent += 1;
      next();
    });
  };
  next();
}

export default {
  id: 'store',
  name: 'OPSMobile_Store',
  offline: true,
  steps: STEPS,

  state: () => ({
    screen: 'sale',
    online: true,
    busy: false,
    completed: false,
    done: {},
    cart: {},
    tendered: 0,
    link: 'Bluetooth',
    receiptNo: 1040,
    last: null,
    queue: [
      { id: 'Sale #1040', state: 'queued' },
      { id: 'Stock count #212', state: 'queued' },
    ],
    po: [
      { name: 'Cooking oil 5 kg', code: '955 0001 20045', ordered: 4, got: 0 },
      { name: 'Rice 10 kg', code: '955 0001 31072', ordered: 6, got: 0 },
      { name: 'Sugar 1 kg', code: '955 0001 48810', ordered: 10, got: 0 },
    ],
    scanned: '',
  }),

  pending: waiting,

  guide(s) {
    if (s.completed || s.screen === 'complete') {
      return {
        step: 5,
        total: 5,
        title: 'Store Demo Complete!',
        body: 'You have tested the canteen checkout, multi-link thermal printing, barcode PO receiving, and offline sync.',
      };
    }
    switch (s.screen) {
      case 'home':
        return {
          step: 1,
          total: 5,
          title: 'Choose a Store module',
          body: 'Tap "1. Canteen Sale" to start the guided POS walkthrough.',
        };
      case 'sale': {
        const skus = Object.keys(s.cart);
        if (!skus.length) {
          return {
            step: 1,
            total: 5,
            title: 'Step 1: Ring up a Canteen Sale',
            body: 'Tap "Roti canai" (RM 1.20) and "Curry puff" (RM 1.15) on the phone to see how 0.10 rounding handles RM 2.35.',
          };
        }
        if (skus.length === 1 && s.cart.roti) {
          return {
            step: 1,
            total: 5,
            title: 'Step 1: Add Curry Puff',
            body: 'Now tap "Curry puff" (RM 1.15) so the subtotal reaches RM 2.35, then tap the "Pay" button.',
          };
        }
        return {
          step: 1,
          total: 5,
          title: 'Step 1: Proceed to Payment',
          body: 'Tap the highlighted "Pay" button at the bottom of the phone to calculate the rounded total.',
        };
      }
      case 'pay':
        if (!s.tendered) {
          return {
            step: 2,
            total: 5,
            title: 'Step 2: Select Cash & Printer Link',
            body: 'Tap a "Cash received" chip (e.g. Exact) and pick a printer connection (Bluetooth, BLE, Network, or USB), then tap "Confirm and print".',
          };
        }
        return {
          step: 2,
          total: 5,
          title: 'Step 2: Confirm & Print Receipt',
          body: 'You can switch the printer link if you like, then tap "Confirm and print" to feed out the ESC/POS receipt.',
        };
      case 'print':
        return {
          step: 3,
          total: 5,
          title: 'Step 3: Thermal Receipt & Socket Recovery',
          body: 'Tap "Reprint, but cut link halfway" to watch the engine recover a dropped printer socket, or tap "Next Step: Stock Receive".',
        };
      case 'receive':
        if (!s.done.receive) {
          return {
            step: 4,
            total: 5,
            title: 'Step 4: Barcode Stock Receive',
            body: 'A delivery arrived for Purchase Order PO-2231. Tap "Scan a barcode" on the phone to book in boxes with ZXing.',
          };
        }
        return {
          step: 4,
          total: 5,
          title: 'Step 4 Done: PO Line Updated',
          body: 'You can scan more boxes to watch lines go from Partial to Complete, or tap "Next Step: Offline Sync" to continue.',
        };
      case 'sync': {
        const count = waiting(s);
        if (!s.online) {
          return {
            step: 5,
            total: 5,
            title: 'Step 5: Reconnect & Resume Upload',
            body: 'The connection dropped mid-upload! Tap "Reconnect & Upload Remaining" (or the Offline badge in the top bar) to finish syncing safely.',
          };
        }
        if (count > 0) {
          return {
            step: 5,
            total: 5,
            title: 'Step 5: Offline-First Batch Sync',
            body: 'Sales and stock counts are queued in local SQLite. Tap "Upload, cut link halfway" to test fault tolerance, or "Upload now".',
          };
        }
        return {
          step: 5,
          total: 5,
          title: 'All 5 Steps Complete!',
          body: 'Every record is confirmed on the server. Tap "Finish Store Demo" on the phone!',
        };
      }
      default:
        return { step: 1, total: 5, title: 'OPSMobile_Store', body: 'Follow the highlighted button on the phone.' };
    }
  },

  titles: {
    home: 'Store overview',
    sale: 'Step 1: Canteen sale',
    pay: 'Step 2: Rounding & payment',
    print: 'Step 3: Receipt printing',
    receive: 'Step 4: Stock receive',
    sync: 'Step 5: Offline sync',
  },

  screens: {
    home(s) {
      return [
        heading('Store Overview', '5-step guided POS demo'),
        ...STEPS.map((st) =>
          menuRow({
            value: st.id,
            badge: st.badge,
            title: st.label,
            hint: st.hint,
            done: Boolean(s.done[st.id]),
          }),
        ),
      ].join('');
    },

    sale(s) {
      const lines = MENU.filter((item) => s.cart[item.sku]);
      const sub = subtotal(s.cart);
      const total = roundToTen(sub);
      const hint = suggest(s.cart);
      const tiles = MENU.map(
        (item) =>
          `<button type="button" class="tile${hint === item.sku ? ' nudge' : ''}" data-a="add" data-v="${item.sku}"><b>${item.name}</b><span>${rm(item.price)}</span></button>`,
      ).join('');
      const cart = lines.length
        ? card(lines.map((item) => stepper(item.name, item.sku, s.cart[item.sku], 'less', 'more')).join(''))
        : '<p class="sub">Tap food items above (try Roti canai + Curry puff) to add them to the basket.</p>';
      return `${back('home', 'Steps')}${heading('1. Canteen Sale', 'Tap items to build a basket')}
        <div class="tiles">${tiles}</div>
        ${cart}
        ${card(
          kv([
            ['Subtotal', rm(sub)],
            ['Rounding (0.10)', signed(total - sub)],
            ['<b>Total</b>', `<b>RM ${rm(total)}</b>`],
          ]),
        )}
        <button type="button" class="pbtn${lines.length && hint === 'pay' ? ' nudge' : ''}" data-a="checkout"${lines.length ? '' : ' disabled'}>Pay RM ${rm(total)} &rarr;</button>`;
    },

    pay(s) {
      const total = roundToTen(subtotal(s.cart));
      const notes = [1000, 2000, 5000].filter((note) => note > total).slice(0, 2);
      const cash = [[String(total), 'Exact'], ...notes.map((note) => [String(note), `RM ${note / 100}`])];
      return `${back('sale', 'Step 1')}${heading('2. Take Payment', 'BigDecimal rounding & printer link')}
        ${card(label('Total (rounded HALF_UP to 0.10)'), `<span class="big">RM ${rm(total)}</span>`)}
        ${label('Cash received')}${chips('tender', cash, String(s.tendered), s.tendered ? undefined : String(total))}
        ${card(kv([['Change due', s.tendered ? `RM ${rm(s.tendered - total)}` : '&ndash;']]))}
        ${label('Receipt printer link')}${chips('link', LINKS, s.link)}
        <button type="button" class="pbtn${s.tendered ? ' nudge' : ''}" data-a="confirm"${s.tendered ? '' : ' disabled'}>Confirm and print &rarr;</button>`;
    },

    print(s) {
      const sale = s.last || { no: 1041, time: hhmm(), lines: [{ name: 'Roti canai', qty: 1, amount: 120 }, { name: 'Curry puff', qty: 1, amount: 115 }], sub: 235, total: 240, tendered: 240 };
      return `${back('pay', 'Step 2')}${heading('3. Thermal Receipt', `Sale #${sale.no}`)}
        <p class="status" data-status></p>
        <div class="slipwrap">${receipt(sale)}</div>
        <button type="button" class="pbtn alt nudge" data-a="cutprint" data-print>Reprint, but cut link halfway</button>
        <button type="button" class="pbtn alt" data-a="reprint" data-print>Reprint normally</button>
        <button type="button" class="pbtn" data-a="go" data-v="receive">Next Step: Stock Receive &rarr;</button>`;
    },

    receive(s) {
      const started = s.po.some((line) => line.got > 0);
      const complete = s.po.every((line) => line.got >= line.ordered);
      const order = complete ? pill('Fully received', 's') : started ? pill('Partly received', 'w') : pill('Open', 'p');
      const lines = s.po.map((line) => {
        const status =
          line.got === 0 ? pill('Pending', 'p') : line.got < line.ordered ? pill('Partial', 'w') : pill('Complete', 's');
        return `<div class="line"><div><b>${line.name}</b><span>Received ${line.got} of ${line.ordered}</span></div>${status}</div>`;
      });
      return `${back('print', 'Step 3')}${heading('4. Stock Receive', 'Purchase order PO-2231')}
        <div class="scanner" data-scanner><div class="scanner__code"></div><i></i><span>${s.scanned || 'Point camera at delivery barcode'}</span></div>
        ${card(`<div class="line"><div><b>Sample Supplies</b><span>3 lines on PO-2231</span></div>${order}</div>`, lines.join(''))}
        <button type="button" class="pbtn${!s.done.receive ? ' nudge' : ' alt'}" data-a="scanstock"${complete ? ' disabled' : ''}>${complete ? 'All PO items received' : 'Scan a barcode'}</button>
        ${s.done.receive ? '<button type="button" class="pbtn nudge" data-a="go" data-v="sync">Next Step: Offline Sync &rarr;</button>' : ''}`;
    },

    sync(s) {
      const count = waiting(s);
      const rows = s.queue.map((record) => {
        const status =
          record.state === 'sent'
            ? '<span class="s">confirmed</span>'
            : record.state === 'sending'
              ? '<span class="w">sending...</span>'
              : '<span class="p">queued on phone</span>';
        return `<li><span>${record.id}</span>${status}</li>`;
      });
      const idle = !s.busy && s.online;
      return `${back('receive', 'Step 4')}${heading('5. Offline Batch Sync', s.online ? 'Server reachable' : 'Connection lost')}
        ${card(label('SQLite sync queue'), `<ul class="qlist">${rows.join('')}</ul>`)}
        ${
          !s.online
            ? '<button type="button" class="pbtn nudge" data-a="reconnect">Reconnect &amp; Upload Remaining</button>'
            : count > 0
              ? `<button type="button" class="pbtn nudge" data-a="upload"${idle ? '' : ' disabled'}>Upload ${count} records now</button>
                 <button type="button" class="pbtn alt" data-a="uploadcut"${idle && count >= 2 ? '' : ' disabled'}>Upload, but cut link halfway</button>`
              : `<button type="button" class="pbtn nudge" data-a="finishdemo">Finish Store Demo &#10003;</button>`
        }`;
    },
  },

  enter: {
    print(ctx) {
      if (!ctx.state.last) sampleSale(ctx.state, { roti: 1, puff: 1 });
      printReceipt(ctx, false);
    },
  },

  actions: {
    add(ctx, sku) {
      const { cart } = ctx.state;
      cart[sku] = (cart[sku] || 0) + 1;
      ctx.render();
    },
    more(ctx, sku) {
      ctx.state.cart[sku] += 1;
      ctx.render();
    },
    less(ctx, sku) {
      const { cart } = ctx.state;
      if (cart[sku] > 1) cart[sku] -= 1;
      else delete cart[sku];
      ctx.render();
    },
    checkout(ctx) {
      ctx.state.done.sale = true;
      ctx.state.tendered = roundToTen(subtotal(ctx.state.cart));
      ctx.go('pay');
      ctx.insight('rounding');
    },
    tender(ctx, sen) {
      ctx.state.tendered = Number(sen);
      ctx.render();
    },
    link(ctx, name) {
      ctx.state.link = name;
      ctx.render();
    },
    confirm(ctx) {
      const s = ctx.state;
      ctx.clearInsight();
      sampleSale(s, Object.keys(s.cart).length ? s.cart : { roti: 1, puff: 1 });
      s.cart = {};
      s.tendered = 0;
      s.done.pay = true;
      ctx.go('print');
    },
    reprint: (ctx) => printReceipt(ctx, false),
    cutprint: (ctx) => printReceipt(ctx, true),
    upload: (ctx) => upload(ctx),
    uploadcut: (ctx) => upload(ctx, 1),
    reconnect(ctx) {
      ctx.state.online = true;
      upload(ctx);
    },
    scanstock(ctx, _, button) {
      const s = ctx.state;
      const line = s.po.find((item) => item.got < item.ordered);
      if (!line) return;
      ctx.clearInsight();
      ctx.lock(button, 'Scanning barcode...');
      ctx.$('[data-scanner]').classList.add('is-scanning');
      ctx.after(700, () => {
        line.got = Math.min(line.ordered, line.got + Math.ceil(line.ordered / 2));
        s.scanned = `${line.code} &rarr; ${line.name}`;
        s.done.receive = true;
        s.busy = false;
        ctx.render();
        ctx.insight('stock');
      });
    },
  },

  show: {
    sale: (ctx) => ctx.go('sale'),
    pay(ctx) {
      if (!Object.keys(ctx.state.cart).length) ctx.state.cart = { roti: 1, puff: 1 };
      ctx.state.tendered = roundToTen(subtotal(ctx.state.cart));
      ctx.go('pay');
      ctx.insight('rounding');
    },
    print(ctx) {
      const s = ctx.state;
      if (!s.last) sampleSale(s, { roti: 1, puff: 1 });
      ctx.go('print');
    },
    receive: (ctx) => ctx.go('receive'),
    sync: (ctx) => ctx.go('sync'),
    rounding(ctx) {
      ctx.state.cart = { roti: 1, puff: 1 };
      ctx.state.tendered = 240;
      ctx.go('pay');
      ctx.insight('rounding');
    },
    printing(ctx) {
      const s = ctx.state;
      if (!s.last) sampleSale(s, { roti: 1, puff: 1 });
      ctx.go('print');
    },
    stock: (ctx) => ctx.go('receive'),
  },

  insights: {
    rounding: {
      title: 'How I built it: BigDecimal Rounding (ROUND_HALF_UP to 0.10)',
      body(s) {
        const sub = subtotal(s.cart);
        const total = roundToTen(sub);
        const float = floatTotal(s.cart);
        const proof =
          sub && Math.round(float * 100) !== total
            ? `Live basket proof: adding these prices in IEEE 754 floating-point rounds to <b>RM ${float.toFixed(2)}</b>. My BigDecimal engine rounds RM ${rm(sub)} half-up to <b>RM ${rm(total)}</b>.`
            : 'Roti canai (1.20) + Curry puff (1.15) = RM 2.35: floating-point math rounds that down to RM 2.30, whereas BigDecimal HALF_UP rounds to RM 2.40.';
        return `<p>Built the canteen checkout calculation using exact <code>BigDecimal</code> arithmetic with <code>ROUND_HALF_UP</code> to the nearest 0.10 sen, eliminating floating-point checkout discrepancies between the POS and accounting.</p>
          <p class="coach__proof">${proof}</p>`;
      },
    },
    printing: {
      title: 'How I built it: Unified 4-Link ESC/POS Print Subsystem',
      body: '<p>Architected a single receipt printing abstraction supporting Bluetooth Classic (SPP), BLE, Network (TCP/IP), and USB OTG thermal printers, so the checkout module prints identically over any hardware connection.</p>',
    },
    recovery: {
      title: 'How I built it: Automatic Socket Recovery & Receipt Reprinting',
      points: ['printing'],
      body: '<p>When a Bluetooth or network socket drops mid-print, the print subsystem detects the broken stream, automatically re-establishes the socket connection, and reprints the buffered receipt without losing the transaction.</p>',
    },
    stock: {
      title: 'How I built it: Barcode-Assisted Stock Receive & Multi-Status POs',
      body: '<p>Integrated ZXing barcode scanning with Purchase Order receiving and stock counts. Each scan matches the item SKU and transitions line states automatically (Pending &rarr; Partial &rarr; Complete).</p>',
    },
    sync: {
      title: 'How I built it: Offline-First Batch Sync with State Tracking',
      body: '<p>Every transaction is persisted to local SQLite first. The batch sync engine tracks per-record state and only marks records synced after the server acknowledges their IDs.</p>',
    },
    synccut: {
      title: 'How I built it: Fault Tolerance During Network Interruptions',
      points: ['sync'],
      body: '<p>When the connection dropped mid-batch, unacknowledged records stayed safely in the local SQLite queue, preventing partial reads or data corruption. Reconnecting resumes cleanly without duplicates.</p>',
    },
  },
};
