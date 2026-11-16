// Header navigation: the small-screen menu, and a scroll-spy that highlights the section being read.

export function initNav() {
  const nav = document.querySelector('.site-nav');
  const toggle = nav?.querySelector('.site-nav__toggle');
  const list = nav?.querySelector('.site-nav__list');
  if (!nav || !toggle || !list) return;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    list.classList.toggle('is-open', open);
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  list.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (isOpen() && !nav.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  spyOnSections([...list.querySelectorAll('a[href^="#"]')]);
}

function spyOnSections(links) {
  if (!('IntersectionObserver' in window)) return;

  const linkFor = new Map();
  for (const link of links) {
    const section = document.getElementById(link.hash.slice(1));
    if (section) linkFor.set(section, link);
  }
  const sections = [...linkFor.keys()];
  if (!sections.length) return;

  const touching = new Set(); // sections crossing the detector band
  let pinned = null; // the section whose link was just clicked
  let settled = true; // false while that click's smooth scroll is still running
  let settleTimer = 0;
  let currentLink = null;

  const atBottom = () =>
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

  const update = () => {
    // A clicked link wins until the visitor scrolls again. Otherwise the last section owns the very
    // bottom of the page (it may be too short to reach the band); everywhere else, the band decides.
    const section =
      pinned ||
      (atBottom() ? sections[sections.length - 1] : sections.filter((s) => touching.has(s)).pop());
    const link = section ? linkFor.get(section) : null;
    if (link === currentLink) return;
    currentLink?.removeAttribute('aria-current');
    link?.setAttribute('aria-current', 'location');
    currentLink = link;
  };

  // The detector is a thin band just above the middle of the viewport.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) touching.add(entry.target);
        else touching.delete(entry.target);
      }
      update();
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((section) => observer.observe(section));

  for (const [section, link] of linkFor) {
    link.addEventListener('click', () => {
      pinned = section;
      settled = false;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        settled = true;
      }, 1200);
      update();
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      if (pinned && settled) pinned = null;
      update();
    },
    { passive: true },
  );
}
