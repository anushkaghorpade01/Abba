// Memory montage — layout + camera driven by public/EDITED/manifest.json (images + mp4).

// LANDSCAPE mural canvas (16∶9 framing at 4K logical size; collage reads as a wide horizon of tiles).
/** Ultra-wide mural; row packing targets a bbox wider than 16∶9 so wide shots fill the screen width */
const CANVAS_W = 7800;

const VIEW_W = 3840;
const VIEW_H = 2160;
const EDIT_BASE = 'public/EDITED';
const VISIT_RANDOM_SEED = 20250513;

/** Full-screen intro card only — omitted from mural layout (skipped by filename in `wallSkipIndicesForEntries`). */
const INTRO_FULLSCREEN_FILE = '0.png';
/** First tile spotlight after mural establish: pans/zoom here from wide shot. */
const FIRST_SPOTLIGHT_FILE = 'Add at start.mp4';
/** Full-screen outro card only — after finale video (`Dancing end`); omitted from mural wall. */
const OUTRO_FULLSCREEN_FILE = '72.png';
const FINAL_HERO_FILE = 'Dancing end Video.mp4';
/** Skips by filename only — do *not* assume manifest index `0` is the intro still (order changes when files are removed). */
function wallSkipIndicesForEntries(entries) {
  const s = new Set();
  const introIx = entries.findIndex((e) => e.file === INTRO_FULLSCREEN_FILE);
  if (introIx >= 0) s.add(introIx);
  const outIx = entries.findIndex((e) => e.file === OUTRO_FULLSCREEN_FILE);
  if (outIx >= 0) s.add(outIx);
  return s;
}
/** Full-screen `0.png` at opacity 1 for exactly this many seconds, then mural crossfade begins (camera pullback may continue longer). */
const INTRO_FULLSCREEN_HOLD_SEC = 5;
/** Cap how long the intro plate fades; keeps `0.png` brief after the hold while mural motion continues. Must be ≤ `introRevealPullSec` from montage. */
const INTRO_CROSSFADE_MAX_SEC = 2.75;
/** Hold on opening video spotlight after zoom-in settles (`Add at start.mp4`). */
const FIRST_SPOTLIGHT_HOLD_SEC = 5;
/** Hold on finale video spotlight (`Dancing end Video.mp4`). */
const FINAL_SPOTLIGHT_HOLD_SEC = 15;
/** Stationary dwell on still images between moves (videos use first/final holds). */
const MEMORY_IMAGE_HOLD_SEC = 5;
/** After finale video ends: crossfade collage → fullscreen `72.png` (paired with montage-returned `outroCrossfadeSec`). */
const OUTRO_CARD_HOLD_SEC = 4.5;
/** Subtle Z separation for layered parallax (CSS 3D; keep small). */
const PARALLAX_STRENGTH_PX = 12;

