// Sticky header: solid background once scrolled, a sliding indicator under
// the section in view (scroll spy), and the mobile menu.
import { $, $$, reducedMotion } from './ui.js';

export function initNav() {
  const header = $('#site-header');
  const nav = $('#primary-nav');
  const indicator = $('.nav-indicator', nav);
  const toggle = $('#menu-toggle');
  const links = $$('[data-nav]');
  let current = 'home';

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function moveIndicator() {
    const active = $(`.primary-nav a[data-nav="${current}"]`);
    const visible = active && active.offsetParent && getComputedStyle(active.parentElement).display !== 'none';
    if (!visible || window.matchMedia('(max-width: 900px)').matches) {
      indicator.style.opacity = '0';
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    indicator.style.opacity = '1';
    indicator.style.width = `${box.width}px`;
    indicator.style.transform = `translateX(${box.left - navBox.left}px)`;
  }

  function setActive(id) {
    current = id;
    links.forEach((a) => {
      if (a.dataset.nav === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    moveIndicator();
  }

  // A section is "current" when it crosses the band just below the header.
  // data-section names the nav item a section belongs to (defaults to its id).
  const sections = $$('[data-section]');
  const visible = new Map();
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target, e.isIntersecting));
    const firstVisible = sections.find((s) => visible.get(s));
    if (firstVisible) setActive(firstVisible.dataset.section || firstVisible.id);
  }, { rootMargin: '-35% 0px -60% 0px' });
  sections.forEach((s) => spy.observe(s));

  window.addEventListener('resize', moveIndicator);
  document.fonts?.ready.then(moveIndicator);
  setActive('home');

  // Mobile menu
  const setOpen = (open) => {
    document.documentElement.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
}

// Parallax backgrounds and reveal-on-scroll. Both switch off for visitors
// who ask for reduced motion.
export function initEffects() {
  const reveals = $$('[data-reveal]');
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  if (reducedMotion()) return;
  const layers = $$('[data-parallax]');
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    for (const layer of layers) {
      const host = layer.parentElement;
      const r = host.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const offset = (r.top + r.height / 2 - vh / 2) * -Number(layer.dataset.parallax);
      layer.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    }
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}
