/* ============================================================
   1. Scroll-driven video pan: the visible window starts at the
   chosen frame position (START_FRAC into the video's height)
   and sweeps down to the bottom of the video as the page scrolls
   ============================================================ */

const bgVideo = document.getElementById('bg-video');

// On phones, swap to the portrait corridor video. Done before the desktop
// clip gets far into buffering so we don't pay for both.
const IS_PHONE = window.matchMedia('(max-width: 760px)').matches;
if (IS_PHONE) {
  const src = bgVideo.querySelector('source');
  if (src) {
    src.src = 'assets/background-mobile.mp4?v=2';
    bgVideo.load();
  }
}

// top of the start crop, as a fraction of the source video height
const START_FRAC = 0;

function updateVideoPan() {
  const w = bgVideo.videoWidth;
  const h = bgVideo.videoHeight;
  if (!w || !h) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(vw / w, vh / h); // cover
  const dw = Math.ceil(w * scale);
  const dh = Math.ceil(h * scale);

  const maxScroll = document.documentElement.scrollHeight - vh;
  const p = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;

  const tyStart = -Math.min(START_FRAC * dh, dh - vh); // chosen frame at top
  const tyEnd = vh - dh;                               // bottom aligned
  const ty = tyStart + (tyEnd - tyStart) * p;

  bgVideo.style.width = dw + 'px';
  bgVideo.style.height = dh + 'px';
  bgVideo.style.left = (vw - dw) / 2 + 'px';
  bgVideo.style.transform = `translate3d(0, ${ty}px, 0)`;
}

bgVideo.addEventListener('loadedmetadata', updateVideoPan);
if (bgVideo.readyState >= 1) updateVideoPan();

// Fade the fixed header logo out as the video transitions to black.
// The footer (with its fade-to-black overlay) scrolls up over the video;
// opacity tracks how far the black has crept down to the header.
const headerEl = document.querySelector('.site-header');
const footerEl = document.querySelector('.site-footer');

