/* ============================================================
   BV — site engine. One clock, one ease, one motion grammar.
   Ported from the davidalaba.com engine (ilja-van-eck), vanilla JS.
   ============================================================ */
gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin, CustomEase, SplitText, Flip);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let isMobile = window.innerWidth < 550;
let isMobileLandscape = window.innerWidth < 768;
let isTablet = window.innerWidth < 992;
let ranHomeLoader = false;   // in-memory only: every full reload replays the intro, in-app navigation does not

CustomEase.create('main', '0.65, 0.01, 0.05, 0.99');
CustomEase.create('load', '0.7, 0, 0.2, 1');
gsap.defaults({ ease: 'main', duration: 0.65 });

/* ---------- Lenis fused to GSAP's ticker (the anti-jank fix) ---------- */
let lenis;
function makeLenis() {
  lenis = new Lenis({ duration: 1.25, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.on('scroll', ScrollTrigger.update);
  window.__lenis = lenis;
  return lenis;
}
gsap.ticker.add(t => { if (lenis) lenis.raf(t * 1000); });
gsap.ticker.lagSmoothing(0);

/* ---------- helpers ---------- */
function debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }
const q = (root, sel) => Array.from((root || document).querySelectorAll(sel));

/* ---------- SplitText ---------- */
let splits = [];
function runSplit(next) {
  next = next || document;
  splits.forEach(s => s.revert()); splits = [];
  const lineTargets = q(next, '[data-anim="lines"]');
  if (lineTargets.length) splits.push(new SplitText(lineTargets, { type: 'lines, words', linesClass: 'line', wordsClass: 'word' }));
  const letterTargets = q(next, '[data-anim="letters"]');
  if (letterTargets.length) splits.push(new SplitText(letterTargets, { type: 'lines, words, chars', reduceWhiteSpace: false, charsClass: 'char', wordsClass: 'word', linesClass: 'line' }));
  const charTargets = q(next, '[data-split="letters"]');
  if (charTargets.length) splits.push(new SplitText(charTargets, { type: 'chars', reduceWhiteSpace: false, charsClass: 'char' }));
}

/* ---------- Typography: letters rise with a 3D tilt; lines rise word by word ---------- */
function initTypographyAnimations(next) {
  q(next, '[data-anim="letters"]').forEach(target => {
    q(target, '.word').forEach(word => {
      const letters = q(word, '.char');
      gsap.set(letters, { yPercent: 100, rotateY: 45, rotateX: -30, autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: word, start: 'top bottom',
        onEnter: () => gsap.fromTo(letters,
          { yPercent: 100, rotateY: 45, rotateX: -30, autoAlpha: 0 },
          { yPercent: 0, rotateY: 0, rotateX: 0, autoAlpha: 1, duration: 0.8, delay: 0.1, stagger: 0.015, overwrite: true, immediateRender: true }),
        onLeaveBack: () => gsap.to(letters, { yPercent: 100, rotateY: 45, rotateX: -30, autoAlpha: 0, duration: 0.1, immediateRender: false })
      });
    });
  });
  q(next, '[data-anim="lines"]').forEach(target => {
    const lines = q(target, '.line');
    lines.forEach((line, i) => {
      const words = q(line, '.word');
      gsap.set(words, { yPercent: 120 });
      ScrollTrigger.create({
        trigger: lines[0], start: 'top 95%', once: true,
        onEnter: () => gsap.fromTo(words, { yPercent: 120 }, { yPercent: 0, duration: 1.5, delay: i * 0.03, stagger: 0.015, overwrite: true, immediateRender: true })
      });
    });
  });
}

/* ---------- Image wipes: cover scales away, image settles from 1.2 -> 1 ---------- */
function initImageWipes(next) {
  q(next, '[data-wipe="wrap"]').forEach(trigger => {
    const content = trigger.querySelector('[data-wipe="content"]');
    const cover = trigger.querySelector('[data-wipe="cover"]');
    if (!cover) return;
    gsap.set(cover, { scaleY: 1 });
    ScrollTrigger.create({
      trigger, start: 'top bottom', once: true,
      onEnter: () => {
        gsap.fromTo(cover, { scaleY: 1 }, { scaleY: 0, duration: 1.2, delay: 0.2 });
        if (content) gsap.fromTo(content, { scale: 1.2 }, { scale: 1, duration: 1.4, delay: 0.2 });
      }
    });
  });
}

/* ---------- Parallax: section backgrounds + inline images, scrubbed 1:1 ---------- */
function initSectionParallax(next) {
  q(next, '[data-parallax-section]').forEach(section => {
    const bg = section.querySelector('[data-parallax-bg]');
    if (!bg) return;
    const diff = bg.offsetHeight - section.offsetHeight;
    gsap.fromTo(bg, { y: -diff }, { y: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}
function initParallaxImages(next) {
  q(next, '.parallax-img').forEach(target => {
    const parent = target.parentElement;
    const diff = target.offsetHeight - parent.offsetHeight;
    if (diff <= 0) return;
    gsap.fromTo(target, { y: -diff }, { y: 0, ease: 'none', scrollTrigger: { trigger: parent, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ---------- Footer: the name letters slide in from alternating sides ---------- */
function initFooterReveal(next) {
  const footer = next.querySelector('.footer');
  const logo = next.querySelector('.footer-logo');
  if (!footer || !logo) return;
  const letters = q(logo, '.char');
  const last = footer.previousElementSibling || footer;
  gsap.set(letters, { yPercent: gsap.utils.wrap([-110, 110]) });
  ScrollTrigger.create({
    trigger: last, start: 'bottom 55%',
    onEnter: () => gsap.fromTo(letters, { yPercent: gsap.utils.wrap([-110, 110]) }, { yPercent: 0, duration: 0.8, stagger: 0.025, overwrite: true }),
    onLeaveBack: () => gsap.to(letters, { yPercent: gsap.utils.wrap([-100, 100]), duration: 0.1 })
  });
}

/* ---------- Copy email ---------- */
function initCopyEmail(next) {
  q(next, '[data-copy-email]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const email = el.getAttribute('data-copy-email');
      navigator.clipboard && navigator.clipboard.writeText(email);
      const label = el.querySelector('[data-copy-label]') || el;
      const orig = label.textContent;
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = orig; }, 1600);
    });
  });
}

/* ---------- Nav: menu, active link, scroll state ---------- */
function initNav() {
  const nav = document.querySelector('.nav');
  const btn = nav.querySelector('.menu-btn');
  const menu = document.querySelector('.menu');
  btn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', open);
    if (open) { lenis.stop(); gsap.fromTo(q(menu, '.menu-link'), { yPercent: 110 }, { yPercent: 0, stagger: 0.06, delay: 0.15 }); }
    else lenis.start();
  });
  q(menu, 'a').forEach(a => a.addEventListener('click', () => { if (document.body.classList.contains('menu-open')) btn.click(); }));
  ScrollTrigger.create({ start: 80, onEnter: () => nav.classList.add('is-scrolled'), onLeaveBack: () => nav.classList.remove('is-scrolled') });
}
function markActiveNav(ns) {
  q(document, '[data-nav]').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-nav') === ns));
}

/* ---------- Standard page load (every page except the first home visit) ---------- */
function initPageLoad(next) {
  ranHomeLoader = true;
  const hero = next.querySelector('.page-hero');
  if (!hero) return;
  const lines = q(hero, '[data-load="line"]');
  const words = q(hero, '[data-load="title"] .word');
  const fades = q(hero, '[data-load="fade"]');
  const vid = hero.querySelector('video');
  if (vid) vid.load();
  const tl = gsap.timeline({ defaults: { duration: 0.8 } });
  if (lines.length) tl.from(lines, { scaleX: 0, stagger: 0.1 }, 0.4);
  if (words.length) tl.from(words, { yPercent: 120, stagger: 0.06 }, '<');
  if (fades.length) tl.from(fades, { autoAlpha: 0, yPercent: 50, duration: 1 }, 0.5);
}

/* ============================================================
   HOME
   ============================================================ */
function initHomeLoader(next) {
  const wrap = document.querySelector('.load-w');
  const frame = wrap.querySelector('.load-frame');
  const slides = q(wrap, '.load-slide');
  const nameEl = wrap.querySelector('.load-name');
  const tag = wrap.querySelector('.load-tag');
  const bar = wrap.querySelector('.load-bar');
  const navLogo = document.querySelector('.nav-logo');
  const hero = next.querySelector('.home-hero');
  const heroWords = q(hero, '.hero-title .word');
  const eyebrow = hero.querySelector('.hero-eyebrow');
  const nameSplit = new SplitText(nameEl, { type: 'chars', charsClass: 'char' });
  const tagSplit = new SplitText(tag, { type: 'lines', linesClass: 'line' });
  const vid = hero.querySelector('video');

  lenis.stop();
  window.scrollTo(0, 0);
  gsap.set(heroWords, { yPercent: 120 });
  gsap.set(eyebrow, { autoAlpha: 0 });

  const tl = gsap.timeline({
    paused: true,
    defaults: { duration: 0.75 },
    onComplete: () => {
      ranHomeLoader = true;
      gsap.set(wrap, { display: 'none' });
      lenis.start();
      playHeroWhenReady(vid);
    }
  });
  if (vid) vid.load();   // start buffering now, under the intro
  const last = slides[slides.length - 1];
  tl.set([frame, bar], { autoAlpha: 1 })
    .to(bar, { scaleX: 1, duration: 4.2, ease: 'none' }, 0);
  // the photos slide up one after another, each settling from a slight zoom
  slides.forEach((sl, i) => {
    tl.to(sl, { clipPath: 'inset(0% 0 0 0)', duration: 0.7 }, i === 0 ? 0.15 : '<+=0.62')
      .fromTo(sl.querySelector('img'), { scale: 1.18 }, { scale: 1.02, duration: 0.85 }, '<');
  });
  // boom: the last frame (the portrait) grows to fill the screen
  tl.add(() => wrap.classList.add('is-boom'))
    .to(frame, { width: '100vw', height: '100vh', duration: 0.9, ease: 'load' }, '>-=0.1')
    .to(last.querySelector('img'), { scale: 1.12, duration: 1.2 }, '<')
    // the name rises over the face
    .set([nameEl, tag], { autoAlpha: 1 }, '<+=0.3')
    .from(nameSplit.chars, { yPercent: 120, stagger: 0.03, duration: 0.7 }, '<')
    .from(tagSplit.lines, { yPercent: 100, autoAlpha: 0, duration: 0.6 }, '<+=0.25')
    .to({}, { duration: 0.6 })
    // then everything lifts off to reveal the cutout hero
    .to(nameSplit.chars, { yPercent: -120, duration: 0.5, stagger: { from: 'center', each: 0.015 } })
    .to(tagSplit.lines, { yPercent: -100, autoAlpha: 0, duration: 0.4 }, '<')
    .to(wrap, {
      yPercent: -100, duration: 1, ease: 'load',
      onStart: () => { gsap.fromTo(navLogo, { yPercent: -120 }, { yPercent: 0, duration: 0.8, delay: 0.5 }); }
    }, '<+=0.1')
    .to(bar, { scaleX: 0, duration: 0.5 }, '<')
    .to(heroWords, { yPercent: 0, stagger: 0.06, duration: 0.8 }, '<+=0.35')
    .to(eyebrow, { autoAlpha: 1, duration: 0.8 }, '<+=0.2');
  // don't start until the five photos are actually decoded (or 2.5s, whichever first)
  const decoded = Promise.all(slides.map(sl => { const im = sl.querySelector('img'); return im.decode ? im.decode().catch(() => {}) : Promise.resolve(); }));
  Promise.race([decoded, new Promise(r => setTimeout(r, 2500))]).then(() => tl.play());
}

/* Cutout hero: name knocked out of the cream cover, video plays through the letters,
   cover lifts on scroll and the video settles from 1.25 -> 1. */
function layoutHeroMask() {
  const svg = document.getElementById('heroMask');
  if (!svg) return;
  const l1 = svg.querySelector('#mLine1'), l2 = svg.querySelector('#mLine2');
  const W = Math.round(window.innerWidth), H = Math.round(window.innerHeight);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const fs = Math.min(W * 0.172, H * 0.24);
  [l1, l2].forEach(t => { t.setAttribute('font-size', fs); t.setAttribute('x', W / 2); });
  l1.setAttribute('y', H * 0.36); l2.setAttribute('y', H * 0.36 + fs * 0.92);
}
function initHomeHero(next) {
  const wrap = next.querySelector('.home-hero');
  const sticky = wrap.querySelector('.hero-sticky');
  const cover = wrap.querySelector('.hero-cover');
  const vid = wrap.querySelector('video');
  const controls = wrap.querySelector('.hero-controls');
  layoutHeroMask();
  window.addEventListener('resize', debounce(layoutHeroMask, 120));
  gsap.fromTo(vid, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top top', end: 'bottom bottom', scrub: true } });
  gsap.to(cover, { yPercent: -100, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top top', end: '70% bottom', scrub: true } });
  gsap.timeline({ defaults: { ease: 'none', duration: 1 }, scrollTrigger: { trigger: wrap, start: '25% top', end: 'bottom bottom', scrub: true } })
    .fromTo(controls, { autoAlpha: 0 }, { autoAlpha: 1 }).to(controls, { autoAlpha: 1, duration: 0.6 }).to(controls, { autoAlpha: 0, duration: 0.4 });
  const toggle = wrap.querySelector('[data-sound-toggle]');
  if (toggle) toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('data-sound-toggle') === 'on';
    vid.muted = on; toggle.setAttribute('data-sound-toggle', on ? 'off' : 'on');
    toggle.querySelector('span').textContent = on ? 'Sound off' : 'Sound on';
  });
  if (ranHomeLoader) playHeroWhenReady(vid);
}
/* play only once enough is buffered to run without stalling (or after 1.5s regardless) */
function playHeroWhenReady(vid) {
  if (!vid) return;
  const go = () => { try { vid.play(); } catch (e) {} };
  if (vid.readyState >= 4) return go();
  let done = false;
  const once = () => { if (!done) { done = true; go(); } };
  vid.addEventListener('canplaythrough', once, { once: true });
  setTimeout(once, 1500);
}

/* Home gallery grid rises into place as you scroll */
function initHomeGallery(next) {
  const grid = next.querySelector('.home-grid');
  if (!grid) return;
  gsap.from(q(grid, '.home-grid__item'), { yPercent: 150, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: grid, start: 'top bottom', end: 'center center', scrub: 1 } });
}

/* Rings band: photo drifts, cream fades to black on the way in */
function initRingsBand(next) {
  const band = next.querySelector('.rings-band');
  if (!band) return;
  gsap.fromTo(band.querySelector('.rings-img'), { yPercent: -12, scale: 1.15 }, { yPercent: 8, scale: 1, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* ============================================================
   JOURNEY — pinned rail + rolling year digits
   ============================================================ */
function initJourney(next) {
  const wrap = next.querySelector('.journey-wrap');
  const timeline = next.querySelector('.journey-timeline');
  const yearRows = q(next, '.journey-year__row');
  const steps = q(next, '.journey-step');
  const imageWraps = q(next, '.journey-step');
  const buttons = q(next, '.timeline-button');
  const markEl = next.querySelector('.journey-mark__val');
  const ftEl = next.querySelector('.journey-mark__ft');

  if (!isMobileLandscape) ScrollTrigger.create({ trigger: wrap, start: 'top top', end: 'bottom bottom', pin: timeline, pinSpacing: false });

  {
    steps.forEach((step, stepIndex) => {
      if (stepIndex === 0) return;               // row 0 is the resting state
      yearRows.forEach(row => {
        const chars = q(row, '.char');
        const from = -(stepIndex - 1) * 100;
        const to = -stepIndex * 100;
        const nextYear = gsap.fromTo(chars, { yPercent: from }, { yPercent: to, stagger: 0.05, duration: 0.8, paused: true, immediateRender: false });
        const prevYear = gsap.fromTo(chars, { yPercent: to }, { yPercent: from, stagger: 0.05, duration: 0.8, paused: true, immediateRender: false });
        ScrollTrigger.create({ trigger: step, start: 'top 60%', end: 'top 60%', onEnter: () => nextYear.play(0), onEnterBack: () => prevYear.play(0) });
      });
    });
  }

  q(next, '.journey-info').forEach(info => {
    const items = q(info, '.journey-info__item');
    gsap.set(items, { y: '2rem', autoAlpha: 0 });
    const show = () => gsap.fromTo(items, { y: '2rem', autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.05 });
    const hide = () => gsap.to(items, { y: '2rem', autoAlpha: 0, stagger: 0.05 });
    ScrollTrigger.create({ trigger: info, start: 'top 70%', endTrigger: info.parentElement, end: 'bottom 60%', onEnter: show, onEnterBack: show, onLeave: hide, onLeaveBack: hide });
  });

  const marks = steps.map(s => ({ m: parseFloat(s.dataset.mark || 0), ft: s.dataset.ft || '' }));
  const counter = { v: marks[0].m };
  const render = () => { if (markEl) markEl.textContent = counter.v.toFixed(2); };
  render();
  imageWraps.forEach((w, i) => {
    ScrollTrigger.create({
      trigger: w, start: 'top 70%', end: 'bottom 70%',
      onEnter: () => {
        buttons.forEach(b => b.classList.remove('active')); buttons[i] && buttons[i].classList.add('active');
        if (marks[i].m) { gsap.to(counter, { v: marks[i].m, duration: 0.9, onUpdate: render }); if (ftEl) ftEl.textContent = marks[i].ft; }
      },
      onLeaveBack: () => {
        buttons.forEach(b => b.classList.remove('active')); if (i > 0) buttons[i - 1].classList.add('active');
        const p = marks[Math.max(0, i - 1)]; if (p.m) { gsap.to(counter, { v: p.m, duration: 0.9, onUpdate: render }); if (ftEl) ftEl.textContent = p.ft; }
      }
    });
  });
  buttons.forEach((b, i) => b.addEventListener('click', () => lenis.scrollTo(imageWraps[i], { offset: -18 * 16, duration: 1.2 })));
}

/* ============================================================
   ABOUT — cycling words + trophy wall you flick through
   ============================================================ */
function initAboutHero(next) {
  const hero = next.querySelector('.about-hero');
  if (!hero) return;
  const wraps = q(hero, '[data-about="headline"]');
  const tls = wraps.map(w => {
    const titles = q(w, '[data-about="title"]');
    const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { duration: 1.2, delay: 0.75 } });
    titles.slice(1).forEach((_, i) => tl.to(titles, { yPercent: -100 * (i + 1) }));
    tl.set(titles, { yPercent: 0, delay: 0 });
    return tl;
  });
  const cover = hero.querySelector('.about-cover');
  const imgBox = hero.querySelector('.about-hero__img');
  const img = imgBox.querySelector('img');
  // start with the portrait filling the screen, then let it shrink into place
  imgBox.classList.add('is-full');
  const state = Flip.getState(imgBox);
  imgBox.classList.remove('is-full');
  gsap.set(cover, { clipPath: 'inset(0 0 100% 0)' });
  gsap.timeline({ defaults: { duration: 1.25 }, onComplete: () => tls.forEach(t => t.play()) })
    .add(Flip.from(state, { duration: 1.5, ease: 'load', absolute: true }), 0.35)
    .fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.6 }, 0.35)
    .from(q(hero, '.about-line'), { yPercent: 120, stagger: 0.08 }, 0.9);
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onLeave: () => tls.forEach(t => t.pause()), onEnterBack: () => tls.forEach(t => t.play()) });
}
function initAchHover(next) {
  q(next, '.ach').forEach(card => {
    const im = card.querySelector('.ach-img'); if (!im) return;
    const xTo = gsap.quickTo(im, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(im, 'y', { duration: 0.6, ease: 'power3' });
    card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.12); yTo((e.clientY - r.top - r.height / 2) * 0.12); });
    card.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}
function initAboutDrag(next) {
  const grid = next.querySelector('.achievements-grid');
  if (!grid) return;
  const line = next.querySelector('.progress-line');
  const update = x => { const w = grid.scrollWidth - grid.parentElement.offsetWidth; gsap.set(line, { scaleX: Math.max(Math.abs(x) / w, 0.08) }); };
  Draggable.create(grid, {
    type: 'x', bounds: { minX: -(grid.scrollWidth - grid.parentElement.offsetWidth), maxX: 0 },
    inertia: true, edgeResistance: 0.9, onDrag() { update(this.x); }, onThrowUpdate() { update(this.x); }
  });
  update(0);
  grid.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); } }, { passive: false });
}