function assetUrl(file) {
  const safe = String(file || '')
    .split(/[/\\]/g)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${EDIT_BASE}/${safe}`;
}


/** Widen the visible mural rect (mural px) before culling so tilted frames / parallax still load. */
const VIEWPORT_CULL_MARGIN_MURAL = 200;
/** New visible tiles admitted per tick; opening pullback admits all viewport candidates each frame. */
const MEDIA_ADMIT_PER_TICK = 56;

function muralViewRectMural(cam, tx, ty) {
  const s = cam.scale;
  if (!(s > 1e-6)) return { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
  return {
    left: -tx / s,
    top: -ty / s,
    right: (VIEW_W - tx) / s,
    bottom: (VIEW_H - ty) / s,
  };
}

function muralsOverlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1, margin) {
  const ax0m = ax0 - margin;
  const ay0m = ay0 - margin;
  const ax1m = ax1 + margin;
  const ay1m = ay1 + margin;
  return !(ax1m < bx0 || ax0m > bx1 || ay1m < by0 || ay0m > by1);
}

/** Count manifest entries left (including idx) after skipping hole-punched indices. */
function countRemainingNonSkip(fromIdx, entriesLen, skip) {
  let c = 0;
  for (let k = fromIdx; k < entriesLen; k++) {
    if (!skip.has(k)) c++;
  }
  return c;
}

function muralTileRoughBounds(p) {
  const left = p.x - p.w / 2;
  const top = p.y - p.h / 2;
  const rad = Math.abs(Number(p.tilt) || 0) * Math.PI / 180;
  const inflate = rad < 1e-3 ? 0 : Math.sin(rad) * Math.hypot(p.w, p.h) * 0.35;
  return { left: left - inflate, top: top - inflate, right: p.x + p.w / 2 + inflate, bottom: p.y + p.h / 2 + inflate };
}

/** Prefetch HTTP cache for stills only — clips stay gated until viewport admission to avoid decoding every mp4 at once. */
function warmCollageUrlsBackground(entries, opts) {
  const {
    concurrency = PRELOAD_CONCURRENCY,
    assetTimeoutMs = PRELOAD_ASSET_TIMEOUT_MS,
  } = opts || {};
  const items = entries
    .filter((e) => e.kind !== 'video')
    .map((e) => ({
      kind: 'image',
      url: assetUrl(e.file),
    }));
  if (!items.length) return;
  async function warmupOne(it) {
    try {
      const core = preloadImageElement(it.url);
      await promiseWithTimeout(core, assetTimeoutMs);
    } catch (_) { /* ignore */ }
  }
  void mapPool(items, concurrency, warmupOne).catch(() => {});
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function preloadImageElement(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve();
      try {
        if (typeof img.decode === 'function') void img.decode();
      } catch (_) { /* ignore */ }
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

function promiseWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    sleepMs(ms).then(() => {
      throw new Error('asset-timeout');
    }),
  ]).catch(() => { /* best-effort: one slow file must not block forever */ });
}

async function mapPool(items, limit, fn) {
  let ix = 0;
  async function worker() {
    while (ix < items.length) {
      const cur = items[ix++];
      await fn(cur);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
}

const PRELOAD_CONCURRENCY = 4;
const PRELOAD_ASSET_TIMEOUT_MS = 55000;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525 + 1013904223) >>> 0); return s / 0xffffffff; };
}

function resolveEntryIndex(entries, filename, fallback) {
  const i = entries.findIndex((e) => e.file === filename);
  return i >= 0 ? i : Math.min(Math.max(0, fallback), Math.max(0, entries.length - 1));
}

function photoByEntryIndex(photos, entryIdx) {
  return photos.find((q) => q.photoId === `m-${entryIdx}`);
}

/**
 * Random order for “middle” beats; tries to avoid successive manifest indices
 * that are within 2 of each other (approx. “not neighbouring on the wall” when order ≈ layout).
 */
function shuffledPoolExcluding(entryCount, excluded, rnd) {
  const rest = [];
  for (let i = 0; i < entryCount; i++) {
    if (!excluded.has(i)) rest.push(i);
  }
  for (let ii = rest.length - 1; ii > 0; ii--) {
    const j = Math.floor(rnd() * (ii + 1));
    const tmp = rest[ii];
    rest[ii] = rest[j];
    rest[j] = tmp;
  }
  for (let k = 1; k < rest.length; k++) {
    if (Math.abs(rest[k] - rest[k - 1]) <= 2) {
      for (let s = k + 1; s < rest.length; s++) {
        if (Math.abs(rest[s] - rest[k - 1]) > 2) {
          const a = rest[k];
          rest[k] = rest[s];
          rest[s] = a;
          break;
        }
      }
    }
  }
  return rest;
}

function parallaxZ(entryIdx) {
  const r = seeded((entryIdx >>> 0) * 1103515245 + 12345)();
  return (r - 0.5) * 2 * PARALLAX_STRENGTH_PX;
}

/** Subtle drift vs camera center — reads as layered depth during pans / zoom. */
function parallaxLayerShift(entryIdx, px, py, camCx, camCy) {
  const zn = PARALLAX_STRENGTH_PX < 1e-6 ? 0 : parallaxZ(entryIdx) / PARALLAX_STRENGTH_PX;
  const vx = (px - camCx) / Math.max(VIEW_W, 1);
  const vy = (py - camCy) / Math.max(VIEW_H, 1);
  const mag = PARALLAX_STRENGTH_PX * 2.35;
  return { dx: vx * zn * mag, dy: vy * zn * mag * 0.56 };
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "pace": 2.5,
  "tiltAmount": 6,
  "padding": 12,
  "vignette": 0.55,
  "grain": 0.18,
  "warmth": 0.5,
  "rowSpacing": 48,
  "smoothness": 1,
  "rotations": {}
} /*EDITMODE-END*/;

// ─── Layout (row flow, same spirit as the original collage) ─────────────────

function buildLayoutFromEntries(entries, rowSpacingPx, tiltAmount, wallSkipIndices) {
  const skip = wallSkipIndices instanceof Set ? wallSkipIndices : new Set();
  const rnd = seeded(42);
  const PAD = 36;
  const ROW_TOP = 160;
  const X_MIN = 80;
  const X_MAX = CANVAS_W - 80;
  const usableW = X_MAX - X_MIN;
  /** Rows fill to roughly this fraction of mural width — avoids Portrait-only stacks that scale up into absurdly tall rows. */
  const ROW_FILL = 1.012;

  const photos = [];
  let y = ROW_TOP;
  let idx = 0;
  /**
   * Shorter nominal row heights ⇒ more tiles per row & fewer stacked rows ⇒ content bbox lands
   * *wider* than 16∶9 so `wideShotFromPhotos` is limited by VIEW_W (fills frame width — landscape wall).
   * Taller cycles produced a portrait-ish bbox (~0.8 : 1) and heavy side pillarboxing when zoomed out.
   */
  const heightsCycle = [356, 322, 384, 304, 400, 338, 368, 312];
  let rowCount = 0;

  while (idx < entries.length) {
    while (idx < entries.length && skip.has(idx)) idx++;
    if (idx >= entries.length) break;

    const rowH = heightsCycle[rowCount % heightsCycle.length] + Math.floor(rnd() * 24 - 12);
    const row = [];
    let widthSum = 0;

    /**
     * Greedy pack tiles until adding the next exceeds usable row width (no arbitrary 8‑tile cap).
     * Older logic capped rows at eight items — with many portrait frames that left skinny widthSum rows,
     * then scale‑to‑fill blew row heights upward and the whole collage became a tall pillar in wide shot.
     */
    while (idx < entries.length) {
      if (skip.has(idx)) {
        idx++;
        continue;
      }
      const arRaw = entries[idx].aspect;
      const ar = Math.min(Math.max(Number(arRaw) > 0 && Number.isFinite(arRaw) ? arRaw : 4 / 3, 0.22), 3.25);
      const w = rowH * ar;
      const gapBefore = row.length > 0 ? PAD : 0;
      const wouldOverflow = row.length > 0 && widthSum + gapBefore + w > usableW * ROW_FILL;
      let squeezeIntoRow = false;
      if (wouldOverflow) {
        const remainingHere = countRemainingNonSkip(idx, entries.length, skip);
        const relaxedLimit = usableW * ROW_FILL * 1.1;
        if (row.length > 0 && remainingHere <= 3 && widthSum + gapBefore + w <= relaxedLimit) {
          squeezeIntoRow = true;
        }
      }
      if (wouldOverflow && !squeezeIntoRow) break;
      row.push({ idx, ar, w, h: rowH });
      widthSum += gapBefore + w;
      idx++;
    }

    /** Must always advance manifest index (handles one tile wider than a row alone). */
    if (row.length === 0) {
      while (idx < entries.length && skip.has(idx)) idx++;
      if (idx >= entries.length) break;
      const arRaw = entries[idx].aspect;
      const ar = Math.min(Math.max(Number(arRaw) > 0 && Number.isFinite(arRaw) ? arRaw : 4 / 3, 0.22), 3.25);
      row.push({ idx, ar, w: rowH * ar, h: rowH });
      widthSum = row[0].w;
      idx++;
    }
    if (row.length === 0) break;

    /**
     * When `widthSum` is small (sparse last row), `usableW / widthSum` blows tile height vs earlier rows.
     * Pretend a minimum nominal fill so skinny rows scale closer to neighbours; center leftovers.
     */
    const MIN_ROW_WIDTH_FRAC = 0.37;
    const scale = usableW / Math.max(widthSum, usableW * MIN_ROW_WIDTH_FRAC);
    const scaledH = row[0].h * scale;
    const rowPixelW = scale * widthSum;
    let x = X_MIN + Math.max(0, (usableW - rowPixelW) / 2);
    let maxJitter = 0;
    for (const it of row) {
      const w = it.w * scale;
      const h = it.h * scale;
      const jitterY = (rnd() - 0.5) * 9;
      const cx = x + w / 2 + (rnd() - 0.5) * 7;
      const cy = y + h / 2 + jitterY;
      const tilt = (rnd() - 0.5) * tiltAmount * 2;
      const e = entries[it.idx];
      const photoId = `m-${it.idx}`;
      photos.push({
        photoId,
        entryIdx: it.idx,
        preRotate: 0,
        kind: e.kind,
        file: e.file,
        src: assetUrl(e.file),
        x: cx, y: cy, w, h, tilt
      });
      maxJitter = Math.max(maxJitter, Math.abs(jitterY));
      x += w + PAD * scale;
    }
    const tiltClearance = Math.sin(Math.abs(tiltAmount) * Math.PI / 180) * scaledH * 0.5;
    y += scaledH + rowSpacingPx + maxJitter + tiltClearance;
    rowCount++;
  }
  return photos;
}

// ─── Camera path: wide intro → visit each memory (first, then random) → wide outro ─

const easeQuart = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
/** Zero velocity at ends — chains smoothly between holds (reduces “pops” on zoom-outs). */
const easeCubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Full slab fit (contain) — never wider/taller than VIEW; shows entire canvas rectangle. */
function canvasContainScale(canvasH) {
  return Math.min(VIEW_W / CANVAS_W, VIEW_H / Math.max(canvasH, 1));
}

/**
 * Wide-shot camera on the mural bbox.
 * `coverScale` = “fill the 16∶9 frame” (like cover / scale-up in Resolve) — no letterboxing inside the stage.
 * `containScale` kept for debugging; all wide beats use cover + slight overscan so edges stay flush.
 */
function wideShotFromPhotos(photos, canvasH) {
  const slabContain = canvasContainScale(canvasH);
  const slabCover = Math.max(VIEW_W / CANVAS_W, VIEW_H / Math.max(canvasH, 1));
  if (!photos.length) {
    const cy = canvasH / 2;
    const slabOverscan = 1.035;
    const cover = slabCover * slabOverscan;
    return {
      cx: CANVAS_W / 2,
      cy,
      containScale: slabContain,
      coverScale: cover,
      introEndCover: cover,
    };
  }

  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    minL = Math.min(minL, p.x - p.w / 2);
    maxR = Math.max(maxR, p.x + p.w / 2);
    minT = Math.min(minT, p.y - p.h / 2);
    maxB = Math.max(maxB, p.y + p.h / 2);
  }

  const margin = 72;
  const bw = Math.max(maxR - minL + margin * 2, 800);
  const bh = Math.max(maxB - minT + margin * 2, 600);
  const cx = (minL + maxR) / 2;
  const cy = (minT + maxB) / 2;

  const containScale = Math.min(VIEW_W / bw, VIEW_H / bh);
  /** Single uniform scale: max axis fills 16∶9 — no letterboxing inside the stage. */
  const coverScale = Math.max(VIEW_W / bw, VIEW_H / bh);
  const bboxOverscan = 1.035;
  const introEndCover = coverScale * bboxOverscan;

  return { cx, cy, containScale, coverScale: coverScale * bboxOverscan, introEndCover };
}

/**
 * Between spotlights we only zoom out partway (“context bubble”) — fewer tiles must paint at once.
 * Finale uses `introEndCover` for the true full-wall beat.
 */
function contextBubbleScale(fullWallScale, opening = false) {
  const mul = opening ? 1.12 : 1.34;
  return fullWallScale * mul;
}

function buildMontagePath(photos, canvasH, smoothness, pacePerPhoto, plan) {
  const wide = wideShotFromPhotos(photos, canvasH);
  const easer = smoothness >= 1 ? easeCubicInOut : easeQuart;
  const { firstSpotlightIdx, finalIdx, middleOrder } = plan;

  const firstSpotP = photoByEntryIndex(photos, firstSpotlightIdx) || photos[0];
  const finalP = photoByEntryIndex(photos, finalIdx) || photos[photos.length - 1];

  /** Opening / middle videos keep `FIRST_SPOTLIGHT_HOLD_SEC`; finale video keeps `FINAL_SPOTLIGHT_HOLD_SEC`. */
  const dwellAfterSpotlight = (p, role /* 'first' | 'middle' | 'final' */) => {
    if (!p) return MEMORY_IMAGE_HOLD_SEC;
    if (p.kind === 'video') {
      if (role === 'final') return FINAL_SPOTLIGHT_HOLD_SEC;
      return FIRST_SPOTLIGHT_HOLD_SEC;
    }
    return MEMORY_IMAGE_HOLD_SEC;
  };

  /** Slower drift to first wide read — easier on decode / perceptual read. */
  const revealHold = pacePerPhoto * 3.35;
  /** Matches legacy collage “revealPull” pacing — synced with fullscreen→mural transition in `<Collage>`. */
  const revealPullIntro = pacePerPhoto * 4.95;
  const firstBridge = pacePerPhoto * 1.62;
  /** Longer pullback = more time on the wall between memories. */
  const pullBack = pacePerPhoto * 1.42;
  const travel = pacePerPhoto * 0.78;
  const approachFirst = pacePerPhoto * 1.62;
  const approachNext = pacePerPhoto * 0.82;
  const microDwell = pacePerPhoto * 0.38;
  const finalMicro = pacePerPhoto * 0.35;

  const openFillFallback = Math.min(VIEW_W * 0.9 / firstSpotP.w, VIEW_H * 0.86 / firstSpotP.h);

  /** True full-mural cover scale (used for finale / full pull). */
  const scaleFullWall = wide.introEndCover;
  const scaleOpeningBubble = contextBubbleScale(scaleFullWall, true);
  const scaleBetweenBubble = contextBubbleScale(scaleFullWall, false);

  const beats = [];
  let t = 0;

  // Zoomed mural → opening bubble (`0.png` overlays this segment for the first part in `<Collage>`).
  beats.push({
    t,
    cx: wide.cx + 110,
    cy: wide.cy - 52,
    scale: scaleOpeningBubble * 2.42
  });
  t += revealPullIntro;
  beats.push({
    t,
    cx: wide.cx - 42,
    cy: wide.cy + 38,
    scale: scaleOpeningBubble
  });
  t += revealHold * 0.72;
  beats.push({
    t,
    cx: wide.cx,
    cy: wide.cy,
    scale: scaleOpeningBubble * 1.002
  });
  t += revealHold * 0.28;

  let lastCx = beats[beats.length - 1].cx;
  let lastCy = beats[beats.length - 1].cy;
  let lastScale = beats[beats.length - 1].scale;

  /**
   * Dolly to a *partial* mural read (bubble), pan biased toward where we came from —
   * not the full collage plane until the final sequence.
   */
  const appendPullWide = () => {
    const zoomFromCx = lastCx;
    const zoomFromCy = lastCy;
    const bubble = scaleBetweenBubble;
    const pullZoomDur = pullBack * 0.62;
    const pullPanDur = pullBack * 0.38;
    beats.push({ t: t + pullZoomDur, cx: zoomFromCx, cy: zoomFromCy, scale: bubble });
    t += pullZoomDur;
    const panCx = zoomFromCx * 0.35 + wide.cx * 0.65;
    const panCy = zoomFromCy * 0.35 + wide.cy * 0.65;
    beats.push({ t: t + pullPanDur, cx: panCx, cy: panCy, scale: bubble });
    t += pullPanDur;
    lastCx = panCx;
    lastCy = panCy;
    lastScale = bubble;
  };

  const appendSpotlight = (p, isFirstAfterWide, fromPrevSpot) => {
    const zoomScale = Math.min(VIEW_W * 0.78 / p.w, VIEW_H * 0.8 / p.h);

    if (isFirstAfterWide) {
      const midScale = Math.sqrt(lastScale * zoomScale);
      const midCx = (lastCx + p.x) / 2;
      const midCy = (lastCy + p.y) / 2;
      beats.push({ t: t + firstBridge, cx: midCx, cy: midCy, scale: midScale });
      t += firstBridge;
      beats.push({ t: t + approachFirst, cx: p.x, cy: p.y, scale: zoomScale });
      t += approachFirst;
      beats.push({ t: t + microDwell, cx: p.x + 6, cy: p.y - 4, scale: zoomScale * 1.03 });
      t += microDwell;
    } else if (fromPrevSpot) {
      appendPullWide();
      const midScale = Math.sqrt(lastScale * zoomScale);
      const midCx = wide.cx * 0.42 + p.x * 0.58;
      const midCy = wide.cy * 0.42 + p.y * 0.58;
      beats.push({ t: t + travel, cx: midCx, cy: midCy, scale: midScale });
      t += travel;
      beats.push({ t: t + approachNext, cx: p.x, cy: p.y, scale: zoomScale });
      t += approachNext;
      beats.push({ t: t + microDwell, cx: p.x + 6, cy: p.y - 4, scale: zoomScale * 1.03 });
      t += microDwell;
    }
    lastCx = p.x + 6;
    lastCy = p.y - 4;
    lastScale = zoomScale * 1.03;
  };

  let prevSpot = null;

  appendSpotlight(firstSpotP, true, null);
  {
    const dwell = dwellAfterSpotlight(firstSpotP, 'first');
    beats.push({
      t: t + dwell,
      cx: lastCx,
      cy: lastCy,
      scale: lastScale
    });
    t += dwell;
  }

  prevSpot = firstSpotP;
  for (let mi = 0; mi < middleOrder.length; mi++) {
    const p = photoByEntryIndex(photos, middleOrder[mi]);
    if (!p) continue;
    appendSpotlight(p, false, true);
    {
      const dwell = dwellAfterSpotlight(p, 'middle');
      beats.push({
        t: t + dwell,
        cx: lastCx,
        cy: lastCy,
        scale: lastScale
      });
      t += dwell;
    }
    prevSpot = p;
  }

  const zoomFinal = Math.min(VIEW_W * 0.82 / finalP.w, VIEW_H * 0.82 / finalP.h);

  if (firstSpotlightIdx === finalIdx && middleOrder.length === 0 && photos.length === 1) {
    const h = dwellAfterSpotlight(firstSpotP, 'final');
    beats.push({ t: t + h + finalMicro, cx: firstSpotP.x, cy: firstSpotP.y, scale: openFillFallback });
    t += h + finalMicro;
  } else if (prevSpot && finalP.photoId === prevSpot.photoId) {
    const h = dwellAfterSpotlight(finalP, 'final');
    beats.push({
      t: t + h,
      cx: prevSpot.x + 5,
      cy: prevSpot.y - 3,
      scale: lastScale
    });
    t += h;
  } else {
    if (!prevSpot) {
      const midScale = Math.sqrt(lastScale * zoomFinal);
      beats.push({ t: t + firstBridge, cx: (lastCx + finalP.x) / 2, cy: (lastCy + finalP.y) / 2, scale: midScale });
      t += firstBridge;
      beats.push({ t: t + approachFirst * 1.08, cx: finalP.x, cy: finalP.y, scale: zoomFinal });
      t += approachFirst * 1.08;
    } else {
      appendPullWide();
      const midScale = Math.sqrt(lastScale * zoomFinal);
      const midCx = wide.cx * 0.36 + finalP.x * 0.64;
      const midCy = wide.cy * 0.36 + finalP.y * 0.64;
      beats.push({ t: t + travel * 1.08, cx: midCx, cy: midCy, scale: midScale });
      t += travel * 1.08;
      beats.push({ t: t + approachNext * 1.12, cx: finalP.x, cy: finalP.y, scale: zoomFinal });
      t += approachNext * 1.12;
    }
    const finalDwell = dwellAfterSpotlight(finalP, 'final');
    beats.push({
      t: t + finalMicro + finalDwell,
      cx: finalP.x + 5,
      cy: finalP.y - 3,
      scale: zoomFinal * 1.024
    });
    t += finalMicro + finalDwell;
  }

  const outroCrossfadeSec = pacePerPhoto * 0.88;
  return { beats, easer, introRevealPullSec: revealPullIntro, outroCrossfadeSec, fitScale: wide.coverScale };
}

function sampleCamera(time, beats, easer) {
  if (time <= beats[0].t) return beats[0];
  if (time >= beats[beats.length - 1].t) return beats[beats.length - 1];
  for (let i = 0; i < beats.length - 1; i++) {
    if (time >= beats[i].t && time <= beats[i + 1].t) {
      const a = beats[i];
      const b = beats[i + 1];
      const span = b.t - a.t;
      const local = span === 0 ? 0 : (time - a.t) / span;
      const e = easer(local);
      return {
        cx: a.cx + (b.cx - a.cx) * e,
        cy: a.cy + (b.cy - a.cy) * e,
        scale: a.scale + (b.scale - a.scale) * e
      };
    }
  }
  return beats[beats.length - 1];
}

/**
 * Uniform-scale “cover” inside the mural slab: never reveal empty space beyond the collage plane edges
 * (warmth radial / `#07050a` would otherwise show outside the tiled region).
 */
function enforceSlabCoverCamera(cam, slabW, slabH) {
  if (!(slabW > 1 && slabH > 1 && cam.scale > 1e-8)) return cam;
  const edgeInset = Math.min(48, slabW * 0.004, slabH * 0.004);
  const cx = Math.min(Math.max(cam.cx, edgeInset), slabW - edgeInset);
  const cy = Math.min(Math.max(cam.cy, edgeInset), slabH - edgeInset);
  const halfHx = Math.min(cx, slabW - cx);
  const halfVy = Math.min(cy, slabH - cy);
  const sx = VIEW_W / Math.max(2 * halfHx, 1);
  const sy = VIEW_H / Math.max(2 * halfVy, 1);
  const slabCoverBaseline = Math.max(VIEW_W / slabW, VIEW_H / slabH) * 1.015;
  const minScale = Math.max(slabCoverBaseline, sx, sy);
  return { cx, cy, scale: Math.max(cam.scale, minScale) };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ─── Media frame (image or mp4) ─────────────────────────────────────────────

/** If load/decode stalls (GPU / buggy decode()), don’t hide frames for tens of seconds. */
const MEDIA_REVEAL_FAILSAFE_MS = 12000;

function MediaFrame({ p, index, padding, rotation, onClick, editMode, camCx, camCy, mediaAllowed }) {
  const time = useTime();
  const [mediaPainted, setMediaPainted] = React.useState(false);

  React.useLayoutEffect(() => {
    setMediaPainted(false);
  }, [p.photoId, p.src, mediaAllowed]);

  React.useEffect(() => {
    if (!mediaAllowed) return undefined;
    const ms = p.kind === 'video' ? 8000 : MEDIA_REVEAL_FAILSAFE_MS;
    const id = window.setTimeout(() => setMediaPainted(true), ms);
    return () => window.clearTimeout(id);
  }, [mediaAllowed, p.kind, p.photoId, p.src]);

  /** Never await `decode()` — on some browsers it never settles on large JPGs ⇒ stuck black tile. */
  const onImagePaintReady = React.useCallback((e) => {
    const el = e.currentTarget;
    setMediaPainted(true);
    try {
      if (typeof el.decode === 'function') void el.decode();
    } catch (_) {
      /* ignore */
    }
  }, []);

  const onImageError = React.useCallback(() => {
    setMediaPainted(true);
  }, []);

  const onVideoPaintReady = React.useCallback(() => {
    setMediaPainted(true);
  }, []);

  const imageRef = React.useCallback(
    (el) => {
      if (!el || p.kind !== 'image') return;
      if (el.complete && el.naturalWidth > 0) {
        setMediaPainted(true);
        try {
          if (typeof el.decode === 'function') void el.decode();
        } catch (_) {
          /* ignore */
        }
      }
    },
    [p.kind, p.src, p.photoId]
  );

  const videoRef = React.useCallback(
    (el) => {
      if (!el || p.kind !== 'video') return;
      if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setMediaPainted(true);
      }
    },
    [p.kind, p.src, p.photoId]
  );

  const breathe = 1 + Math.sin(time * 0.35 + index * 0.6) * 0.0025;
  const drift = Math.sin(time * 0.22 + index * 0.9) * 0.6;
  const { dx, dy } =
    typeof camCx === 'number' && typeof camCy === 'number'
      ? parallaxLayerShift(p.entryIdx, p.x, p.y, camCx, camCy)
      : { dx: 0, dy: 0 };
  const rot = (rotation || 0) % 360;
  const totalRot = (((p.preRotate || 0) + rot) % 360 + 360) % 360;
  const swap = totalRot === 90 || totalRot === 270;
  const innerW = p.w - padding * 2;
  const innerH = p.h - padding * 2;
  /** First spotlight clip: preserve full frame in its matte (`cover` clipped subjects). */
  const innerFit =
    p.kind === 'video' && String(p.file) === FIRST_SPOTLIGHT_FILE ? 'contain' : 'cover';

  const mediaStyle = swap ? {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: innerH,
    height: innerW,
    transform: `translate(-50%, -50%) rotate(${totalRot}deg)`,
    transformOrigin: 'center center',
    objectFit: innerFit,
    display: 'block'
  } : {
    width: '100%',
    height: '100%',
    objectFit: innerFit,
    display: 'block'
  };

  return (
    <div
      onClick={editMode ? onClick : undefined}
      style={{
        position: 'absolute',
        left: p.x - p.w / 2 + dx,
        top: p.y - p.h / 2 + drift + dy,
        width: p.w,
        height: p.h,
        transform: `translateZ(0) rotate(${p.tilt}deg) scale(${breathe})`,
        transformOrigin: 'center center',
        background: '#fafaf6',
        padding: padding,
        boxShadow:
          '0 28px 64px rgba(15,8,4,0.6), 0 8px 20px rgba(15,8,4,0.4), inset 0 0 0 1px rgba(255,255,255,0.55)',
        borderRadius: 3,
        cursor: editMode ? 'pointer' : 'default',
        outline: editMode ? '2px dashed rgba(243,230,207,0.35)' : 'none',
        outlineOffset: 2
      }}
      title={editMode ? `Click to rotate ${p.photoId} (${rot}°)` : undefined}
    >
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg,#1f1c18,#161311)'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          opacity: !mediaAllowed || mediaPainted ? 1 : 0,
          transition: 'opacity 120ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
        {!mediaAllowed ? null : p.kind === 'video' ? (
          <video
            ref={videoRef}
            src={p.src}
            style={mediaStyle}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            onLoadedData={onVideoPaintReady}
            onCanPlay={onVideoPaintReady}
            onError={onVideoPaintReady}
          />
        ) : (
          <img
            ref={imageRef}
            src={p.src}
            alt=""
            style={mediaStyle}
            draggable={false}
            decoding="async"
            onLoad={onImagePaintReady}
            onError={onImageError}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(160deg, rgba(255,210,150,0.08), rgba(80,30,10,0.16))',
            mixBlendMode: 'multiply',
            pointerEvents: 'none'
          }}
        />
        </div>
      </div>
    </div>
  );
}

function Grain({ amount }) {
  const time = useTime();
  const shift = Math.floor(time * 24) % 8;
  if (amount <= 0) return null;
  return (
    <div style={{
      position: 'absolute', inset: -50, pointerEvents: 'none',
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.6  0 0 0 0 0.55  0 0 0 0 0.48  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.45'/></svg>")`,
      backgroundSize: '240px 240px',
      opacity: amount,
      transform: `translate(${shift * 7}px, ${shift * 5}px)`,
      mixBlendMode: 'overlay'
    }} />
  );
}

// ─── Collage ────────────────────────────────────────────────────────────────

function Collage({ t, editMode, onRotate }) {
  const [manifest, setManifest] = React.useState(null);
  const [loadErr, setLoadErr] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${EDIT_BASE}/manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error('manifest ' + r.status);
        return r.json();
      })
      .then((data) => { if (!cancelled) setManifest(data); })
      .catch((e) => { if (!cancelled) setLoadErr(e.message || String(e)); });
    return () => { cancelled = true; };
  }, []);

  const entries = manifest && Array.isArray(manifest.entries) ? manifest.entries : [];

  const entrySig = React.useMemo(
    () => entries.map((e) => `${e.file}`).join('\0'),
    [entries]
  );

  const wallSkip = React.useMemo(() => wallSkipIndicesForEntries(entries), [entries, entrySig]);

  const layout = React.useMemo(
    () => (entries.length ? buildLayoutFromEntries(entries, t.rowSpacing, t.tiltAmount, wallSkip) : []),
    [entrySig, entries.length, t.rowSpacing, t.tiltAmount, wallSkip]
  );

  const canvasH = React.useMemo(() => {
    if (!layout.length) return VIEW_H;
    const maxY = Math.max(...layout.map((p) => p.y + p.h / 2));
    /** Keep a minimum slab height so wide-shot “cover” math stays stable when many entries are skipped from the wall. */
    return Math.max(maxY + 240, VIEW_H * 1.12);
  }, [layout]);

  const cinematicPlan = React.useMemo(() => {
    if (!entries.length) return null;
    let firstS = resolveEntryIndex(entries, FIRST_SPOTLIGHT_FILE, Math.max(0, entries.length - 1));
    let finI = resolveEntryIndex(entries, FINAL_HERO_FILE, Math.max(0, entries.length - 1));
    if (firstS === finI && entries.length > 1) {
      finI = (firstS + Math.max(1, Math.floor(entries.length / 2))) % entries.length;
    }
    /** Random middle; `72.png`/`0.png`/wall skips never appear — `FINAL_HERO` + first spotlight excluded. */
    const excludedMiddle = new Set(wallSkip);
    excludedMiddle.add(firstS);
    excludedMiddle.add(finI);

    let middlePool = shuffledPoolExcluding(entries.length, excludedMiddle, seeded(VISIT_RANDOM_SEED));
    middlePool = middlePool.filter((idx) => !wallSkip.has(idx));

    return { firstSpotlightIdx: firstS, finalIdx: finI, middleOrder: middlePool };
  }, [entries.length, entrySig, wallSkip]);

  const { beats, easer, introRevealPullSec, outroCrossfadeSec } = React.useMemo(
    () =>
      layout.length && cinematicPlan
        ? buildMontagePath(layout, canvasH, t.smoothness, t.pace, cinematicPlan)
        : {
            beats: [{ t: 0, cx: CANVAS_W / 2, cy: VIEW_H / 2, scale: 1 }],
            easer: easeCubicInOut,
            introRevealPullSec: TWEAK_DEFAULTS.pace * 4.95,
            outroCrossfadeSec: TWEAK_DEFAULTS.pace * 0.88,
          },
    [layout, cinematicPlan, t.pace, canvasH, t.smoothness]
  );

  const montageCoreEnd = beats[beats.length - 1].t;

  const { time: stageTime, setPlaying } = useTimeline();

  const collageSpanEndStage = INTRO_FULLSCREEN_HOLD_SEC + montageCoreEnd;
  /** Crossfade overlaps the montage tail; extra time is pure hold on `72.png`. */
  const timelineTotal = collageSpanEndStage + OUTRO_CARD_HOLD_SEC;

  React.useEffect(() => {
    if (layout.length === 0) return;
    window.__collageDuration = timelineTotal;
    window.dispatchEvent(new Event('__collageDurationChange'));
  }, [timelineTotal, layout.length]);

  const introPhaseEnd = INTRO_FULLSCREEN_HOLD_SEC;
  const introPullbackEndStage = introPhaseEnd + introRevealPullSec;
  /** Shorter overlay fade vs full pullback — fullscreen `0.png` disappears ~5s + this, camera keeps easing. */
  const introPlateFadeSec = Math.min(INTRO_CROSSFADE_MAX_SEC, introRevealPullSec);
  const introCrossfadeEndStage = introPhaseEnd + introPlateFadeSec;

  let introPlateOpacity = 0;
  if (!editMode) {
    if (stageTime < introPhaseEnd) {
      introPlateOpacity = 1;
    } else if (stageTime < introCrossfadeEndStage) {
      const u = clamp01((stageTime - introPhaseEnd) / Math.max(1e-6, introPlateFadeSec));
      introPlateOpacity = 1 - easeCubicInOut(u);
    }
  }

  const outroFadeStartStage = collageSpanEndStage - outroCrossfadeSec;
  const rawCollageT = stageTime < introPhaseEnd ? 0 : stageTime - introPhaseEnd;
  const collageTime = editMode
    ? stageTime
    : (stageTime < introPhaseEnd ? 0 : Math.min(rawCollageT, montageCoreEnd));

  let collageStackOpacity = 1;
  let outroPlateOpacity = 0;
  if (!editMode) {
    if (stageTime >= outroFadeStartStage && stageTime < collageSpanEndStage) {
      const u = clamp01((stageTime - outroFadeStartStage) / Math.max(1e-6, outroCrossfadeSec));
      const e = easeCubicInOut(u);
      collageStackOpacity = 1 - e;
      outroPlateOpacity = e;
    } else if (stageTime >= collageSpanEndStage) {
      collageStackOpacity = 0;
      outroPlateOpacity = 1;
    }
  }

  /** Mural fades in over `introPlateFadeSec` — may finish before pullback camera motion ends. */
  let introMuralRevealOpacity = 1;
  if (!editMode) {
    if (stageTime < introPhaseEnd) introMuralRevealOpacity = 0;
    else if (stageTime < introCrossfadeEndStage) {
      const u = clamp01((stageTime - introPhaseEnd) / Math.max(1e-6, introPlateFadeSec));
      introMuralRevealOpacity = easeCubicInOut(u);
    }
  }
  const muralCombinedOpacity = (editMode ? 1 : introMuralRevealOpacity) * collageStackOpacity;
  const muralLayerPointer =
    editMode || (introMuralRevealOpacity > 1e-5 && collageStackOpacity > 1e-5);
  const muralEffectsOn = editMode || introMuralRevealOpacity > 1e-5;

  const [, gateTick] = React.useReducer((x) => x + 1, 0);
  const allowedPhotoIdsRef = React.useRef(new Set());
  const entrySigSeenRef = React.useRef(entrySig);

  React.useEffect(() => {
    if (!entries.length) return undefined;
    setPlaying(true);
    warmCollageUrlsBackground(entries, {
      concurrency: PRELOAD_CONCURRENCY,
      assetTimeoutMs: PRELOAD_ASSET_TIMEOUT_MS,
    });
    return undefined;
  }, [entrySig, entries.length, setPlaying]);

  const cam0 = sampleCamera(collageTime, beats, easer);
  const cam = editMode || !layout.length ? cam0 : enforceSlabCoverCamera(cam0, CANVAS_W, canvasH);
  const tx = VIEW_W / 2 - cam.cx * cam.scale;
  const ty = VIEW_H / 2 - cam.cy * cam.scale;

  React.useLayoutEffect(() => {
    if (!layout.length) return;
    if (entrySigSeenRef.current !== entrySig) {
      entrySigSeenRef.current = entrySig;
      allowedPhotoIdsRef.current = new Set();
    }

    let changed = false;

    if (editMode) {
      for (let i = 0; i < layout.length; i++) {
        const id = layout[i].photoId;
        if (!allowedPhotoIdsRef.current.has(id)) {
          allowedPhotoIdsRef.current.add(id);
          changed = true;
        }
      }
    } else {
      const vr = muralViewRectMural(cam, tx, ty);
      const cand = [];
      for (let i = 0; i < layout.length; i++) {
        const p = layout[i];
        if (allowedPhotoIdsRef.current.has(p.photoId)) continue;
        const b = muralTileRoughBounds(p);
        if (
          muralsOverlap(vr.left, vr.top, vr.right, vr.bottom,
            b.left, b.top, b.right, b.bottom,
            VIEWPORT_CULL_MARGIN_MURAL)
        ) {
          const dist2 = (p.x - cam.cx) * (p.x - cam.cx) + (p.y - cam.cy) * (p.y - cam.cy);
          cand.push({ photoId: p.photoId, dist2 });
        }
      }
      cand.sort((a, b) => a.dist2 - b.dist2);
      const openingBurst =
        !editMode && stageTime < introPullbackEndStage + 0.75;
      const admit = openingBurst
        ? cand.length
        : Math.min(MEDIA_ADMIT_PER_TICK, cand.length);
      for (let i = 0; i < admit; i++) {
        allowedPhotoIdsRef.current.add(cand[i].photoId);
        changed = true;
      }
    }

    if (changed) gateTick();
  }, [
    collageTime,
    gateTick,
    editMode,
    layout,
    entrySig,
    cam.cx,
    cam.cy,
    cam.scale,
    tx,
    ty,
    stageTime,
    introPullbackEndStage,
  ]);

  const warm = t.warmth;
  const bg = `radial-gradient(ellipse at 50% 45%,
    rgb(${42 + warm * 30}, ${31 - warm * 4}, ${23 - warm * 6}) 0%,
    rgb(${21 + warm * 12}, ${16 - warm * 2}, ${11 - warm * 4}) 60%,
    rgb(${7 + warm * 4}, ${5}, ${10}) 100%)`;

  if (loadErr) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f3e6cf', background: '#07050a', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 22, marginBottom: 12 }}>Could not load collage manifest</div>
          <div style={{ opacity: 0.75 }}>{loadErr}</div>
          <div style={{ opacity: 0.55, marginTop: 16, fontSize: 14 }}>Run <code style={{ background: '#222', padding: '2px 8px' }}>npm run gen:manifest</code> then refresh.</div>
        </div>
      </div>
    );
  }

  if (!manifest || !entries.length) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f3e6cf', background: '#07050a' }}>
        Loading memories…
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: '#07050a',
    }}>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: bg }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        opacity: muralCombinedOpacity,
        pointerEvents: muralLayerPointer ? 'auto' : 'none',
      }}>
      <div style={{
        position: 'absolute',
        width: CANVAS_W,
        height: canvasH,
        left: 0,
        top: 0,
        /** Match matte inside frames so gutters / slab edges aren’t punched through to the warmth layer. */
        background: '#161311',
        transformStyle: 'preserve-3d',
        transformOrigin: '0 0',
        transform: `translate(${tx}px, ${ty}px) scale(${cam.scale})`,
        willChange: 'transform',
        visibility: layout.length ? 'visible' : 'hidden',
      }}>
          {layout.map((p, i) => (
            <MediaFrame
              key={p.photoId}
              p={p}
              index={i}
              padding={t.padding}
              rotation={t.rotations[p.photoId] || 0}
              editMode={editMode}
              camCx={cam.cx}
              camCy={cam.cy}
              mediaAllowed={allowedPhotoIdsRef.current.has(p.photoId)}
              onClick={() => onRotate(p.photoId)}
            />
          ))}
      </div>

      {muralEffectsOn ? (
      <>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${t.vignette}) 100%)`
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `linear-gradient(180deg, rgba(60,28,8,${0.05 + warm * 0.10}), rgba(15,8,4,${0.10 + warm * 0.15}))`,
        mixBlendMode: 'multiply'
      }} />
      </>
      ) : null}
      <Grain amount={muralEffectsOn ? t.grain : 0} />
      </div>
      {!editMode ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 40,
          background: '#07050a',
          pointerEvents: 'none',
          opacity: introPlateOpacity,
          isolation: 'isolate',
          willChange: 'opacity',
          transform: 'translateZ(0)',
        }}>
          <img
            src={assetUrl(INTRO_FULLSCREEN_FILE)}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: 'center'
            }}
          />
        </div>
      ) : null}
      {!editMode ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 45,
          background: '#07050a',
          pointerEvents: 'none',
          opacity: outroPlateOpacity,
          isolation: 'isolate',
          willChange: 'opacity',
          transform: 'translateZ(0)',
        }}>
          <img
            src={assetUrl(OUTRO_FULLSCREEN_FILE)}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: 'center'
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function TweaksUI({ t, setTweak, resetRotations }) {
  return (
    <TweaksPanel>
      <TweakSection label="Motion" />
      <TweakSlider label="Pace per beat" value={t.pace} min={0.8} max={4} step={0.1} unit="s"
        onChange={(v) => setTweak('pace', v)} />
      <TweakRadio label="Smoothness" value={t.smoothness === 1 ? 'butter' : 'standard'}
        options={['standard', 'butter']}
        onChange={(v) => setTweak('smoothness', v === 'butter' ? 1 : 0)} />

      <TweakSection label="Frames" />
      <TweakSlider label="Tilt" value={t.tiltAmount} min={0} max={12} step={0.5} unit="°"
        onChange={(v) => setTweak('tiltAmount', v)} />
      <TweakSlider label="Border" value={t.padding} min={0} max={28} step={1} unit="px"
        onChange={(v) => setTweak('padding', v)} />
      <TweakSlider label="Row spacing" value={t.rowSpacing} min={0} max={160} step={4} unit="px"
        onChange={(v) => setTweak('rowSpacing', v)} />

      <TweakSection label="Look" />
      <TweakSlider label="Vignette" value={t.vignette} min={0} max={0.9} step={0.05}
        onChange={(v) => setTweak('vignette', v)} />
      <TweakSlider label="Grain" value={t.grain} min={0} max={0.6} step={0.02}
        onChange={(v) => setTweak('grain', v)} />
      <TweakSlider label="Warmth" value={t.warmth} min={0} max={1} step={0.05}
        onChange={(v) => setTweak('warmth', v)} />

      <TweakSection label="Photo orientation" />
      <div style={{ fontSize: 11, color: 'rgba(41,38,27,.6)', lineHeight: 1.45 }}>
        Click any frame to rotate 90°. Click 4× to reset.
      </div>
      <TweakButton label="Reset all rotations" onClick={resetRotations} />
    </TweaksPanel>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = React.useState(false);
  const [duration, setDuration] = React.useState(999);

  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setEditMode(true);
      if (e.data.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  React.useEffect(() => {
    try {
      localStorage.removeItem('animstage:t');
      localStorage.removeItem('memory-montage-v1:t');
    } catch (_) { /* ignore */ }
  }, []);

  React.useEffect(() => {
    const sync = () => setDuration(Math.max(1, window.__collageDuration || 999));
    window.addEventListener('__collageDurationChange', sync);
    sync();
    return () => window.removeEventListener('__collageDurationChange', sync);
  }, []);

  const rotatePhoto = React.useCallback((photoId) => {
    const cur = (t.rotations && t.rotations[photoId]) || 0;
    const next = (cur + 90) % 360;
    const merged = { ...(t.rotations || {}) };
    if (next === 0) delete merged[photoId];
    else merged[photoId] = next;
    setTweak('rotations', merged);
  }, [t.rotations, setTweak]);

  const resetRotations = React.useCallback(() => {
    setTweak('rotations', {});
  }, [setTweak]);

  return (
    <>
      <Stage
        width={VIEW_W}
        height={VIEW_H}
        fit="cover"
        duration={duration}
        background="#07050a"
        fps={60}
        loop={false}
        autoplay={false}
        persistKey="memory-montage-v1"
      >
        <Collage t={t} editMode={editMode} onRotate={rotatePhoto} />
      </Stage>
      <TweaksUI t={t} setTweak={setTweak} resetRotations={resetRotations} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
