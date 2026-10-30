// The night sky behind the website, on a canvas: thousands of stars by brightness, the
// Milky Way, a constellation that draws itself, the odd shooting star, and light pollution, the
// brand's metaphor. With `haze` at 1 the sky is a washed-out orange city glow where only the
// brightest stars get through; at 0 it's clear and deep. Every option eases toward its new
// value, so a change glides; with reduced motion the sky jumps there and stays still.
function random(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const rgb = (c, a) => {
  const n = parseInt(c.slice(1), 16);
  return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${a})`;
};

const mix = (a, b, t) => a + (b - a) * t;

// A week of focus: one star per session, left to right through the week, in its profile's
// color (gold for Writing, blue-white for Deep Work, lavender for Study). Positions are shares
// of the constellation's box; the last figure is the star's size.
const WEEK = {
  stars: [
    [0.0, 0.55, '#cfe0ff', 2.6],
    [0.12, 0.22, '#f5c86b', 2.1],
    [0.27, 0.68, '#cfe0ff', 2.4],
    [0.42, 0.14, '#cfe0ff', 3.4],
    [0.53, 0.47, '#f5c86b', 2.3],
    [0.7, 0.28, '#b9a7f5', 1.8],
    [0.84, 0.74, '#cfe0ff', 1.6],
    [1.0, 0.42, '#b9a7f5', 1.5],
  ],
  lines: [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 4],
    [3, 5],
    [5, 7],
    [6, 7],
  ],
};

const STAR_COLORS = ['#f3f0e6', '#f3f0e6', '#dce4ff', '#cfe0ff', '#fff1d6', '#ffe2c4'];

/**
 * Draws the sky into `canvas`, which fills its box. Options (all eased):
 * - haze: 0 clear to 1 light-polluted
 * - milky: how much of the Milky Way shows (light pollution washes it out first)
 * - constellation: how much of the week's constellation is drawn, 0 to 1
 * - cx, cy, cs: where the constellation sits (shares of the canvas) and its width (share of the
 *   shorter side)
 * - shift: scrolls the stars up by this many pixels, the nearer ones more, for parallax
 * - glow: the dusk glow at the bottom of a clear sky
 * - city: how the light pollution looks, from a sunset-like glow (0) to city lights (1): a
 *   skyline along the bottom with lit windows and a dome of orange light over it. Fewer windows
 *   stay lit as the haze clears.
 * Not eased: `meteors` (shooting stars now and then while the sky is clear), `seed`.
 * Returns { set(options), state }.
 */
export function createSky(canvas, options = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = Object.assign(
    {
      haze: 1,
      milky: 0,
      constellation: 0,
      cx: 0.5,
      cy: 0.3,
      cs: 0.42,
      shift: 0,
      glow: 1,
      city: 0,
    },
    options,
  );
  const meteors = options.meteors ?? true;
  const state = { ...target };
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars = [];
  let band = null;
  let buildings = [];
  // Per star color, a bright star drawn once (disc, or disc and halo) to stamp each frame.
  let sprites = new Map();
  // The buildings and their windows, drawn now and then rather than every frame.
  let cityLayer = null;
  let cityDrawn = { at: -Infinity, haze: -1, city: -1 };
  const shooting = [];
  let nextMeteor = 4000;

  function build() {
    const rand = random(options.seed ?? 7);
    // Many faint stars, few bright ones: brightness is a cube, so most land near 0.
    const count = Math.min(2600, Math.round((w * h) / 900));
    stars = Array.from({ length: count }, () => {
      const b = rand() ** 3;
      return {
        x: rand(),
        y: rand(),
        b,
        r: 0.35 + b * 1.6,
        color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 1.4,
        depth: 0.15 + rand() * 0.85,
      };
    });
    // Grouped by color, so each frame sets each color once.
    stars.sort((a, b) => STAR_COLORS.indexOf(a.color) - STAR_COLORS.indexOf(b.color));
    sprites = new Map(STAR_COLORS.map((color) => [color, starSprites(color)]));
    band = milkyWay(random(11));
    buildings = skyline(random(23));
    cityLayer = null;
  }

  // A bright star at radius SPRITE_R: the disc alone, and the disc with its halo out to six
  // radii, at full strength. Each frame stamps them scaled to the star and faded by globalAlpha.
  const SPRITE_R = 4;
  function starSprites(color) {
    const make = (halo) => {
      const size = Math.ceil(SPRITE_R * (halo ? 12 : 2) * dpr) + 2;
      const off = document.createElement('canvas');
      off.width = off.height = size;
      const g = off.getContext('2d');
      const c = size / 2;
      const r = SPRITE_R * dpr;
      if (halo) {
        const grad = g.createRadialGradient(c, c, 0, c, c, r * 6);
        grad.addColorStop(0, rgb(color, 0.25));
        grad.addColorStop(1, rgb(color, 0));
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      g.fillStyle = color;
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.fill();
      return off;
    };
    return { disc: make(false), halo: make(true) };
  }

  // The Milky Way, drawn once into its own canvas: a diagonal band of soft glow and specks with
  // darker dust lanes through it.
  function milkyWay(rand) {
    const off = document.createElement('canvas');
    off.width = Math.round(w * dpr);
    off.height = Math.round(h * dpr);
    const g = off.getContext('2d');
    g.scale(dpr, dpr);
    const len = Math.hypot(w, h);
    g.translate(w / 2, h / 2);
    g.rotate(-0.42);
    const width = Math.max(140, Math.min(w, h) * 0.32);
    for (const [color, a, s] of [
      ['#6d5aa8', 0.16, 1.2],
      ['#3b4fb0', 0.14, 0.9],
      ['#e9d9c0', 0.08, 0.45],
    ]) {
      for (let i = 0; i < 26; i++) {
        const x = (rand() - 0.5) * len;
        const y = (rand() - 0.5) * width * 0.6;
        const r = width * s * (0.5 + rand() * 0.6);
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, rgb(color, a));
        grad.addColorStop(1, rgb(color, 0));
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // Specks, bunched towards the band's middle.
    for (let i = 0; i < 2600; i++) {
      const x = (rand() - 0.5) * len;
      const y = (rand() + rand() + rand() - 1.5) * width * 0.42;
      g.fillStyle = rgb('#f3f0e6', 0.15 + rand() * 0.45);
      const s = rand() < 0.9 ? 0.6 : 1.1;
      g.fillRect(x, y, s, s);
    }
    // Dust lanes take some of it away again.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 18; i++) {
      const x = (rand() - 0.5) * len;
      const y = (rand() - 0.5) * width * 0.25;
      const r = width * (0.12 + rand() * 0.2);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgb(0 0 0 / 0.3)');
      grad.addColorStop(1, 'rgb(0 0 0 / 0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return off;
  }

  // A city along the bottom: low rooftops in the middle, where a page's bottom navigation
  // sits, and towers rising towards the left and right edges. Each building has a grid of
  // windows that light up in a random order as the haze thickens; the low middle stretch keeps
  // fewer of them lit, so it doesn't outshine what's drawn over it.
  function skyline(rand) {
    const out = [];
    const tallest = Math.max(36, h * 0.075);
    const valley = Math.min(340, w * 0.46);
    let x = -8;
    while (x < w + 8) {
      const bw = 16 + rand() * 44;
      const fromMiddle = Math.abs(x + bw / 2 - w / 2);
      // 0 in the low middle, rising to 1 by the edges.
      const rise = Math.min(1, Math.max(0, (fromMiddle - valley) / Math.max(1, w / 2 - valley)));
      const edge = fromMiddle < valley ? 0 : 0.35 + 0.65 * rise;
      const bh = edge ? tallest * (0.35 + rand() * 0.3 + edge * rand() * 0.75) : tallest * (0.14 + rand() * 0.2);
      const windows = [];
      for (let wy = 6; wy < bh - 6; wy += 7) {
        for (let wx = 4; wx < bw - 5; wx += 6) {
          windows.push({ x: wx, y: wy, order: rand(), phase: rand() * Math.PI * 2, warm: rand() < 0.75 });
        }
      }
      out.push({ x, w: bw, h: bh, windows, lit: edge ? 1 : 0.45, mast: bh > tallest * 0.75 && rand() < 0.7 });
      x += bw + (rand() < 0.2 ? 2 + rand() * 10 : 0);
    }
    return out;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = box.width;
    h = box.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    build();
    if (reduce) draw(0);
  }

  function draw(t) {
    const s = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The sky itself: deep blue when clear; polluted, a muddy orange-brown glow like a sunset, or
    // the flat greyish-orange of a city's sky.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const hazy = (sunset, city) => mix(sunset, city, s.city);
    const stop = (clear, sunset, city) => mix(clear, hazy(sunset, city), s.haze);
    sky.addColorStop(0, `rgb(${stop(11, 34, 36)} ${stop(16, 28, 33)} ${stop(32, 44, 44)})`);
    sky.addColorStop(0.6, `rgb(${stop(13, 58, 58)} ${stop(18, 40, 48)} ${stop(38, 48, 56)})`);
    sky.addColorStop(1, `rgb(${stop(21, 120, 112)} ${stop(20, 70, 76)} ${stop(42, 52, 64)})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // The Milky Way, washed out by any haze at all.
    const milky = s.milky * (1 - s.haze) ** 2;
    if (milky > 0.01 && band) {
      ctx.globalAlpha = milky;
      ctx.drawImage(band, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // Stars. Haze hides the faint ones first and dims the rest; only the brightest few get
    // through, and faintly.
    const time = t / 1000;
    const veil = 1 - s.haze * 0.62;
    let color = '';
    for (const star of stars) {
      const seen = star.b - s.haze * 0.8;
      if (seen <= 0) continue;
      const twinkle = reduce ? 1 : 0.75 + 0.25 * Math.sin(time * star.speed + star.phase);
      ctx.globalAlpha = Math.min(1, (0.25 + seen * 1.6) * twinkle * veil);
      const y = (((star.y * h - s.shift * star.depth) % h) + h) % h;
      const x = star.x * w;
      if (star.r < 0.9) {
        if (star.color !== color) ctx.fillStyle = color = star.color;
        ctx.fillRect(x, y, star.r * 1.6, star.r * 1.6);
      } else {
        const halo = star.b > 0.45;
        const sprite = sprites.get(star.color)[halo ? 'halo' : 'disc'];
        const size = star.r * (halo ? 12 : 2) * (sprite.width / (SPRITE_R * (halo ? 12 : 2) * dpr));
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;

    drawConstellation(time);
    if (meteors && !reduce) drawMeteors(t);

    // Light pollution: an orange glow rising from the bottom, and a pale veil over all of it.
    const sunset = s.haze * (1 - s.city);
    if (sunset > 0.01) {
      const city = ctx.createRadialGradient(w / 2, h * 1.25, 0, w / 2, h * 1.25, Math.max(w, h) * 1.1);
      city.addColorStop(0, `rgb(255 154 82 / ${0.55 * sunset})`);
      city.addColorStop(0.45, `rgb(214 110 80 / ${0.28 * sunset})`);
      city.addColorStop(1, 'rgb(120 70 90 / 0)');
      ctx.fillStyle = city;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.haze > 0.01) {
      ctx.fillStyle = `rgb(150 120 130 / ${0.1 * s.haze})`;
      ctx.fillRect(0, 0, w, h);
    }

    // The dusk glow at the bottom of a clear sky.
    const dusk = (1 - s.haze) * s.glow;
    if (dusk > 0.01) {
      const glow = ctx.createRadialGradient(w / 2, h * 1.15, 0, w / 2, h * 1.15, Math.max(w * 0.7, h * 0.7));
      glow.addColorStop(0, `rgb(120 92 150 / ${0.32 * dusk})`);
      glow.addColorStop(1, 'rgb(120 92 150 / 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    if (s.city > 0.01) drawCity(time);
  }

  function drawCity(time) {
    const s = state;
    const c = s.city;

    // The dome of light over the city: wide and low, sodium orange, with whiter LED glows.
    if (s.haze > 0.01) {
      ctx.save();
      ctx.translate(w / 2, h);
      ctx.scale(1, 0.55);
      const r = Math.max(w * 0.8, h);
      const dome = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      dome.addColorStop(0, `rgb(255 178 98 / ${0.6 * s.haze * c})`);
      dome.addColorStop(0.3, `rgb(244 140 78 / ${0.32 * s.haze * c})`);
      dome.addColorStop(0.7, `rgb(190 110 90 / ${0.1 * s.haze * c})`);
      dome.addColorStop(1, 'rgb(150 100 100 / 0)');
      ctx.fillStyle = dome;
      ctx.fillRect(-r, -r, r * 2, r);
      ctx.restore();
      for (const [x, color] of [
        [0.18, '220 228 255'],
        [0.62, '255 214 150'],
        [0.86, '220 228 255'],
      ]) {
        const rr = Math.max(w, h) * 0.22;
        const g = ctx.createRadialGradient(x * w, h, 0, x * w, h, rr);
        g.addColorStop(0, `rgb(${color} / ${0.16 * s.haze * c})`);
        g.addColorStop(1, `rgb(${color} / 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x * w - rr, h - rr, rr * 2, rr);
      }
    }

    // The buildings and windows change slowly, so they're redrawn only when the haze or the look
    // has moved on, or every half second for the windows' drift.
    if (
      !cityLayer ||
      Math.abs(s.haze - cityDrawn.haze) > 0.004 ||
      Math.abs(c - cityDrawn.city) > 0.004 ||
      time - cityDrawn.at > 0.5
    ) {
      drawBuildings(time);
    }
    ctx.drawImage(cityLayer, 0, h - cityLayer.height / dpr, w, cityLayer.height / dpr);

    // A slow red light on top of each mast, for aircraft.
    const blink = reduce ? 0.8 : 0.35 + 0.65 * Math.max(0, Math.sin(time * 1.6));
    ctx.fillStyle = `rgb(255 70 60 / ${blink * c})`;
    for (const b of buildings) {
      if (b.mast) ctx.fillRect(b.x + b.w / 2 - 1.25, h - b.h - 16, 2.5, 2.5);
    }
  }

  // The buildings, dark against the glow, into their own canvas along the bottom.
  function drawBuildings(time) {
    const s = state;
    const c = s.city;
    const tall = Math.ceil(Math.max(0, ...buildings.map((b) => b.h + 16)));
    if (!cityLayer || cityLayer.width !== Math.round(w * dpr) || cityLayer.height !== Math.round(tall * dpr)) {
      cityLayer = document.createElement('canvas');
      cityLayer.width = Math.round(w * dpr);
      cityLayer.height = Math.round(tall * dpr);
    }
    const g = cityLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, tall);
    g.fillStyle = `rgb(7 8 15 / ${c})`;
    for (const b of buildings) {
      g.fillRect(b.x, tall - b.h, b.w, b.h);
      if (b.mast) g.fillRect(b.x + b.w / 2 - 0.75, tall - b.h - 14, 1.5, 14);
    }

    // Windows: most are lit under the haze, a few stay on under a clear sky. Each one's turn
    // drifts slowly, so now and then a light goes on or off.
    const lit = 0.06 + 0.5 * s.haze;
    const glowA = (0.45 + 0.4 * s.haze) * c;
    for (const warm of [true, false]) {
      g.fillStyle = warm ? `rgb(255 212 140 / ${glowA})` : `rgb(214 226 255 / ${glowA * 0.85})`;
      for (const b of buildings) {
        const top = tall - b.h;
        for (const win of b.windows) {
          if (win.warm !== warm) continue;
          const drift = reduce ? 0 : 0.03 * Math.sin(time * 0.12 + win.phase);
          if (win.order + drift < lit * b.lit) g.fillRect(b.x + win.x, top + win.y, 2.5, 3);
        }
      }
    }
    cityDrawn = { at: time, haze: s.haze, city: c };
  }

  function drawConstellation(time) {
    const p = state.constellation;
    if (p <= 0.001) return;
    const size = Math.min(w, h) * state.cs;
    const ox = state.cx * w - size / 2;
    const oy = state.cy * h - size * 0.25;
    const at = ([x, y]) => [ox + x * size, oy + y * size * 0.5];
    const clear = 1 - state.haze * 0.6;

    // Lines draw one after another through the first 80%; stars arrive alongside them.
    ctx.lineWidth = 1;
    WEEK.lines.forEach(([a, b], i) => {
      const start = (i / WEEK.lines.length) * 0.8;
      const t = Math.min(1, Math.max(0, (p - start) / (0.8 / WEEK.lines.length) / 1.6));
      if (t <= 0) return;
      const [x1, y1] = at(WEEK.stars[a]);
      const [x2, y2] = at(WEEK.stars[b]);
      ctx.strokeStyle = `rgb(220 228 255 / ${0.32 * clear})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(mix(x1, x2, t), mix(y1, y2, t));
      ctx.stroke();
    });
    WEEK.stars.forEach((star, i) => {
      const start = (i / WEEK.stars.length) * 0.85;
      const t = Math.min(1, Math.max(0, (p - start) / 0.15));
      if (t <= 0) return;
      const [x, y] = at(star);
      const twinkle = reduce ? 1 : 0.85 + 0.15 * Math.sin(time * 1.3 + i);
      const r = star[3] * (0.6 + 0.4 * t);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
      halo.addColorStop(0, rgb(star[2], 0.45 * t * twinkle * clear));
      halo.addColorStop(1, rgb(star[2], 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
      ctx.fillStyle = rgb(star[2], t * clear);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // A shooting star every 6 to 16 seconds while the sky is clear: a short bright streak that
  // fades along its tail.
  function drawMeteors(t) {
    if (state.haze < 0.25 && t > nextMeteor) {
      shooting.push({
        x: 0.1 + Math.random() * 0.7,
        y: Math.random() * 0.35,
        angle: 0.35 + Math.random() * 0.4,
        born: t,
        life: 900 + Math.random() * 500,
        len: 120 + Math.random() * 120,
      });
      nextMeteor = t + 6000 + Math.random() * 10000;
    }
    for (let i = shooting.length - 1; i >= 0; i--) {
      const m = shooting[i];
      const k = (t - m.born) / m.life;
      if (k >= 1) {
        shooting.splice(i, 1);
        continue;
      }
      const travel = m.len * 2.2 * k;
      const hx = m.x * w + Math.cos(m.angle) * travel;
      const hy = m.y * h + Math.sin(m.angle) * travel;
      const tx = hx - Math.cos(m.angle) * m.len * Math.min(1, k * 3);
      const ty = hy - Math.sin(m.angle) * m.len * Math.min(1, k * 3);
      const fade = Math.sin(Math.PI * k);
      const grad = ctx.createLinearGradient(hx, hy, tx, ty);
      grad.addColorStop(0, `rgb(243 240 230 / ${0.9 * fade})`);
      grad.addColorStop(1, 'rgb(243 240 230 / 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }

  // The sky draws at up to 60 frames a second, which its slow twinkle and drift don't need more
  // than; on a faster screen it keeps up only while the stars are scrolling past.
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const scrolling = Math.abs(target.shift - state.shift) > 0.5;
    if (!scrolling && now - last < 15) return;
    const dt = Math.min(64, now - last);
    last = now;
    // Ease every option towards its target: haze slowly, scroll quickly.
    for (const key of Object.keys(target)) {
      const tau = key === 'shift' ? 90 : key === 'constellation' ? 700 : 520;
      state[key] += (target[key] - state[key]) * (1 - Math.exp(-dt / tau));
    }
    draw(now);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  if (!reduce) requestAnimationFrame(frame);

  return {
    state,
    set(next) {
      Object.assign(target, next);
      if (reduce) {
        Object.assign(state, target);
        draw(0);
      }
    },
  };
}
