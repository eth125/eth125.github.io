// Runs one interactive demo:
// 1. The simulated phone/console device (.sim)
// 2. The step-by-step "How to use the app" guide (.guide-card) and step pills (.step-pills)
// 3. The transient "How I worked on it (CV Highlight)" card (.cv-card) that appears ONLY when a CV
//    feature is triggered and disappears automatically as soon as the user clicks the next step!
// 4. The end-of-demo prompt (.done-card & in-phone screen) asking if the user wants to try another demo,
//    which scrolls back up to the 5 phone emulators on the main page when they press Yes.

import { hhmm } from './ui.js';

function chrome(app) {
  const bar =
    app.frame === 'console'
      ? `<div class="sim__titlebar"><i></i><i></i><i></i><span>${app.name}</span></div>`
      : `<div class="sim__status">
          <span class="sim__time"></span>
          <span class="sim__status-right">
            ${
              app.offline
                ? '<span class="sim__queue" title="Records waiting to sync" hidden>0</span><button type="button" class="sim__net" data-a="net">LTE</button>'
                : '<span>LTE</span>'
            }
            <span>87%</span>
          </span>
        </div>`;
  return `${bar}
    <div class="sim__screen" role="region" tabindex="-1"></div>
    <div class="sim__toast" hidden></div>`;
}

function defaultCompleteScreen(app) {
  return `<div class="sim__done">
    <div class="sim__done-badge" aria-hidden="true">&#10003;</div>
    <h3>${app.name} Complete!</h3>
    <p class="sub">You've walked through this app's workflow and CV highlights. Do you want to try another demo?</p>
    <button type="button" class="pbtn nudge" data-a="otherapp">Yes, try another demo &uarr;</button>
    <button type="button" class="pbtn alt" data-a="restartdemo">Replay this demo</button>
  </div>`;
}