function updateHeaderFade() {
  if (!headerEl || !footerEl) return;
  const fadeH = window.innerHeight * 0.55; // matches .site-footer::before height
  const footerTop = footerEl.getBoundingClientRect().top;
  // fully visible when the black is only just starting (footerTop ≈ fadeH);
  // fully gone before the top of the screen is fully black (footerTop ≈ 0.25·fadeH)
  const op = Math.max(0, Math.min(1, (footerTop - fadeH * 0.25) / (fadeH * 0.75)));
  headerEl.style.opacity = op;
  headerEl.style.pointerEvents = op < 0.05 ? 'none' : '';
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateVideoPan();
    updateHeaderFade();
    ticking = false;
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
updateHeaderFade();

/* Intro reveal: blur + fade the letter text in when the page opens.
   Elements in the first viewport stagger; anything below the fold
   reveals immediately so scrolling never shows a half-blurred line. */
(function introReveal() {
  const run = () => {
    const els = document.querySelectorAll(
      '.letter .heading, .letter .date, .letter .para'
    );
    const vh = window.innerHeight;
    let order = 0;
    els.forEach((el) => {
      const top = el.getBoundingClientRect().top;
      const delay = top < vh ? order++ * 0.09 : 0;
      el.style.animationDelay = delay.toFixed(2) + 's';
      el.classList.add('reveal-in');
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

/* ============================================================
   2. Cinematic film grain overlay
   ============================================================ */

(function grain() {
  const canvas = document.getElementById('grain');
  const ctx = canvas.getContext('2d');
  const TILE = 512;
  const TILE_COUNT = 10;
  const tiles = [];

  for (let t = 0; t < TILE_COUNT; t++) {
    const off = document.createElement('canvas');
    off.width = TILE;
    off.height = TILE;
    const octx = off.getContext('2d');
    const img = octx.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // balanced mid-gray noise: with soft-light blending it gently
      // lightens/darkens the footage rather than adding white dots
      const v = 128 + (Math.random() - 0.5) * 120;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 40 + Math.random() * 90;
    }
    octx.putImageData(img, 0, 0);
    tiles.push(off);
  }

  function resize() {
    // full device-pixel resolution so the grain stays 1px fine
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(window.innerWidth * dpr);
    canvas.height = Math.ceil(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  let last = 0;
  const FPS = 18; // film-like flicker rate

  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - last < 1000 / FPS) return;
    last = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tile = tiles[(Math.random() * TILE_COUNT) | 0];
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.translate(-((Math.random() * TILE) | 0), -((Math.random() * TILE) | 0));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width + TILE, canvas.height + TILE);
    ctx.restore();
  }
  requestAnimationFrame(frame);
})();

/* ============================================================
   3. Video autoplay fallback
   ============================================================ */

(function ensurePlay() {
  const video = document.getElementById('bg-video');
  const tryPlay = () => {
    if (video.paused) video.play().catch(() => {});
  };
  tryPlay();
  ['loadeddata', 'canplay'].forEach((evt) => video.addEventListener(evt, tryPlay));
  ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown'].forEach((evt) =>
    window.addEventListener(evt, tryPlay, { passive: true })
  );
})();

/* The interactive footer "Lumos" dot-matrix now lives in the shared
   footer-dots.js (included on every page). */

/* ============================================================
   5. Click-hold-drag photos: scattered in the gap, droppable
   anywhere on the page (coordinates are in document space, so
   they stay put as you scroll)
   ============================================================ */

(function draggablePhotos() {
  const photos = [...document.querySelectorAll('.drag-photo')];
  const gap = document.getElementById('photo-gap');
  if (!photos.length || !gap) return;

  let topZ = 25;

  // per-photo target: horizontal center (fraction of viewport) and the
  // vertical center line (px below the gap top). Desktop = level row
  // (left / middle / right, middle a touch higher); narrow = stack.
  function layoutTargets(vw) {
    const hs = photos.map((p) => p.offsetHeight || 300);
    if (vw < 760) {
      const t = [];
      let y = 40;
      for (let i = 0; i < photos.length; i++) {
        t.push({ xc: 0.5, cy: y + hs[i] / 2 });
        y += hs[i] + 28;
      }
      return t;
    }
    const xc = [0.17, 0.5, 0.83];
    const cy = [340, 320, 345];
    return photos.map((_, i) => ({ xc: xc[i], cy: cy[i] }));
  }

  // initial layout inside the gap, in document coordinates, and size the
  // gap so the following paragraph sits just below the photos
  function placeInitial() {
    const r = gap.getBoundingClientRect();
    const docTop = r.top + window.scrollY;
    const vw = window.innerWidth;
    const t = layoutTargets(vw);
    let maxBottom = 0;
    photos.forEach((p, i) => {
      const w = p.offsetWidth || 400;
      const h = p.offsetHeight || 300;
      maxBottom = Math.max(maxBottom, t[i].cy + h / 2);
      if (p.dataset.placed) return;
      const cx = vw * t[i].xc - w / 2;
      const x = Math.max(8, Math.min(vw - w - 8, cx));
      p.style.left = x + 'px';
      p.style.top = docTop + t[i].cy - h / 2 + 'px';
      p.style.transform = `rotate(${p.dataset.rot || 0}deg)`;
      p.style.visibility = 'visible';
    });
    gap.style.height = maxBottom + 50 + 'px';
  }

  // place once images have dimensions so offset height is correct
  if (document.readyState === 'complete') placeInitial();
  else window.addEventListener('load', placeInitial);
  requestAnimationFrame(placeInitial);
  // re-place each time a photo's image finishes loading (height becomes known)
  photos.forEach((p) => {
    const img = p.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', placeInitial);
  });

  photos.forEach((p) => {
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    p.addEventListener('pointerdown', (e) => {
      dragging = true;
      p.setPointerCapture(e.pointerId);
      p.classList.add('dragging');
      p.style.zIndex = ++topZ;
      startX = e.pageX;
      startY = e.pageY;
      startLeft = parseFloat(p.style.left) || 0;
      startTop = parseFloat(p.style.top) || 0;
      e.preventDefault();
    });

    p.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      p.style.left = startLeft + (e.pageX - startX) + 'px';
      p.style.top = startTop + (e.pageY - startY) + 'px';
    });

    const end = () => {
      dragging = false;
      p.classList.remove('dragging');
      p.dataset.placed = '1'; // don't reset position on resize once moved
    };
    p.addEventListener('pointerup', end);
    p.addEventListener('pointercancel', end);
  });

  // reflow un-moved photos if the viewport changes before any drag
  window.addEventListener('resize', placeInitial);
})();