/* ============================================================
   GALLERY — load, filters, throwable images with skew, lightbox
   ============================================================ */
function initGalleryLoad(next) {
  const covers = q(next, '.gallery-cover');
  const images = q(next, '.gallery-item .img-cover');
  const notice = next.querySelector('.notice');
  const tl = gsap.timeline({ defaults: { duration: 1 } });
  tl.set(covers, { transformOrigin: 'top center' })
    .to(covers, { scaleY: 0, stagger: 0.03 })
    .from(images, { scale: 1.2, stagger: 0.03 }, '<')
    .set(covers, { transformOrigin: 'bottom center' });
  if (notice) tl.from(notice, { autoAlpha: 0, y: 20 }, '-=0.5');
}
function initDragContainer(next) {
  const container = next.querySelector('[data-drag-container]');
  if (!container || isMobile) return;
  const clampSkew = gsap.utils.clamp(-4, 4);
  q(container, '[data-gallery-item]').forEach(item => {
    const proxy = document.createElement('div');
    const tracker = InertiaPlugin.track(proxy, 'x')[0];
    const skewTo = gsap.quickTo(item, 'skewX');
    const xTo = gsap.quickTo(item, 'x', { duration: 1, ease: 'power3' });
    const yTo = gsap.quickTo(item, 'y', { duration: 1, ease: 'power3' });
    let drag;
    const updateSkew = () => { const vx = tracker.get('x'); skewTo(clampSkew(vx / -50)); if (!vx && !drag.isPressed) gsap.ticker.remove(updateSkew); };
    const align = () => gsap.set(proxy, { x: gsap.getProperty(item, 'x'), y: gsap.getProperty(item, 'y'), width: item.offsetWidth, height: item.offsetHeight, position: 'absolute', pointerEvents: 'none', top: item.offsetTop, left: item.offsetLeft });
    align(); item.parentNode.append(proxy);
    window.addEventListener('resize', align);
    drag = Draggable.create(proxy, {
      type: 'x,y', trigger: item, bounds: container, edgeResistance: 1, inertia: false,
      onPressInit() { align(); xTo.tween && xTo.tween.pause(); yTo.tween && yTo.tween.pause(); gsap.ticker.add(updateSkew); },
      onPress() { item.style.zIndex = 20; },
      onDrag() { xTo(this.x); yTo(this.y); },
      onClick() { openLightbox(item); }
    })[0];
    gsap.fromTo(q(item, '.img-cover'), { yPercent: 0 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}
function initGalleryFilters(next) {
  const filters = q(next, '[data-gallery-filter]');
  const items = q(next, '.gallery-item');
  filters.forEach(f => f.addEventListener('click', () => {
    if (f.classList.contains('is-active')) return;
    filters.forEach(x => x.classList.remove('is-active')); f.classList.add('is-active');
    const key = f.getAttribute('data-gallery-filter');
    items.forEach(item => {
      const cover = item.querySelector('.gallery-cover');
      const show = key === 'all' || item.dataset.cat === key;
      gsap.set(cover, { transformOrigin: 'top center' });
      gsap.to(cover, { scaleY: 1, duration: 0.45, onComplete: () => {
        item.style.display = show ? '' : 'none';
        ScrollTrigger.refresh();
        if (show) { gsap.set(cover, { transformOrigin: 'bottom center' }); gsap.to(cover, { scaleY: 0, duration: 0.5, delay: 0.05 }); gsap.fromTo(item.querySelector('.img-cover'), { scale: 1.2 }, { scale: 1, delay: 0.05 }); }
      } });
    });
  }));
}
let lightbox;
function openLightbox(item) {
  const img = item.querySelector('img');
  if (!img) return;
  if (!lightbox) {
    lightbox = document.createElement('div'); lightbox.className = 'lightbox';
    lightbox.innerHTML = '<button class="lightbox-close" aria-label="Close">Close</button><figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(lightbox);
    const close = () => { gsap.to(lightbox, { autoAlpha: 0, duration: 0.4, onComplete: () => { lightbox.classList.remove('is-open'); lenis.start(); } }); };
    lightbox.querySelector('.lightbox-close').addEventListener('click', close);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && lightbox.classList.contains('is-open')) close(); });
  }
  const big = lightbox.querySelector('img');
  big.src = img.dataset.full || img.currentSrc || img.src; big.alt = img.alt;
  lightbox.querySelector('figcaption').textContent = item.dataset.caption || img.alt || '';
  lightbox.classList.add('is-open'); lenis.stop();
  gsap.fromTo(lightbox, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
  gsap.fromTo(big, { scale: 1.08 }, { scale: 1, duration: 0.9 });
}
function initLightboxClicks(next) {
  q(next, '[data-lightbox]').forEach(item => item.addEventListener('click', () => openLightbox(item)));
}

/* ============================================================
   PRESS — stagger cards
   ============================================================ */
function initPress(next) {
  q(next, '.press-card').forEach(card => {
    ScrollTrigger.create({ trigger: card, start: 'top 92%', once: true, onEnter: () => gsap.fromTo(card, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }) });
  });
}

/* ============================================================
   Counters (records)
   ============================================================ */
function initCounters(next) {
  q(next, '[data-count]').forEach(el => {
    const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    const o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } }) });
  });
}

