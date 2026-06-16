/* ============================================================
   Shared interactive footer canvas: giant "Lumos" wordmark
   rendered as a dot matrix. Dots sit faint, brighten under
   drifting ambient light blobs and the cursor trail.
   Used on every page that has a #footer-canvas.
   ============================================================ */

(function footerCanvas() {
  const canvas = document.getElementById('footer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // denser dot grid on phones so the small wordmark stays detailed
  let SPACING = 8;
  const WORD = 'Lumos';
  const WORD_FONT = '700 {size}px "Times New Roman", Times, Georgia, serif';
  let dots = [];
  let trail = [];
  let dpr = 1;

  function buildDots() {
    SPACING = window.matchMedia('(max-width: 760px)').matches ? 4 : 8;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // draw the word offscreen, then sample it into a dot grid
    const off = document.createElement('canvas');
    off.width = Math.ceil(rect.width);
    off.height = Math.ceil(rect.height);
    const octx = off.getContext('2d');
    octx.fillStyle = '#fff';
    octx.textBaseline = 'alphabetic';
    octx.textAlign = 'left';
    const probe = 100;
    octx.font = WORD_FONT.replace('{size}', probe);
    const probeW = octx.measureText(WORD).width;
    const size = Math.floor(probe * (rect.width / probeW) * 1.03);
    octx.font = WORD_FONT.replace('{size}', size);

    // vertical stretch so the word fills the canvas height
    const m = octx.measureText(WORD);
    const ascent = m.actualBoundingBoxAscent;   // ≈ cap height (the L)
    const descent = m.actualBoundingBoxDescent;
    const fullStretch = (rect.height * 0.96) / (ascent + descent);
    const baselineY = rect.height * 0.02 + ascent * fullStretch;

    const totalW = octx.measureText(WORD).width;
    const startX = (rect.width - totalW) / 2;
    const head = WORD.slice(0, 1);   // "L"
    const tail = WORD.slice(1);      // "umos"
    const headW = octx.measureText(head).width;

    // "umos" — full height, on the shared baseline
    octx.save();
    octx.translate(startX + headW, baselineY);
    octx.scale(1, fullStretch);
    octx.fillText(tail, 0, 0);
    octx.restore();

    // "L" — a little shorter so its top sits below the logo
    const L_SHORTEN = 0.84;
    octx.save();
    octx.translate(startX, baselineY);
    octx.scale(1, fullStretch * L_SHORTEN);
    octx.fillText(head, 0, 0);
    octx.restore();
    const img = octx.getImageData(0, 0, off.width, off.height).data;

    dots = [];
    for (let y = SPACING / 2; y < rect.height; y += SPACING) {
      for (let x = SPACING / 2; x < rect.width; x += SPACING) {
        const a = img[((y | 0) * off.width + (x | 0)) * 4 + 3];
        if (a > 128) dots.push({ x, y });
      }
    }
  }

  buildDots();
  // rebuild once webfonts load so the sampling uses the real typeface
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildDots);
  window.addEventListener('resize', buildDots);

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    trail.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, life: 1 });
    if (trail.length > 30) trail.shift();
  });

  let visible = false;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(canvas);

  // ambient blobs: soft patches of light that drift across the word
  // on their own (no cursor needed), each with its own slow orbit
  const blobs = [
    { ax: 0.32, ay: 0.55, sx: 0.00007, sy: 0.00013, px: 0.0, py: 1.4, r: 240 },
    { ax: 0.40, ay: 0.45, sx: 0.00011, sy: 0.00009, px: 2.1, py: 0.6, r: 300 },
    { ax: 0.28, ay: 0.40, sx: 0.00009, sy: 0.00017, px: 4.0, py: 3.2, r: 200 },
    { ax: 0.45, ay: 0.50, sx: 0.00005, sy: 0.00011, px: 1.0, py: 5.0, r: 340 },
  ];

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!visible) return;

    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    trail.forEach((t) => (t.life *= 0.95));
    trail = trail.filter((t) => t.life > 0.03);

    // current center of each drifting blob
    const lights = blobs.map((b) => ({
      x: W * (0.5 + b.ax * Math.sin(ts * b.sx + b.px)),
      y: H * (0.5 + b.ay * Math.sin(ts * b.sy + b.py)),
      r2: b.r * b.r,
    }));

    const R2 = 110 * 110;
    // smaller squares when the grid is dense so dots stay distinct
    const DOT = SPACING <= 5 ? 1.5 : 2;
    const HALF = DOT / 2;
    for (const dot of dots) {
      let glow = 0;

      // ambient drifting light
      for (const l of lights) {
        const dx = dot.x - l.x;
        const dy = dot.y - l.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < l.r2) {
          const g = (1 - d2 / l.r2);
          glow += g * g * 0.55; // softer, additive so blobs overlap into bands
        }
      }

      // cursor trail on top
      for (const t of trail) {
        const dx = dot.x - t.x;
        const dy = dot.y - t.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const g = (1 - d2 / R2) * t.life;
          if (g > glow) glow = g;
        }
      }

      if (glow > 1) glow = 1;

      // quantize into stepped layers: bright white core, then two
      // progressively darker rings, then the faint base
      let alpha;
      if (glow > 0.62) alpha = 0.95;        // layer 1 — bright white
      else if (glow > 0.34) alpha = 0.58;   // layer 2 — darker
      else if (glow > 0.14) alpha = 0.32;   // layer 3 — darker still
      else alpha = 0.1;                     // base
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(dot.x - HALF, dot.y - HALF, DOT, DOT);
    }
  }
  requestAnimationFrame(frame);
})();
