import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { initContact } from './contact.js';
import { initSims } from './sim/index.js';

// Module scripts run after the document is parsed, so every element is already in place.
initTheme();
initNav();
initContact();
initSims();