/* ============================================================
   Orchestration
   ============================================================ */
function initGeneral(next) {
  runSplit(next);
  initCopyEmail(next);
  initTypographyAnimations(next);
  initImageWipes(next);
  initParallaxImages(next);
  initSectionParallax(next);
  initFooterReveal(next);
  initCounters(next);
  initLightboxClicks(next);
  initRingsBand(next);
  q(next, 'a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = next.querySelector(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -80, duration: 1.2 }); }
  }));
}
const views = {
  home(next) { if (!ranHomeLoader && !REDUCED) initHomeLoader(next); else { gsap.set('.load-w', { display: 'none' }); initPageLoad(next); } initHomeHero(next); if (!isMobile) initHomeGallery(next); },
  journey(next) { initPageLoad(next); initJourney(next); },
  about(next) { initAboutHero(next); initAboutDrag(next); initAchHover(next); },
  gallery(next) { initPageLoad(next); initGalleryLoad(next); initDragContainer(next); initGalleryFilters(next); },
  press(next) { initPageLoad(next); initPress(next); },
  road(next) { initPageLoad(next); }
};

function boot(container) {
  const ns = container.getAttribute('data-barba-namespace');
  if (ns !== 'home') ranHomeLoader = true;   // Alaba: once any inner page has loaded, Barba-ing home skips the intro
  markActiveNav(ns);
  initGeneral(container);
  if (views[ns]) views[ns](container);
  gsap.delayedCall(0.3, () => ScrollTrigger.refresh());
  // layout settles late (fonts, lazy images): refresh again when they land
  const refresh = debounce(() => ScrollTrigger.refresh(), 200);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  q(container, 'img').forEach(img => { if (!img.complete) img.addEventListener('load', refresh, { once: true }); });
  window.addEventListener('load', refresh, { once: true });
  gsap.delayedCall(1.5, refresh);
}

