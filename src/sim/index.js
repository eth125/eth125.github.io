// Mounts the interactive demos and wires up the 5-phone showcase on the main page
// to switch and scroll to the single focused demo stage below.

import { mountSim } from './core.js';
import gate from './apps/gate.js';
import netpay from './apps/netpay.js';
import payroll from './apps/payroll.js';
import store from './apps/store.js';
import webapi from './apps/webapi.js';

const APPS = { store, netpay, gate, payroll, webapi };

export function initSims() {
  const showcase = document.getElementById('projects');
  const stage = document.getElementById('demo-stage');
  const emuCards = [...document.querySelectorAll('[data-select-app]')];
  const projects = new Map();
  const controllers = new Map();
  const completedApps = new Set();

  function scrollToShowcase() {
    if (showcase) {
      showcase.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Focus the first uncompleted emulator card, or the first card
    const nextCard =
      emuCards.find((card) => !completedApps.has(card.dataset.selectApp)) || emuCards[0];
    if (nextCard) {
      setTimeout(() => nextCard.focus({ preventScroll: true }), 450);
    }
  }

  function markCompleted(appId) {
    completedApps.add(appId);
    for (const card of emuCards) {
      if (card.dataset.selectApp === appId) {
        card.classList.add('is-completed');
      }
    }
  }

  function selectApp(appId, scroll = true) {
    for (const [id, article] of projects) {
      const active = id === appId;
      article.hidden = !active;
      article.classList.toggle('is-active', active);
    }
    for (const card of emuCards) {
      const active = card.dataset.selectApp === appId;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));
    }
    if (scroll && stage) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  for (const project of document.querySelectorAll('.project[data-app]')) {
    const id = project.dataset.app;
    const app = APPS[id];
    if (!app) continue;
    projects.set(id, project);
    const ctrl = mountSim(project, app, scrollToShowcase, markCompleted);
    if (ctrl) controllers.set(id, ctrl);
  }

  for (const card of emuCards) {
    card.addEventListener('click', () => {
      const id = card.dataset.selectApp;
      if (projects.has(id)) {
        selectApp(id, true);
      }
    });
  }

  // Default focused app on load (without scrolling)
  if (projects.size) {
    selectApp('store', false);
  }
}
