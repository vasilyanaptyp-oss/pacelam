// Hero scene, desktop only: landing.js loads GSAP (self-hosted) and this file when the device can afford it.
// One truck drives a loop through the Baltics, slows down and stops at three cargos on the way; each stop pops
// a feed card, an amber trail follows the truck. Transforms and stroke offsets only — no filters, no layout.
(function () {
  if (!window.gsap || !window.MotionPathPlugin || !window.DrawSVGPlugin) return;
  const scene = document.querySelector('.scene');
  const svg = scene && scene.querySelector('.map');
  if (!svg) return;
  gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin);
  scene.classList.add('scene--gsap');

  const tour = svg.querySelector('.tour');
  const halo = svg.querySelector('.tour-halo');
  const done = svg.querySelector('.tour-done');
  const truck = svg.querySelector('.truck');
  const cities = svg.querySelectorAll('.city');
  const roads = svg.querySelectorAll('.map__faint path');
  const pickups = [...svg.querySelectorAll('.pickup')];
  const cards = [...scene.querySelectorAll('.mock')];

  // Waypoints (SVG units): Daugavpils → cargo → Rīga → Jelgava → Šiauliai → cargo → Kaunas → Vilnius → cargo → Daugavpils
  const W = [[354, 413], [300, 332], [224, 305], [203, 335], [181, 407], [192, 458], [213, 510], [287, 531], [334, 476], [354, 413]];
  const STOPS = [1, 5, 8]; // waypoint index of each cargo pickup
  const raw = MotionPathPlugin.arrayToRawPath(W.map(([x, y]) => ({ x, y })), { curviness: 1.1 });
  const d = MotionPathPlugin.rawPathToString(raw);
  tour.setAttribute('d', d);
  halo.setAttribute('d', d);
  done.setAttribute('d', d);
  MotionPathPlugin.cacheRawPathMeasurements(raw);
  // exact progress of a waypoint along the smoothed path (nearest of 800 samples)
  const progressAt = ([x, y]) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i <= 800; i++) {
      const q = MotionPathPlugin.getPositionOnPath(raw, i / 800);
      const dd = Math.hypot(q.x - x, q.y - y);
      if (dd < bd) { bd = dd; best = i / 800; }
    }
    return best;
  };
  const stops = [0, ...STOPS.map((i) => progressAt(W[i])), 1];

  gsap.set(cards, { visibility: 'hidden', scale: 0.92, y: 14, transformOrigin: '50% 100%' });
  gsap.set(pickups.map((p) => p.querySelector('.pickup__label')), { autoAlpha: 0 });
  gsap.set(truck, { autoAlpha: 0 });

  // trail: thin line = everything driven so far, bright stroke + glow = comet tail behind the truck
  const state = { p: 0 };
  const TAIL = 0.11;
  const draw = () => {
    const p = state.p;
    gsap.set(done, { drawSVG: `0% ${p * 100}%` });
    gsap.set([tour, halo], { drawSVG: `${Math.max(0, p - TAIL) * 100}% ${p * 100}%` });
  };
  draw();

  const reset = () => {
    state.p = 0; draw();
    pickups.forEach((p) => {
      gsap.set(p.querySelector('.pickup__box'), { scale: 1, transformOrigin: '50% 50%' });
      gsap.set(p.querySelector('.pickup__pulse'), { scale: 1, opacity: 1, transformOrigin: '50% 50%' });
      gsap.set(p.querySelector('.pickup__label'), { autoAlpha: 0, y: 0 });
    });
  };
  const pickup = (i) => {
    const p = pickups[i];
    if (!p) return;
    gsap.to(p.querySelector('.pickup__box'), { scale: 0, duration: 0.35, ease: 'back.in(2)', transformOrigin: '50% 50%' });
    gsap.to(p.querySelector('.pickup__pulse'), { scale: 2.2, opacity: 0, duration: 0.6, ease: 'power2.out', transformOrigin: '50% 50%' });
    gsap.fromTo(p.querySelector('.pickup__label'), { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: -12, duration: 0.5, ease: 'power2.out' });
    gsap.to(p.querySelector('.pickup__label'), { autoAlpha: 0, y: -22, duration: 0.5, ease: 'power1.in', delay: 2.4 });
    // the truck "takes" the cargo: a small bump
    gsap.fromTo(truck, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut', transformOrigin: '50% 50%' });
    const card = cards[i];
    if (card) {
      // scale and position only, never opacity: the card's contrast must not dip mid-animation
      gsap.fromTo(card, { visibility: 'visible', scale: 0.92, y: 14 }, { scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' });
      gsap.to(card, { scale: 0.94, y: -8, duration: 0.3, ease: 'power1.in', delay: 4.4, onComplete: () => gsap.set(card, { visibility: 'hidden' }) });
    }
  };

  // the drive: four legs at ~constant pace, easing into and out of every stop
  const DRIVE = 26, PAUSE = 1.1;
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2, onRepeat: reset });
  tl.to(truck, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0);
  let t = 0;
  for (let s = 0; s < stops.length - 1; s++) {
    const a = stops[s], b = stops[s + 1];
    const dur = (b - a) * DRIVE;
    tl.to(truck, { motionPath: { path: tour, align: tour, alignOrigin: [0.5, 0.5], autoRotate: true, start: a, end: b }, duration: dur, ease: 'power1.inOut' }, t)
      .fromTo(state, { p: a }, { p: b, duration: dur, ease: 'power1.inOut', onUpdate: draw }, t);
    t += dur;
    if (s < stops.length - 2) { tl.call(pickup, [s], t); t += PAUSE; }
  }
  tl.to(truck, { autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, t - 0.5);

  // intro: cities, then the faint road network, then the cargos, then the truck sets off
  const intro = gsap.timeline({ onComplete: () => tl.play(0) });
  intro.from(cities, { autoAlpha: 0, stagger: 0.04, duration: 0.45, ease: 'power2.out' }, 0.1)
    .from(roads, { autoAlpha: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out' }, 0.4)
    .from(pickups, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%', stagger: 0.12, duration: 0.5, ease: 'back.out(2)' }, 0.9);

  // gentle tilt after the pointer: decorative, springy, only with a real mouse
  const hero = document.querySelector('.hero');
  if (hero && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    gsap.set(scene, { transformPerspective: 1400 });
    const rx = gsap.quickTo(scene, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(scene, 'rotationY', { duration: 0.8, ease: 'power3' });
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 7);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 5);
    });
    hero.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) tl.pause(); else if (intro.progress() === 1) tl.play(); });
})();
