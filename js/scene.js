// Hero scene, desktop only: landing.js loads GSAP (self-hosted) and this file when the device can afford it.
// One truck drives a loop through the Baltics on a drawn road, slows down and stops at three cargos; every
// stop pops a feed card, a box lands on the trailer and the trip counter ticks. Comet trail behind the truck,
// hubs pulse when it passes, the scene tilts after the pointer. Transforms and stroke offsets only — no filters.
(function () {
  if (!window.gsap || !window.MotionPathPlugin || !window.DrawSVGPlugin) return;
  const scene = document.querySelector('.scene');
  const svg = scene && scene.querySelector('.map');
  if (!svg) return;
  gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin);
  scene.classList.add('scene--gsap');

  const q = (s) => svg.querySelector(s);
  const tour = q('.tour'), halo = q('.tour-halo'), done = q('.tour-done'), road = q('.tour-road');
  const truck = q('.truck');
  const loads = [...svg.querySelectorAll('.truck__load .load')];
  const cities = svg.querySelectorAll('.city');
  const hubs = [...svg.querySelectorAll('.city--hub .halo')]; // [Rīga, Daugavpils]
  const roads = svg.querySelectorAll('.map__faint path');
  const pickups = [...svg.querySelectorAll('.pickup')];
  const cards = [...scene.querySelectorAll('.mock')];
  const hud = scene.querySelector('.hud');
  const hudN = hud && hud.querySelector('.hud__n'), hudD = hud && hud.querySelector('.hud__d'), hudE = hud && hud.querySelector('.hud__e');

  // Waypoints (SVG units): Daugavpils → cargo → Rīga → Jelgava → Šiauliai → cargo → Kaunas → Vilnius → cargo → Daugavpils
  const W = [[354, 413], [300, 332], [224, 305], [203, 335], [181, 407], [192, 458], [213, 510], [287, 531], [334, 476], [354, 413]];
  const STOPS = [1, 5, 8]; // waypoint index of each cargo pickup
  const DETOUR = [38, 12, 25]; // km shown on the labels and summed in the counter
  const KM_TOTAL = 1020; // rough length of the loop in real kilometres, for the counter
  const raw = MotionPathPlugin.arrayToRawPath(W.map(([x, y]) => ({ x, y })), { curviness: 1.1 });
  const d = MotionPathPlugin.rawPathToString(raw);
  [tour, halo, done, road].forEach((p) => p.setAttribute('d', d));
  MotionPathPlugin.cacheRawPathMeasurements(raw);
  // exact progress of a waypoint along the smoothed path (nearest of 800 samples)
  const progressAt = ([x, y]) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i <= 800; i++) {
      const p = MotionPathPlugin.getPositionOnPath(raw, i / 800);
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd < bd) { bd = dd; best = i / 800; }
    }
    return best;
  };
  const stops = [0, ...STOPS.map((i) => progressAt(W[i])), 1];
  const pRiga = progressAt(W[2]);

  gsap.set(cards, { visibility: 'hidden', scale: 0.92, y: 14, z: 40, transformOrigin: '50% 100%' });
  if (hud) gsap.set(hud, { z: 30 });
  gsap.set(pickups.map((p) => p.querySelector('.pickup__label')), { autoAlpha: 0 });
  gsap.set(loads, { scale: 0, transformOrigin: '50% 50%' });
  gsap.set(truck, { autoAlpha: 0 });

  // trail: thin line = everything driven so far, bright stroke + glow = comet tail behind the truck
  const state = { p: 0, n: 0, det: 0 };
  const TAIL = 0.11;
  const draw = () => {
    const p = state.p;
    gsap.set(done, { drawSVG: `0% ${p * 100}%` });
    gsap.set([tour, halo], { drawSVG: `${Math.max(0, p - TAIL) * 100}% ${p * 100}%` });
    if (hudE) hudE.textContent = (state.n ? 0 : Math.round(p * KM_TOTAL)) + ' km';
  };
  const hudSet = () => { if (!hud) return; hudN.textContent = state.n; hudD.textContent = '+' + state.det + ' km'; };
  draw(); hudSet();

  const pulseHub = (i) => gsap.fromTo(hubs[i], { scale: 1, opacity: 1, transformOrigin: '50% 50%' }, { scale: 2.4, opacity: 0, duration: 1, ease: 'power2.out', onComplete: () => gsap.set(hubs[i], { scale: 1, opacity: 1 }) });
  const bump = () => gsap.fromTo(hud, { scale: 1 }, { scale: 1.06, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut', transformOrigin: '50% 50%' });

  const reset = () => {
    state.p = 0; state.n = 0; state.det = 0; draw(); hudSet();
    gsap.set(loads, { scale: 0 });
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
    // the cargo lands on the trailer: a bump of the truck, a box appears, the counter ticks
    gsap.fromTo(truck, { scale: 1 }, { scale: 1.22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut', transformOrigin: '50% 50%' });
    gsap.fromTo(loads[i], { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(2.5)', delay: 0.3, transformOrigin: '50% 50%' });
    gsap.delayedCall(0.45, () => { state.n = i + 1; state.det += DETOUR[i]; hudSet(); if (hudE) hudE.textContent = '0 km'; if (hud) bump(); });
    const card = cards[i];
    if (card) {
      // scale and position only, never opacity: the card's contrast must not dip mid-animation
      gsap.fromTo(card, { visibility: 'visible', scale: 0.92, y: 14 }, { scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' });
      gsap.to(card, { scale: 0.94, y: -8, duration: 0.3, ease: 'power1.in', delay: 4.4, onComplete: () => gsap.set(card, { visibility: 'hidden' }) });
    }
  };
  const unload = () => {
    pulseHub(1);
    gsap.to(loads.slice().reverse(), { scale: 0, duration: 0.25, stagger: 0.09, ease: 'back.in(2)' });
  };

  // the drive: four legs at ~constant pace, easing into and out of every stop
  const DRIVE = 26, PAUSE = 1.1, EASE = 'power1.inOut';
  const easeTime = (f) => (f < 0.5 ? Math.sqrt(f / 2) : 1 - Math.sqrt((1 - f) / 2)); // inverse of power1.inOut
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4, onRepeat: reset });
  tl.to(truck, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0).call(pulseHub, [1], 0.1);
  let t = 0;
  for (let s = 0; s < stops.length - 1; s++) {
    const a = stops[s], b = stops[s + 1];
    const dur = (b - a) * DRIVE;
    tl.to(truck, { motionPath: { path: tour, align: tour, alignOrigin: [0.5, 0.5], autoRotate: true, start: a, end: b }, duration: dur, ease: EASE }, t)
      .fromTo(state, { p: a }, { p: b, duration: dur, ease: EASE, onUpdate: draw }, t);
    if (a < pRiga && pRiga <= b) tl.call(pulseHub, [0], t + easeTime((pRiga - a) / (b - a)) * dur);
    t += dur;
    if (s < stops.length - 2) { tl.call(pickup, [s], t); t += PAUSE; }
  }
  tl.call(unload, [], t - 0.05)
    .to(truck, { autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, t + 0.5);

  // intro: cities, then the faint road network, the tour road draws itself, cargos drop in, the truck sets off
  const intro = gsap.timeline({ onComplete: () => tl.play(0) });
  intro.from(cities, { autoAlpha: 0, stagger: 0.04, duration: 0.45, ease: 'power2.out' }, 0.1)
    .from(roads, { autoAlpha: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out' }, 0.4)
    .fromTo(road, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.3, ease: 'power2.inOut' }, 0.6)
    .from(pickups, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%', stagger: 0.12, duration: 0.5, ease: 'back.out(2)' }, 1.2);
  if (hud) intro.from(hud, { autoAlpha: 0, y: 10, duration: 0.5, ease: 'power2.out' }, 1.5);

  // gentle tilt after the pointer: decorative, springy, only with a real mouse; cards float above the map (z)
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
