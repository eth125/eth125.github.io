// Light/dark theme. A saved choice is restored by the inline script in index.html before first paint;
// this module wires up the header toggle and keeps the browser's theme-color in step.

const STORAGE_KEY = 'theme';
const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

const systemTheme = () => (systemDark.matches ? 'dark' : 'light');
const activeTheme = () => root.dataset.theme || systemTheme();

function remember(theme) {
  try {
    if (theme) localStorage.setItem(STORAGE_KEY, theme);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode). The choice then lasts for this visit only.
  }
}

export function initTheme() {
  const button = document.getElementById('themeToggle');
  if (!button) return;

  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const defaults = metas.map((meta) => meta.content);

  const sync = () => {
    const other = activeTheme() === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${other} theme`);
    button.title = `Switch to ${other} theme`;

    // An explicit choice overrides both media-scoped theme-color tags; otherwise they keep their defaults.
    const chosen = root.dataset.theme ? getComputedStyle(root).getPropertyValue('--bg').trim() : '';
    metas.forEach((meta, i) => {
      meta.content = chosen || defaults[i];
    });
  };

  button.addEventListener('click', () => {
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    // Picking what the system already asks for clears the override, so the site follows the system again.
    if (next === systemTheme()) {
      delete root.dataset.theme;
      remember(null);
    } else {
      root.dataset.theme = next;
      remember(next);
    }
    sync();
  });

  systemDark.addEventListener('change', sync);
  sync();
}
