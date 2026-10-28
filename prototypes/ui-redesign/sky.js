// A small stand-in for NightSky.vue, shared by the three prototypes: twinkling stars, last week's
// constellation, the month's planet, satellites in slow orbits and a soft colored nebula. Every
// option eases toward its new value, so state changes glide; with reduced motion it just redraws.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function random(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
  }

  // The week of Oct 19–25: one star per session cluster, left to right through the week.
  const week = {
    stars: [
      [0.0, 0.55, '#cfe0ff', 2.6],
      [0.1, 0.25, '#f5c86b', 2.1],
      [0.27, 0.66, '#cfe0ff', 2.4],
      [0.42, 0.18, '#cfe0ff', 3.4],
      [0.52, 0.48, '#f5c86b', 2.2],
      [0.7, 0.3, '#b9a7f5', 1.6],
      [0.84, 0.72, '#cfe0ff', 1.5],
      [1.0, 0.42, '#b9a7f5', 1.3],
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
  // Two older weeks, fainter and smaller, packed around it on the Sky page.
  const older = [
    { dx: -0.62, dy: 0.5, s: 0.55, a: 0.45 },
    { dx: 0.7, dy: 0.62, s: 0.5, a: 0.35 },
  ];

  const hex = (c, a) => {
    const n = parseInt(c.slice(1), 16);
    return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${a})`;
  };

  window.LockSky = function (canvas, options) {
    const target = Object.assign(
      {
        haze: 0.55, // 0 clear (in a session) to 1 hazy
        nebula: 0.4, // how strongly the colored glow shows
        nebulaColors: ['#3b4fb0', '#6d3f99', '#1f6f8b'],
        cx: 0.5, // where the constellation sits, as a share of the canvas
        cy: 0.26,
        cs: 1, // its scale
        older: 1, // older constellations' opacity
        px: 0.84, // the planet
        py: 0.12,
        pr: 18,
        ox: 0.5, // the satellites' orbit center and radii
        oy: 0.28,
        orx: 0.4,
        ory: 0.13,
        satellites: 3,
        satelliteColor: '#dfe7ff',
      },
      options,
    );
    const now = Object.assign({}, target);
    const ctx = canvas.getContext('2d');
    const rand = random(7);
    const field = Array.from({ length: 230 }, () => ({
      x: rand(),
      y: rand() ** 1.25,
      r: rand() ** 3 * 1.3 + 0.25,
      p: rand() * Math.PI * 2,
      s: 0.4 + rand() * 1.2,
      warm: rand() < 0.18,
    }));
    const orbits = Array.from({ length: 6 }, (_, i) => ({
      phase: rand() * Math.PI * 2,
      period: 48 + rand() * 40,
      scale: 0.75 + i * 0.09,
      tilt: (rand() - 0.5) * 0.35,
    }));
    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    }

    function satellitePosition(i, t) {
      const o = orbits[i];
      const a = o.phase + (t / o.period) * Math.PI * 2;
      const x = Math.cos(a) * now.orx * w * o.scale;
      const y = Math.sin(a) * now.ory * h * o.scale;
      return [
        now.ox * w + x * Math.cos(o.tilt) - y * Math.sin(o.tilt),
        now.oy * h + x * Math.sin(o.tilt) + y * Math.cos(o.tilt),
        Math.sin(a),
      ];
    }

    function drawConstellation(cx, cy, size, alpha, t) {
      const pts = week.stars.map(([x, y, c, m]) => [cx + (x - 0.5) * size, cy + (y - 0.5) * size * 0.55, c, m]);
      ctx.lineWidth = 0.8;
      for (const [a, b] of week.lines) {
        const g = ctx.createLinearGradient(pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
        g.addColorStop(0, hex(pts[a][2], 0.28 * alpha));
        g.addColorStop(1, hex(pts[b][2], 0.28 * alpha));
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(pts[a][0], pts[a][1]);
        ctx.lineTo(pts[b][0], pts[b][1]);
        ctx.stroke();
      }
      pts.forEach(([x, y, c, m], i) => {
        const tw = 0.85 + 0.15 * Math.sin(t * 1.3 + i * 1.7);
        const r = m * (size / 220);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
        glow.addColorStop(0, hex(c, 0.5 * alpha * tw));
        glow.addColorStop(1, hex(c, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex('#ffffff', 0.95 * alpha);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawPlanet(x, y, r, t) {
      const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.2);
      glow.addColorStop(0, 'rgb(247 181 139 / 0.18)');
      glow.addColorStop(1, 'rgb(247 181 139 / 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      const ring = (front) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.38);
        ctx.strokeStyle = 'rgb(245 220 200 / 0.42)';
        ctx.lineWidth = r * 0.16;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.75, r * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };
      ring(false);
      const body = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
      body.addColorStop(0, '#ffe2c4');
      body.addColorStop(0.45, '#e59a73');
      body.addColorStop(1, '#5b2f4a');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Soft bands drifting across a gas giant.
      ctx.save();
      ctx.clip();
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = `rgb(120 60 80 / ${0.12 + 0.05 * Math.sin(i + t * 0.05)})`;
        ctx.fillRect(x - r, y + i * r * 0.36 + Math.sin(t * 0.1 + i) * 1.5, r * 2, r * 0.13);
      }
      ctx.restore();
      ring(true);
    }

    function draw(time) {
      const t = reduce ? 20 : time / 1000;
      if (!reduce)
        for (const key in target) if (typeof target[key] === 'number') now[key] += (target[key] - now[key]) * 0.045;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#060914');
      bg.addColorStop(0.65, '#0b1020');
      bg.addColorStop(1, '#141a33');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // A colored nebula breathing very slowly behind everything.
      target.nebulaColors.forEach((c, i) => {
        const x = w * (0.2 + 0.6 * ((i * 0.37) % 1) + 0.03 * Math.sin(t * 0.03 + i));
        const y = h * (0.22 + 0.28 * i + 0.02 * Math.cos(t * 0.025 + i * 2));
        const r = Math.max(w, h) * (0.45 + 0.08 * i);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hex(c, 0.32 * now.nebula));
        g.addColorStop(1, hex(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      const clear = 1 - now.haze * 0.75;
      for (const s of field) {
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))) * clear * (s.r > 1 ? 1 : 0.7);
        ctx.fillStyle = s.warm ? `rgb(255 230 200 / ${a})` : `rgb(225 232 255 / ${a})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const size = Math.min(w * 0.62, 260) * now.cs;
      for (const o of older)
        drawConstellation(
          now.cx * w + o.dx * size,
          now.cy * h + o.dy * size * 0.4,
          size * o.s,
          o.a * now.older * clear,
          t,
        );
      drawConstellation(now.cx * w, now.cy * h, size, 0.4 + 0.6 * clear, t);
      drawPlanet(now.px * w, now.py * h, now.pr, t);

      // Satellites: tiny lights with a short fading trail, behind the planet's glow on the far side.
      const count = Math.round(now.satellites);
      for (let i = 0; i < count; i++) {
        const [x, y, depth] = satellitePosition(i, t);
        for (let k = 8; k >= 1; k--) {
          const [tx, ty] = satellitePosition(i, t - k * 0.35);
          ctx.fillStyle = hex(target.satelliteColor, 0.035 * (8 - k));
          ctx.beginPath();
          ctx.arc(tx, ty, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        const a = 0.55 + 0.35 * depth;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, hex(target.satelliteColor, 0.7 * a));
        g.addColorStop(1, hex(target.satelliteColor, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex('#ffffff', a);
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Light pollution between sessions, from the bottom of the window.
      const haze = ctx.createLinearGradient(0, h * 0.35, 0, h);
      haze.addColorStop(0, 'rgb(60 70 110 / 0)');
      haze.addColorStop(1, `rgb(70 78 120 / ${0.42 * now.haze})`);
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      if (!reduce) requestAnimationFrame(draw);
    }

    addEventListener('resize', resize);
    resize();
    if (!reduce) requestAnimationFrame(draw);
    return {
      // `instant` skips the glide, e.g. for the first state when a page loads.
      set(patch, instant) {
        Object.assign(target, patch);
        if (instant) Object.assign(now, target);
        if (reduce) {
          Object.assign(now, target);
          draw(0);
        }
      },
    };
  };

  // Shared by every prototype: the state comes from ?state= or a message from the compare page.
  window.onPrototypeState = function (apply) {
    const initial = new URLSearchParams(location.search).get('state');
    addEventListener('message', (event) => event.data && event.data.state && apply(event.data.state));
    return initial;
  };
})();