initNav();

barba.hooks.leave(() => { if (lenis) lenis.destroy(); });
barba.hooks.enter(data => { data.next.container.classList.add('is-fixed'); });
/* runs on the first load AND after every transition: one place builds the page */
barba.hooks.afterEnter(data => {
  ScrollTrigger.getAll().forEach(t => t.kill());
  const next = data.next.container;
  next.classList.remove('is-fixed');
  if (lenis) lenis.destroy();
  makeLenis();
  if (data.current && data.current.container) lenis.scrollTo(0, { immediate: true, force: true, lock: true });
  boot(next);
});
const startBarba = () => barba.init({
  preventRunning: true,
  timeout: 10000,
  prevent: ({ el }) => el.hasAttribute('data-barba-prevent') || (el.getAttribute('href') || '').startsWith('#'),
  transitions: [{
    name: 'wipe', sync: false,
    once() { if (lenis) lenis.start(); },
    leave(data) {
      const tl = gsap.timeline({ onComplete: () => data.current.container.remove() });
      tl.to('.page-transition', { scaleY: 1, transformOrigin: 'bottom center', duration: 0.55, ease: 'load' })
        .to(data.current.container, { opacity: 0, duration: 0.3 }, '<');
      return tl;
    },
    enter(data) {
      gsap.fromTo(data.next.container, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'load' });
      gsap.to('.page-transition', { scaleY: 0, transformOrigin: 'top center', duration: 0.65, ease: 'load', delay: 0.1, onComplete: () => lenis.start() });
    }
  }]
});
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(startBarba);