export function mountSim(project, app, onSelectOtherApp, onMarkCompleted) {
  const sim = project.querySelector('.sim');
  if (!sim) return null;

  sim.dataset.app = app.id;
  sim.classList.toggle('sim--console', app.frame === 'console');
  sim.innerHTML = chrome(app);
  const screen = sim.querySelector('.sim__screen');
  const toastEl = sim.querySelector('.sim__toast');
  const clock = sim.querySelector('.sim__time');
  const queueBadge = sim.querySelector('.sim__queue');
  const network = sim.querySelector('.sim__net');

  // Step pills bar
  const pillsWrap = project.querySelector('.step-pills');
  // "How to use the app" card
  const guideStep = project.querySelector('.guide__step');
  const guideTitle = project.querySelector('.guide__title');
  const guideBody = project.querySelector('.guide__body');
  // Transient "How I worked on it (CV Highlight)" card — hidden until triggered, disappears on next step
  const cvCard = project.querySelector('.cv-card');
  const cvTitle = project.querySelector('.cv-card__title');
  const cvBody = project.querySelector('.cv-card__body');
  // Completion prompt card ("Want to try another demo?")
  const doneCard = project.querySelector('.done-card');

  let state = app.state();
  const timers = new Set();
  let refocus = null;
  let keepFocus = false;
  let toastTimer = 0;

  // Build step pills if app defines steps
  const stepButtons = new Map();
  if (pillsWrap && Array.isArray(app.steps)) {
    pillsWrap.innerHTML = app.steps
      .map(
        (st) =>
          `<button type="button" class="step-pill" data-step="${st.id}">${st.label}</button>`,
      )
      .join('');
    for (const btn of pillsWrap.querySelectorAll('[data-step]')) {
      const stepId = btn.dataset.step;
      stepButtons.set(stepId, btn);
      btn.addEventListener('click', () => {
        stop();
        clearInsight();
        state.busy = false;
        state.completed = false;
        if (doneCard) doneCard.hidden = true;
        if (app.show?.[stepId]) {
          app.show[stepId](ctx);
        } else if (app.screens[stepId]) {
          ctx.go(stepId);
        }
      });
    }
  }

  function stop() {
    for (const id of timers) {
      clearTimeout(id);
      clearInterval(id);
    }
    timers.clear();
  }

  function clearInsight() {
    if (cvCard) {
      cvCard.hidden = true;
      cvCard.classList.remove('is-fresh');
    }
  }

  function resetDemo() {
    stop();
    clearInsight();
    if (doneCard) doneCard.hidden = true;
    state = app.state();
    ctx.state = state;
    render();
    app.enter?.[state.screen]?.(ctx);
  }

  function completeDemo() {
    stop();
    clearInsight();
    state.busy = false;
    state.completed = true;
    state.screen = 'complete';
    if (doneCard) doneCard.hidden = false;
    onMarkCompleted?.(app.id);
    render();
  }

  const ctx = {
    state,
    render,
    insight,
    clearInsight,
    complete: completeDemo,
    reset: resetDemo,
    go(name) {
      stop();
      clearInsight();
      state.busy = false;
      state.completed = name === 'complete';
      if (doneCard) doneCard.hidden = !state.completed;
      state.screen = name;
      render();
      app.enter?.[name]?.(ctx);
    },
    after(ms, fn) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    },
    every(ms, fn) {
      const id = setInterval(fn, ms);
      timers.add(id);
      return id;
    },
    cancel(id) {
      clearTimeout(id);
      clearInterval(id);
      timers.delete(id);
    },
    run(steps) {
      let at = 0;
      for (const [delay, fn] of steps) {
        at += delay;
        ctx.after(at, fn);
      }
    },
    lock(button, text) {
      state.busy = true;
      if (button) {
        button.disabled = true;
        button.classList.remove('nudge');
        if (text) button.textContent = text;
      }
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.hidden = true;
      }, 2200);
    },
    $: (selector) => screen.querySelector(selector),
    $$: (selector) => [...screen.querySelectorAll(selector)],
  };

  function updateGuide() {
    if (!app.guide) return;
    const g = app.guide(state);
    if (!g) return;
    if (guideStep) guideStep.textContent = `Step ${g.step} of ${g.total} · How to use the app`;
    if (guideTitle) guideTitle.textContent = g.title;
    if (guideBody) guideBody.textContent = g.body;

    if (Array.isArray(app.steps)) {
      app.steps.forEach((st, idx) => {
        const btn = stepButtons.get(st.id);
        if (!btn) return;
        const isCurrent = !state.completed && idx + 1 === g.step;
        const isDone = Boolean(state.done?.[st.id]) || state.completed || idx + 1 < g.step;
        btn.classList.toggle('is-current', isCurrent);
        btn.classList.toggle('is-done', isDone && !isCurrent);
      });
    }
  }

  function render() {
    const renderer = app.screens[state.screen];
    screen.innerHTML = renderer ? renderer(state) : defaultCompleteScreen(app);
    screen.scrollTop = 0;
    screen.setAttribute('aria-label', app.titles?.[state.screen] ?? app.name);

    if (network) {
      const waiting = app.pending?.(state) ?? 0;
      queueBadge.textContent = waiting;
      queueBadge.hidden = waiting === 0;
      network.textContent = state.online ? 'LTE' : 'Offline';
      network.classList.toggle('off', !state.online);
      network.setAttribute(
        'aria-label',
        state.online ? 'Network: LTE. Go offline' : 'Network: offline. Reconnect',
      );
    }

    updateGuide();
    restoreFocus();
  }

  function restoreFocus() {
    const lost = !document.activeElement || document.activeElement === document.body;
    if (keepFocus && lost) {
      const target = (refocus && screen.querySelector(refocus)) || screen;
      target.focus({ preventScroll: true });
    }
    refocus = null;
    keepFocus = false;
  }

  function insight(id) {
    const def = app.insights[id];
    if (!def) return;
    const body = typeof def.body === 'function' ? def.body(state) : def.body;

    if (cvCard && cvTitle && cvBody) {
      cvTitle.textContent = def.title;
      cvBody.innerHTML = body;
      cvCard.hidden = false;
      cvCard.classList.remove('is-fresh');
      void cvCard.offsetWidth;
      cvCard.classList.add('is-fresh');
    }
  }

  // Wire up companion panel buttons (Reset, Try another app, Replay)
  for (const btn of project.querySelectorAll('[data-companion-action]')) {
    btn.addEventListener('click', () => {
      const act = btn.dataset.companionAction;
      if (act === 'other-app') onSelectOtherApp?.();
      else if (act === 'replay') resetDemo();
      else if (act === 'dismiss-cv') clearInsight();
    });
  }

  sim.addEventListener('click', (event) => {
    const control = event.target.closest('[data-a]');
    if (!control || control.disabled) return;

    const { a: action, v: value } = control.dataset;
    keepFocus = true;
    refocus = value === undefined ? `[data-a="${action}"]` : `[data-a="${action}"][data-v="${value}"]`;

    if (action === 'go') {
      ctx.go(value);
    } else if (action === 'finishdemo') {
      completeDemo();
    } else if (action === 'otherapp') {
      onSelectOtherApp?.();
    } else if (action === 'restartdemo') {
      resetDemo();
    } else if (action === 'net') {
      state.online = !state.online;
      render();
    } else if (!state.busy && Object.hasOwn(app.actions, action)) {
      app.actions[action](ctx, value, control);
    }
  });

  if (clock) {
    const tick = () => {
      clock.textContent = hhmm();
    };
    tick();
    setInterval(tick, 30_000);
  }

  render();
  app.enter?.[state.screen]?.(ctx);

  return {
    reset: resetDemo,
    clearInsight,
  };
}
